import type { APIRoute } from "astro";
import { forwardAuth } from "@/lib/authProxy";

// Cambia la contraseña con el token de recuperación; el backend cierra las sesiones abiertas.
export const POST: APIRoute = (context) => forwardAuth(context, "/api/v1/auth/restablecer", ["token", "password"]);
