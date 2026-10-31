import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Consulta el avance de un trabajo; `desde` limita la respuesta a las interacciones nuevas.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const desde = new URL(req.url).searchParams.get("desde") ?? "0";

  try {
    const response = await fetch(
      `${BACKEND_URL}/api/v1/pipeline/jobs/${encodeURIComponent(id)}?desde=${encodeURIComponent(desde)}`,
      { cache: "no-store", signal: AbortSignal.timeout(15000) }
    );
    const data = await response.json().catch(() => null);
    if (response.ok) {
      return NextResponse.json({ source: "fastapi", data });
    }
    return NextResponse.json(
      { error: "No se pudo consultar el trabajo", detail: data?.detail ?? data },
      { status: response.status }
    );
  } catch (error: any) {
    return NextResponse.json({ error: "Backend no alcanzable", detail: error.message }, { status: 502 });
  }
}
