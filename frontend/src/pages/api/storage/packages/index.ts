import type { APIRoute } from "astro";
import { backendError, backendFetch, errorMessage, isDemo, json } from "@/lib/server/bff";

export const GET: APIRoute = async ({ locals }) => {
  // En modo demostración no hay paquetes guardados en OCI.
  if (isDemo()) return json({ status: "ok", total: 0, packages: [] });

  try {
    const response = await backendFetch(locals.token, "/api/v1/storage/packages");
    if (!response.ok) return backendError(response, "Error al listar paquetes desde OCI");
    return json(await response.json());
  } catch (error) {
    return json(
      { error: "No se pudo conectar con el backend de almacenamiento", detail: errorMessage(error) },
      502
    );
  }
};
