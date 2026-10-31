import type { APIRoute } from "astro";
import { forwardAuth } from "@/lib/authProxy";

// Crea la cuenta con el token de la invitación y deja la sesión iniciada.
export const POST: APIRoute = (context) =>
  forwardAuth(context, "/api/v1/auth/registro", ["token", "nombre", "password"]);
