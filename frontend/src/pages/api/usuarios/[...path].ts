import type { APIRoute } from "astro";
import { backendError, backendFetch, errorMessage, json } from "@/lib/bff";

// Gestión del equipo (solo administración). El backend vuelve a exigir el rol; aquí se corta
// antes y solo se reenvían las rutas que existen en /api/v1/usuarios.
const ALLOWED: Record<string, RegExp> = {
  GET: /^(invitaciones)?$/,
  POST: /^(invitaciones|usr_[0-9a-f]{32}\/recuperacion)$/,
  PATCH: /^usr_[0-9a-f]{32}$/,
  DELETE: /^invitaciones\/inv_[0-9a-f]{32}$/,
};

const proxy: APIRoute = async ({ params, request, locals }) => {
  if (locals.user?.rol !== "admin") {
    return json({ error: "Solo la administración puede gestionar el equipo" }, 403);
  }

  const path = params.path ?? "";
  if (!ALLOWED[request.method]?.test(path)) return json({ error: "Ruta no válida" }, 404);

  const init: RequestInit = { method: request.method, signal: AbortSignal.timeout(10000) };
  if (request.method === "POST" || request.method === "PATCH") {
    const body = await request.text();
    init.headers = { "Content-Type": "application/json" };
    init.body = body || "{}";
  }

  try {
    const response = await backendFetch(locals.token, `/api/v1/usuarios${path ? `/${path}` : ""}`, init);
    if (!response.ok) return backendError(response, "No se pudo completar la acción");
    if (response.status === 204) return json({ ok: true });
    return json(await response.json(), response.status);
  } catch (error) {
    return json({ error: "No pudimos conectar con el servidor", detail: errorMessage(error) }, 502);
  }
};

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
