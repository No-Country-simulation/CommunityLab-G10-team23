// Utilidades del BFF (solo servidor): los endpoints de src/pages/api/* reenvían a FastAPI.

import { backendUrl } from "@/lib/server/env";
import { invalidateSession } from "@/lib/server/session";

export { backendUrl, isDemo } from "@/lib/server/env";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** fetch a FastAPI con el token de la sesión del usuario. */
export async function backendFetch(token: string | null, path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${backendUrl()}${path}`, { cache: "no-store", ...init, headers });
  // El backend revocó la sesión (logout en otro equipo, cuenta desactivada, cambio de rol):
  // se descarta de la caché para que el middleware la vuelva a validar y borre la cookie.
  if (response.status === 401 && token) invalidateSession(token);
  return response;
}

/** Respuesta de error del backend con el mensaje que puede mostrarse a la persona. */
export async function backendError(response: Response, fallback: string): Promise<Response> {
  const data = await response.json().catch(() => null);
  const detail = data?.detail;
  // Los conflictos (409) traen {mensaje, actual}: el mensaje se muestra y `actual` se reenvía.
  const mensaje = typeof detail === "string" ? detail : typeof detail?.mensaje === "string" ? detail.mensaje : fallback;
  return json({ error: mensaje, detail }, response.status);
}
