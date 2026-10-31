import type { APIRoute } from "astro";
import { backendError, backendFetch, errorMessage, json } from "@/lib/bff";

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
