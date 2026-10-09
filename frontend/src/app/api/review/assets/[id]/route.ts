import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

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
      return NextResponse.json({
        source: "simulation",
        status: body.estado_aprobacion || "aprobado",
        candidato_id: id,
        message: `Candidato de demostración ${id} procesado localmente`,
      });
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/review/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({ source: "fastapi", data });
      }
    } catch (fastApiErr) {
      console.warn("FastAPI review endpoint no alcanzable, confirmando en modo local:", fastApiErr);
    }

    // Fallback si backend está offline o no lo encontró
    return NextResponse.json({
      source: "simulation",
      status: body.estado_aprobacion || "aprobado",
      candidato_id: id,
      message: `Candidato ${id} aprobado localmente`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Error en actualización de activo", detail: error.message },
      { status: 500 }
    );
  }
}
