import type { APIRoute } from "astro";
import { forwardAuth } from "@/lib/server/authProxy";

export const POST: APIRoute = (context) => forwardAuth(context, "/api/v1/auth/login", ["email", "password"]);
