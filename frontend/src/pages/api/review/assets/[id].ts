import type { APIRoute } from "astro";
import { backendUrl, errorMessage, json } from "@/lib/bff";

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const id = params.id ?? "";
    const body = await request.json();

    // Si el ID es un candidato simulado / de prueba local (no proviene de la BD de FastAPI)
    const isSimulatedId =
      id.startsWith("cand_news_") ||
      id.startsWith("cand_ln_") ||
      id.startsWith("cand_faq_") ||
      id.startsWith("cand_comm_") ||
      id.startsWith("cand_nl_") ||
      id.includes("_sim") ||
      !/^cand_[0-9a-f]{32}$/i.test(id);

    if (isSimulatedId) {
      return json({
        source: "simulation",
        status: body.estado_aprobacion || "aprobado",
        candidato_id: id,
        message: `Candidato de demostración ${id} procesado localmente`,
      });
    }

    try {
      const response = await fetch(`${backendUrl()}/api/v1/review/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        return json({ source: "fastapi", data });
      }
    } catch (fastApiErr) {
      console.warn("FastAPI review endpoint no alcanzable, confirmando en modo local:", fastApiErr);
    }

    // Fallback si backend está offline o no lo encontró
    return json({
      source: "simulation",
      status: body.estado_aprobacion || "aprobado",
      candidato_id: id,
      message: `Candidato ${id} aprobado localmente`,
    });
  } catch (error) {
    return json({ error: "Error en actualización de activo", detail: errorMessage(error) }, 500);
  }
};
