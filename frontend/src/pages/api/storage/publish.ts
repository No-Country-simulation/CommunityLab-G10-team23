import type { APIRoute } from "astro";
import type { SolicitudProcesamiento } from "@/types/backend";
import { backendUrl, errorMessage, json } from "@/lib/bff";

// Publica el lote consolidado en OCI Object Storage a través del backend (Equipo D).
export const POST: APIRoute = async ({ request }) => {
  let body: SolicitudProcesamiento;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "JSON inválido", detail: errorMessage(error) }, 400);
  }

  try {
    const response = await fetch(`${backendUrl()}/api/v1/storage/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(180000),
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      return json({ source: "fastapi", data });
    }

    return json({ error: "Error al publicar en OCI", detail: data?.detail ?? data }, response.status);
  } catch (error) {
    return json(
      { error: "No se pudo conectar con el backend de almacenamiento", detail: errorMessage(error) },
      502
    );
  }
};
