import type { APIRoute } from "astro";
import { backendError, backendFetch, errorMessage, isDemo, json } from "@/lib/server/bff";

// Publica un lote revisado en OCI Object Storage (Equipo D). Solo admin; el backend toma
// las decisiones de revisión que tiene guardadas, así que basta con enviar el lote.
export const POST: APIRoute = async ({ request, locals }) => {
  if (isDemo()) {
    return json({ error: "En modo demostración los cambios no se guardan en OCI" }, 409);
  }

  let body: { lote_id?: string };
  try {
    body = await request.json();
  } catch (error) {
    return json({ error: "JSON inválido", detail: errorMessage(error) }, 400);
  }
  if (!body?.lote_id) return json({ error: "Falta el lote a publicar" }, 400);

  try {
    const response = await backendFetch(locals.token, "/api/v1/storage/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lote_id: body.lote_id }),
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
