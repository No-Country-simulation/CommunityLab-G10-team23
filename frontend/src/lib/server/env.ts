// Configuración del servidor leída en cada petición (respeta el entorno del contenedor).

export const backendUrl = () => process.env.BACKEND_URL || "http://localhost:8000";

// Modo demostración: sin backend ni inicio de sesión, con datos simulados. Solo se activa
// a propósito (DEMO_MODE=true); un backend caído ya no pasa a simulación en silencio.
export const isDemo = () => process.env.DEMO_MODE === "true";

// Detrás de un proxy inverso con HTTPS (Caddy, load balancer) la app recibe HTTP:
// COOKIE_SECURE=true marca la cookie como Secure y TRUST_PROXY=true toma la IP de X-Forwarded-For.
export const cookieSecure = (url: URL) => process.env.COOKIE_SECURE === "true" || url.protocol === "https:";
export const trustProxy = () => process.env.TRUST_PROXY === "true";
