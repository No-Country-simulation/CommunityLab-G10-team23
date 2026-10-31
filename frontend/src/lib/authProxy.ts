// Reenvío de los endpoints públicos de /auth (login, registro, restablecer) con límite por IP.

import type { APIContext } from "astro";
import { backendUrl, errorMessage, json } from "@/lib/bff";
import { TOO_MANY, authLimiter, clientIp } from "@/lib/rateLimit";
import { setSessionCookie } from "@/lib/session";

type Fields = Record<string, string>;

/** Lee un cuerpo JSON con los campos de texto indicados; null si falta alguno o no es texto. */
async function readFields(request: Request, names: string[]): Promise<Fields | null> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return null;
  const fields: Fields = {};
  for (const name of names) {
    const value = (body as Record<string, unknown>)[name];
    if (typeof value !== "string") return null;
    fields[name] = value;
  }
  return fields;
}

/**
 * Reenvía a FastAPI. Si responde con una sesión, guarda el token en la cookie httpOnly y
 * devuelve solo el usuario: el token nunca llega al JavaScript del navegador.
 */
export async function forwardAuth(context: APIContext, backendPath: string, names: string[]): Promise<Response> {
  const { request, cookies, url } = context;
  const ip = clientIp(request, () => context.clientAddress);
  if (authLimiter.blocked(ip)) return json({ error: TOO_MANY }, 429);

  const fields = await readFields(request, names);
  if (!fields) return json({ error: "Completa todos los campos" }, 400);

  let response: Response;
  try {
    response = await fetch(`${backendUrl()}${backendPath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.warn(`Backend no alcanzable en ${backendPath}:`, errorMessage(error));
    return json({ error: "No pudimos conectar con el servidor. Inténtalo de nuevo en unos minutos." }, 503);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if ([400, 401, 422].includes(response.status)) authLimiter.fail(ip);
    return json({ error: errorText(response.status, data?.detail) }, response.status);
  }

  if (data?.token) {
    setSessionCookie(cookies, data.token, url);
    return json({ usuario: data.usuario }, response.status);
  }
  return json({ ok: true });
}

function errorText(status: number, detail: unknown): string {
  if (typeof detail === "string") return detail;
  // 422: validación de FastAPI (p. ej. contraseña corta); se resume en una frase.
  if (status === 422) return "Revisa los datos: la contraseña debe tener entre 12 y 128 caracteres.";
  return "No se pudo completar la solicitud";
}
