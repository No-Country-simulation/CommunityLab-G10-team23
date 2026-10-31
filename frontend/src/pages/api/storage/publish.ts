import type { APIRoute } from "astro";
import type { SolicitudProcesamiento } from "@/types/backend";
import { backendError, backendFetch, errorMessage, isDemo, json } from "@/lib/bff";

// Publica el lote consolidado en OCI Object Storage a través del backend (Equipo D).
export const POST: APIRoute = async ({ request, locals }) => {
  if (isDemo()) {
    return json({ error: "En modo demostración los cambios no se guardan en OCI" }, 409);
  }

  let body: SolicitudProcesamiento;
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "JSON inválido", detail: errorMessage(error) }, 400);
  }

  try {
    const response = await backendFetch(locals.token, "/api/v1/storage/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180000),
    });
    if (!response.ok) return backendError(response, "Error al publicar en OCI");
    return json({ source: "fastapi", data: await response.json() });
  } catch (error) {
    return json(
      { error: "No se pudo conectar con el backend de almacenamiento", detail: errorMessage(error) },
      502
    );
  }
};
