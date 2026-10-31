// Utilidades de la vista de equipo: llamadas a /api/usuarios y formato de tarjetas.
import type { MouseEvent } from "react";
import { apiFetch } from "@/lib/client/api";
import type { RolUsuario } from "@/types/auth";

export const ROLES: RolUsuario[] = ["admin", "revisor", "lector"];

// Tonos pastel de las tarjetas [ref] (Dong): cada persona conserva el suyo entre visitas.
export const TONES = ["249 134 157", "166 139 249", "129 236 248", "240 144 249", "139 248 119", "251 195 182"];
export const toneFor = (key: string) => TONES[[...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TONES.length];

export const initials = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";

export const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/usuarios${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data as T;
}

// El halo de la tarjeta sigue al puntero (solo responde a la persona; nada se mueve solo).
export function trackSpot(event: MouseEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
}
