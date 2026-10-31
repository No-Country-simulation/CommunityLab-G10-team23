import type { APIRoute } from "astro";
import { backendError, backendFetch, errorMessage, json } from "@/lib/server/bff";

// Consulta el avance de un trabajo; `desde` limita la respuesta a las interacciones nuevas.
export const GET: APIRoute = async ({ params, url, locals }) => {
  const id = params.id ?? "";
  const desde = url.searchParams.get("desde") ?? "0";

  try {
    const response = await backendFetch(
      locals.token,
      `/api/v1/pipeline/jobs/${encodeURIComponent(id)}?desde=${encodeURIComponent(desde)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!response.ok) return backendError(response, "No se pudo consultar el trabajo");
    return json({ source: "fastapi", data: await response.json() });
  } catch (error) {
    return json({ error: "Backend no alcanzable", detail: errorMessage(error) }, 502);
  }
};

// Elimina un lote sin publicar (solo admin; el backend lo valida y responde 403 si no).
export const DELETE: APIRoute = async ({ params, locals }) => {
  const id = params.id ?? "";

  try {
    const response = await backendFetch(locals.token, `/api/v1/pipeline/jobs/${encodeURIComponent(id)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return backendError(response, "No se pudo eliminar el lote");
    return new Response(null, { status: 204 });
  } catch (error) {
    return json({ error: "Backend no alcanzable", detail: errorMessage(error) }, 502);
  }
};
