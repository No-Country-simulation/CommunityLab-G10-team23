import type { APIRoute } from "astro";
import { backendFetch, json } from "@/lib/server/bff";
import { SESSION_COOKIE, clearSessionCookie, invalidateSession } from "@/lib/server/session";

// Público a propósito: aunque la sesión ya no sea válida, siempre borra la cookie.
export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    invalidateSession(token);
    await backendFetch(token, "/api/v1/auth/logout", { method: "POST", signal: AbortSignal.timeout(5000) }).catch(
      () => null
    );
  }
  clearSessionCookie(cookies);
  return json({ ok: true });
};
