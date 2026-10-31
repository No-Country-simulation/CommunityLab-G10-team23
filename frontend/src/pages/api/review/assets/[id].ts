import type { APIRoute } from "astro";
import { backendError, backendFetch, errorMessage, isDemo, json } from "@/lib/server/bff";

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const id = params.id ?? "";
  let body: { estado_aprobacion?: string; contenido?: Record<string, unknown>; version?: number };
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "JSON inválido", detail: errorMessage(error) }, 400);
  }

  // Modo demostración: los candidatos son simulados y la revisión vive solo en la sesión.
  if (isDemo()) {
    return json({
      source: "simulation",
      status: body.estado_aprobacion || "aprobado",
      candidato_id: id,
      message: `Candidato de demostración ${id} procesado localmente`,
    });
  }

  try {
    const response = await backendFetch(locals.token, `/api/v1/review/assets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return backendError(response, "No se pudo guardar la revisión");
    return json({ source: "fastapi", data: await response.json() });
  } catch (error) {
    return json({ error: "No pudimos conectar con el servidor", detail: errorMessage(error) }, 502);
  }
};
