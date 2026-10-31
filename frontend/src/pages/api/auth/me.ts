import type { APIRoute } from "astro";
import { json } from "@/lib/bff";

// El middleware ya validó la sesión; aquí solo se devuelve el usuario.
export const GET: APIRoute = ({ locals }) => json(locals.user);
