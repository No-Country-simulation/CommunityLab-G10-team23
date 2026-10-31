import type { APIRoute } from "astro";
import { backendError, backendFetch, errorMessage, isDemo, json } from "@/lib/bff";

export const GET: APIRoute = async ({ params, locals }) => {
  if (isDemo()) return json({ error: "En modo demostración no hay paquetes guardados" }, 404);

  // En Astro el parámetro rest llega unido con "/" (en Next.js era un arreglo de segmentos).
  const path = params.slug ?? "";

  try {
    const response = await backendFetch(locals.token, `/api/v1/storage/packages/${encodeURIComponent(path)}`);
    if (!response.ok) return backendError(response, "Error al recuperar paquete desde OCI");
    return json(await response.json());
  } catch (error) {
    return json(
      { error: "No se pudo conectar con el backend de almacenamiento", detail: errorMessage(error) },
      502
    );
  }
};
