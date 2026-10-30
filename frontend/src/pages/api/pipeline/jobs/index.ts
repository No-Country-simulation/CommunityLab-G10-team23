import type { APIRoute } from "astro";
import type { SolicitudProcesamiento, TrabajoPipeline } from "@/types/backend";
import { generateSimulatedPipeline } from "@/lib/simulation";
import { backendUrl, errorMessage, json } from "@/lib/bff";

// Crea un trabajo en el backend; responde de inmediato y el avance se consulta en /api/pipeline/jobs/[id].
export const POST: APIRoute = async ({ request }) => {
  let body: SolicitudProcesamiento;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "JSON inválido", detail: errorMessage(error) }, 400);
  }

  try {
    const response = await fetch(`${backendUrl()}/api/v1/pipeline/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      return json({ source: "fastapi", data });
    }
    // Un lote rechazado por el backend (p. ej. 422) no se simula: se informa el error.
    if (response.status < 500) {
      return json({ error: "El backend rechazó el lote", detail: data?.detail ?? data }, response.status);
    }
    console.warn(`FastAPI respondió ${response.status} al crear el trabajo, usando simulación`);
  } catch (error) {
    console.warn("FastAPI no alcanzable al crear el trabajo, usando simulación:", errorMessage(error));
  }

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
};
