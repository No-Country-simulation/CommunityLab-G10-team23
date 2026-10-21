import { NextResponse } from "next/server";
import { SolicitudProcesamiento } from "@/types/backend";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

// Publica el lote consolidado en OCI Object Storage a través del backend (Equipo D).
export async function POST(req: Request) {
  let body: SolicitudProcesamiento;
  try {
    body = await req.json();
  } catch (error: any) {
    return NextResponse.json({ error: "JSON inválido", detail: error.message }, { status: 400 });
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/storage/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      return NextResponse.json({ source: "fastapi", data });
    }

    return NextResponse.json(
      { error: "Error al publicar en OCI", detail: data?.detail ?? data },
      { status: response.status }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "No se pudo conectar con el backend de almacenamiento", detail: error.message },
      { status: 502 }
    );
  }
}
