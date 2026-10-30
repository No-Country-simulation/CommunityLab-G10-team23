import type { APIRoute } from "astro";
import { backendUrl, errorMessage, json } from "@/lib/bff";

export const GET: APIRoute = async () => {
  try {
    const res = await fetch(`${backendUrl()}/health`, {
      method: "GET",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      return json({ status: "online", backend: data });
    }
    return json({ status: "offline", error: "Backend responded with non-200" });
  } catch (err) {
    return json({ status: "offline", error: errorMessage(err) });
  }
};
