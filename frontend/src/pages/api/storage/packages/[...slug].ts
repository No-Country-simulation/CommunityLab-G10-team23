import type { APIRoute } from "astro";
import { backendUrl, errorMessage, json } from "@/lib/bff";

export const GET: APIRoute = async ({ params }) => {
  // En Astro el parámetro rest llega unido con "/" (en Next.js era un arreglo de segmentos).
  const path = params.slug ?? "";

  try {
    const response = await fetch(`${backendUrl()}/api/v1/storage/packages/${encodeURIComponent(path)}`, {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      return json(data);
    }

    return json({ error: "Error al recuperar paquete desde OCI", detail: data?.detail ?? data }, response.status);
  } catch (error) {
    return json(
      { error: "No se pudo conectar con el backend de almacenamiento", detail: errorMessage(error) },
      502
    );
  }
};
