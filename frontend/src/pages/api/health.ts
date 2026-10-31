import type { APIRoute } from "astro";
import { backendUrl, errorMessage, isDemo, json } from "@/lib/server/bff";

// Público: la barra lateral lo usa para mostrar si hay conexión con el backend.
export const GET: APIRoute = async () => {
  if (isDemo()) return json({ status: "demo" });
  try {
    const res = await fetch(`${backendUrl()}/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return json({ status: "online", backend: await res.json() });
    }
    return json({ status: "offline", error: "Backend responded with non-200" });
  } catch (err) {
    return json({ status: "offline", error: errorMessage(err) });
  }
};
