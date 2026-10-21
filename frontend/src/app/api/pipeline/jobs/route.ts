import { NextResponse } from "next/server";
import { SolicitudProcesamiento, TrabajoPipeline } from "@/types/backend";
import { generateSimulatedPipeline } from "@/lib/simulation";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Crea un trabajo en el backend; responde de inmediato y el avance se consulta en /api/pipeline/jobs/[id].
export async function POST(req: Request) {
  let body: SolicitudProcesamiento;
  try {
    body = await req.json();
  } catch (error: any) {
    return NextResponse.json({ error: "JSON inválido", detail: error.message }, { status: 400 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/pipeline/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      return NextResponse.json({ source: "fastapi", data });
    }
    // Un lote rechazado por el backend (p. ej. 422) no se simula: se informa el error.
    if (response.status < 500) {
      return NextResponse.json(
        { error: "El backend rechazó el lote", detail: data?.detail ?? data },
        { status: response.status }
      );
    }
    console.warn(`FastAPI respondió ${response.status} al crear el trabajo, usando simulación`);
  } catch (error: any) {
    console.warn("FastAPI no alcanzable al crear el trabajo, usando simulación:", error.message);
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
  return NextResponse.json({ source: "simulation", data: job });
}
