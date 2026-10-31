import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/storage/packages`, {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: "Error al listar paquetes desde OCI", detail: data?.detail ?? data },
      { status: response.status }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "No se pudo conectar con el backend de almacenamiento", detail: error.message },
      { status: 502 }
    );
  }
}
