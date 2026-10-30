import type { APIRoute } from "astro";
import { backendUrl, errorMessage, json } from "@/lib/bff";

export const GET: APIRoute = async () => {
  try {
    const response = await fetch(`${backendUrl()}/api/v1/storage/packages`, {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (response.ok) {
      return json(data);
    }

    return json({ error: "Error al listar paquetes desde OCI", detail: data?.detail ?? data }, response.status);
  } catch (error) {
    return json(
      { error: "No se pudo conectar con el backend de almacenamiento", detail: errorMessage(error) },
      502
    );
  }
};
