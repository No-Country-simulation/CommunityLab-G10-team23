import type { APIRoute } from "astro";
import type { SolicitudProcesamiento, TrabajoPipeline } from "@/types/backend";
import { generateSimulatedPipeline } from "@/lib/simulation";
import { backendError, backendFetch, errorMessage, isDemo, json } from "@/lib/bff";

// Crea un trabajo en el backend; responde de inmediato y el avance se consulta en /api/pipeline/jobs/[id].
export const POST: APIRoute = async ({ request, locals }) => {
  let body: SolicitudProcesamiento;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "JSON inválido", detail: errorMessage(error) }, 400);
  }

  if (isDemo()) {
    // Modo demostración: el trabajo simulado se entrega ya completado.
    const simulated = generateSimulatedPipeline(body);
    const job: TrabajoPipeline = {
      job_id: "simulacion",
      estado: "completado",
      origen_comunidad: simulated.origen_comunidad,
      periodo_referencia: simulated.periodo_referencia,
      total: simulated.interacciones_procesadas.length,
      procesadas: simulated.interacciones_procesadas.length,
      desde: 0,
      interacciones_procesadas: simulated.interacciones_procesadas,
    };
    return json({ source: "simulation", data: job });
  }

  try {
    const response = await backendFetch(locals.token, "/api/v1/pipeline/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return backendError(response, "El servidor no pudo recibir el archivo");
    return json({ source: "fastapi", data: await response.json() });
  } catch (error) {
    return json({ error: "No pudimos conectar con el servidor", detail: errorMessage(error) }, 502);
  }
};
