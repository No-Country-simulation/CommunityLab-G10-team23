// Lectura del lote que sube el usuario y de los errores del BFF (sin React, se puede probar aislado).
import type { SolicitudProcesamiento } from "@/types/backend";

/** Mensaje legible a partir de la respuesta de error del BFF o de FastAPI. */
export function errorDetail(json: any, fallback: string): string {
  const detail = json?.detail ?? json?.error;
  if (typeof detail === "string") return detail;
  if (typeof detail?.mensaje === "string") return detail.mensaje;
  if (Array.isArray(detail)) return "el archivo no tiene el formato esperado";
  return fallback;
}

/** Valida y normaliza flexiblemente el archivo para cumplir el contrato SolicitudProcesamiento. */
export function parseBatch(text: string): SolicitudProcesamiento {
  let parsed: any;
  try {
    const cleanText = text.replace(/^\uFEFF/, "").trim();
    parsed = JSON.parse(cleanText);
  } catch (err: any) {
    throw new Error("No pudimos leer el archivo. Revisa que sea un archivo .json válido.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("No pudimos leer el archivo. Revisa que sea un archivo .json válido.");
  }

  if (parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)) {
    parsed = parsed.data;
  } else if (parsed.solicitud && typeof parsed.solicitud === "object" && !Array.isArray(parsed.solicitud)) {
    parsed = parsed.solicitud;
  }

  let rawInteractions: any[] = [];
  if (Array.isArray(parsed)) {
    rawInteractions = parsed;
  } else if (Array.isArray(parsed.interacciones)) {
    rawInteractions = parsed.interacciones;
  } else if (Array.isArray(parsed.items)) {
    rawInteractions = parsed.items.map((it: any) => it.interaccion || it);
  }

  if (!rawInteractions || rawInteractions.length === 0) {
    throw new Error("El archivo no tiene mensajes para revisar.");
  }
  if (rawInteractions.length > 500) {
    throw new Error("El archivo tiene más de 500 mensajes. Divídelo en partes más pequeñas y súbelas por separado.");
  }

  const invalid = rawInteractions.findIndex(
    (i: any) => !i || !["autor", "canal", "tipo", "texto"].every((k) => typeof i[k] === "string")
  );
  if (invalid !== -1) {
    throw new Error(`Al mensaje ${invalid + 1} le falta información: cada mensaje necesita autor, canal, tipo y texto.`);
  }

  const origen_comunidad =
    typeof parsed.origen_comunidad === "string" && parsed.origen_comunidad.trim()
      ? parsed.origen_comunidad.trim()
      : "Comunidad_General";
  const periodo_referencia =
    typeof parsed.periodo_referencia === "string" && parsed.periodo_referencia.trim()
      ? parsed.periodo_referencia.trim()
      : `Lote_${new Date().toISOString().slice(0, 10)}`;

  return {
    origen_comunidad,
    periodo_referencia,
    interacciones: rawInteractions,
  };
}
