// Límite de intentos fallidos por IP para login, registro y restablecimiento (solo servidor).
// El backend limita por correo; aquí se frena a quien prueba muchas cuentas desde una conexión.

import { trustProxy } from "@/lib/server/env";

const MAX_FALLOS = 20;
const VENTANA_MS = 15 * 60 * 1000;
const fallos = new Map<string, number[]>();

function recientes(ip: string, ahora: number): number[] {
  const lista = (fallos.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (lista.length) fallos.set(ip, lista);
  else fallos.delete(ip);
  return lista;
}

export const authLimiter = {
  blocked: (ip: string) => recientes(ip, Date.now()).length >= MAX_FALLOS,
  fail: (ip: string) => {
    const ahora = Date.now();
    fallos.set(ip, [...recientes(ip, ahora), ahora]);
  },
};

/** IP del cliente. X-Forwarded-For solo se acepta con TRUST_PROXY=true (detrás de un proxy propio). */
export function clientIp(request: Request, clientAddress: () => string): string {
  if (trustProxy()) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return clientAddress();
  } catch {
    return "desconocida";
  }
}

export const TOO_MANY = "Demasiados intentos fallidos desde tu conexión. Espera 15 minutos e inténtalo de nuevo.";
