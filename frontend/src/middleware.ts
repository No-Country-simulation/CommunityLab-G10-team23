import { defineMiddleware } from "astro:middleware";
import { isDemo } from "@/lib/server/env";
import { SESSION_COOKIE, clearSessionCookie, validateSession } from "@/lib/server/session";
import type { Usuario } from "@/types/auth";

// Páginas y endpoints que no exigen sesión.
const PUBLIC_PAGES = new Set(["/login", "/registro", "/restablecer"]);
const PUBLIC_API = new Set([
  "/api/health",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/registro",
  "/api/auth/restablecer",
]);
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const DEMO_USER: Usuario = {
  id: "usr_demo",
  email: "demo@communityia.local",
  nombre: "Modo demostración",
  rol: "revisor",
  activo: true,
  creado_en: "1970-01-01T00:00:00Z",
};

// CSRF: además de la cookie SameSite=Strict, las peticiones que modifican datos deben venir
// de esta misma página. Se compara el host (no el protocolo) para funcionar detrás de un proxy HTTPS.
function sameOrigin(request: Request, url: URL): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
};

function withSecurityHeaders(response: Response, isApi: boolean): Response {
  try {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
    if (isApi) response.headers.set("Cache-Control", "no-store");
  } catch {
    // Algunas respuestas (redirecciones) tienen cabeceras inmutables.
  }
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, cookies, locals } = context;
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const isApi = path.startsWith("/api/");
  locals.user = null;
  locals.token = null;

  if (isApi && UNSAFE_METHODS.has(request.method) && !sameOrigin(request, url)) {
    return withSecurityHeaders(Response.json({ error: "Origen no permitido" }, { status: 403 }), true);
  }

  if (isDemo()) {
    locals.user = DEMO_USER;
    if (PUBLIC_PAGES.has(path)) return context.redirect("/");
    return withSecurityHeaders(await next(), isApi);
  }

  let backendDown = false;
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await validateSession(token);
    if (session.status === "ok") {
      locals.user = session.user;
      locals.token = token;
    } else if (session.status === "invalid") {
      clearSessionCookie(cookies);
    } else {
      backendDown = true;
    }
  }

  // "/" es la portada pública sin sesión y la aplicación con sesión (lo decide index.astro).
  if (path === "/") return withSecurityHeaders(await next(), false);

  if (PUBLIC_PAGES.has(path)) {
    if (locals.user && path === "/login") return context.redirect("/");
    return withSecurityHeaders(await next(), false);
  }
  if (PUBLIC_API.has(path)) return withSecurityHeaders(await next(), true);

  if (!locals.user) {
    if (isApi) {
      const body = backendDown
        ? { error: "No pudimos conectar con el servidor. Inténtalo de nuevo en unos minutos." }
        : { error: "Inicia sesión para continuar" };
      return withSecurityHeaders(Response.json(body, { status: backendDown ? 503 : 401 }), true);
    }
    const params = new URLSearchParams({ next: path + url.search });
    if (backendDown) params.set("motivo", "servidor");
    return context.redirect(`/login?${params}`);
  }

  return withSecurityHeaders(await next(), isApi);
});
