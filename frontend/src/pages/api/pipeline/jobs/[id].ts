import type { APIRoute } from "astro";
import { backendUrl, errorMessage, json } from "@/lib/bff";

// Consulta el avance de un trabajo; `desde` limita la respuesta a las interacciones nuevas.
export const GET: APIRoute = async ({ params, url }) => {
  const id = params.id ?? "";
  const desde = url.searchParams.get("desde") ?? "0";

  try {
    const response = await fetch(
      `${backendUrl()}/api/v1/pipeline/jobs/${encodeURIComponent(id)}?desde=${encodeURIComponent(desde)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15000) }
    );
    const data = await response.json().catch(() => null);
    if (response.ok) {
      return json({ source: "fastapi", data });
    }
    return json({ error: "No se pudo consultar el trabajo", detail: data?.detail ?? data }, response.status);
  } catch (error) {
    return json({ error: "Backend no alcanzable", detail: errorMessage(error) }, 502);
  }
};
