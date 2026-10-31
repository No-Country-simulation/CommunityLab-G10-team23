// Sesión del navegador (solo servidor): cookie httpOnly con el token opaco que emite FastAPI.

import type { AstroCookies } from "astro";
import { backendUrl, cookieSecure } from "@/lib/server/env";
import type { Usuario } from "@/types/auth";

export const SESSION_COOKIE = "cia_session";
// Igual que la vigencia máxima de la sesión en el backend; la inactividad la controla el backend.
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export function setSessionCookie(cookies: AstroCookies, token: string, url: URL) {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: cookieSecure(url),
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSessionCookie(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE, { path: "/" });
}

// Caché corta de /auth/me para no consultar al backend en cada página. Solo afecta a qué
// página se muestra: cada llamada al backend vuelve a validar el token.
const CACHE_MS = 30_000;
const CACHE_MAX = 500;
const cache = new Map<string, { user: Usuario; until: number }>();

export type SessionResult =
  | { status: "ok"; user: Usuario }
  | { status: "invalid" }
  | { status: "unavailable" };

export async function validateSession(token: string): Promise<SessionResult> {
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return { status: "ok", user: hit.user };

  try {
    const response = await fetch(`${backendUrl()}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401) {
      cache.delete(token);
      return { status: "invalid" };
    }
    if (!response.ok) return { status: "unavailable" };

    const user: Usuario = await response.json();
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(token, { user, until: Date.now() + CACHE_MS });
    return { status: "ok", user };
  } catch {
    return { status: "unavailable" };
  }
}

export function invalidateSession(token: string) {
  cache.delete(token);
}
