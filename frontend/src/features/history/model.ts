// Modelo del historial: forma de los paquetes guardados en OCI tal como los devuelve el BFF
// (/api/storage/packages) y utilidades de fecha para filtrar casos en la zona horaria local.

export interface CasoItem {
  interaccion: {
    id: string;
    autor: string;
    canal: string;
    tipo: string;
    texto: string;
    timestamp?: string;
  };
  analisis?: {
    sentimiento: string;
    sentimiento_score: number;
    temas: string[];
    entidades: string[];
    resumen: string;
    intencion: string;
  };
  oportunidad?: {
    categoria: string;
    relevance_score: number;
  };
  enrutamiento?: {
    ruta: string;
    motivo: string;
  };
  activos_candidatos?: Array<{
    candidato_id: string;
    tipo_activo: string;
    contenido: Record<string, any>;
    estado_aprobacion: string;
  }>;
  degradado?: boolean;
}

export interface PackageData {
  status: string;
  nombre_paquete?: string;
  periodo_referencia?: string;
  origen_comunidad?: string;
  fecha_guardado?: string;
  resumen_comunidad?: {
    total_interacciones_procesadas: number;
    sentimiento_predominante: string;
    temas_principales: string[];
  };
  activos_distribucion_generados?: {
    post_linkedin?: {
      titulo: string;
      copy: string;
      canal_recomendado: string;
      potencial_engagement: string;
    };
    destaque_newsletter_semanal?: {
      seccion: string;
      titular: string;
      resumen: string;
    };
    sugerencia_contenido_faq?: {
      tema: string;
      origen: string;
      status: string;
    };
  };
  casos?: CasoItem[];
}

export interface PackageSummary {
  nombre: string;
  periodo_referencia: string;
  ruta_objeto: string;
  tamano_bytes: number;
  fecha_creacion?: string;
  total_casos?: number;
  data?: PackageData;
}

export interface FlatCase extends CasoItem {
  paqueteNombre: string;
  paqueteFecha: string;
  paqueteFechaIso?: string;
  paqueteRuta: string;
  origenComunidad: string;
  periodoReferencia: string;
}

export type DateRangeOption = "todas" | "hoy" | "7dias" | "30dias" | "personalizado";
export type SortColumn = "index" | "fecha" | "autor" | "relevancia" | "sentimiento";
export type SortDirection = "asc" | "desc";

// Obtener fecha Date del caso en horario local
export function getCaseLocalDate(c: FlatCase): Date | null {
  if (c.interaccion?.timestamp) {
    const d = new Date(c.interaccion.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (c.paqueteFechaIso) {
    const d = new Date(c.paqueteFechaIso);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// Formatear una fecha en string YYYY-MM-DD según la zona horaria local del navegador
export function formatLocalYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatFechaLegible(fechaStr?: string): string {
  if (!fechaStr) return "";
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return fechaStr;
  }
}

/** Términos más frecuentes (temas y entidades) para la nube de palabras, como mucho 30. */
export function computeWordCloud(cases: FlatCase[]) {
  const counts: Record<string, number> = {};

  cases.forEach((c) => {
    const temas = c.analisis?.temas || [];
    const entidades = c.analisis?.entidades || [];
    [...temas, ...entidades].forEach((term) => {
      if (!term || typeof term !== "string") return;
      const clean = term.replace(/^#/, "").trim();
      if (clean.length < 2) return;
      const formatted = clean.charAt(0).toUpperCase() + clean.slice(1);
      counts[formatted] = (counts[formatted] || 0) + 1;
    });
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);

  const maxWeight = sorted[0]?.[1] || 1;
  return { list: sorted, maxWeight };
}

export type WordCloud = ReturnType<typeof computeWordCloud>;

/** Métricas del dashboard sobre los casos del período elegido. */
export function computeDashboardStats(cases: FlatCase[]) {
  const totalCasos = cases.length;
  let totalCandidatos = 0;
  let totalAprobados = 0;
  let totalRechazados = 0;

  let sumSentiment = 0;
  let sentimentCount = 0;
  const sentimientoCounts = { positivo: 0, neutral: 0, negativo: 0 };

  let sumRelevance = 0;
  const relevanceBuckets = { alta: 0, media: 0, baja: 0 };

  const channelStats = {
    post_linkedin: { total: 0, aprobados: 0, rechazados: 0 },
    destaque_newsletter_semanal: { total: 0, aprobados: 0, rechazados: 0 },
    sugerencia_contenido_faq: { total: 0, aprobados: 0, rechazados: 0 },
  };

  cases.forEach((c) => {
    const rel = c.oportunidad?.relevance_score ?? 0;
    sumRelevance += rel;
    if (rel >= 70) relevanceBuckets.alta++;
    else if (rel >= 40) relevanceBuckets.media++;
    else relevanceBuckets.baja++;

    if (c.analisis) {
      const sent = (c.analisis.sentimiento || "").toLowerCase();
      if (sent.includes("pos")) sentimientoCounts.positivo++;
      else if (sent.includes("neg")) sentimientoCounts.negativo++;
      else sentimientoCounts.neutral++;

      if (typeof c.analisis.sentimiento_score === "number") {
        sumSentiment += c.analisis.sentimiento_score;
        sentimentCount++;
      }
    }

    (c.activos_candidatos || []).forEach((cand) => {
      totalCandidatos++;
      if (cand.estado_aprobacion === "aprobado") totalAprobados++;
      else if (cand.estado_aprobacion === "rechazado") totalRechazados++;

      const ch = cand.tipo_activo as keyof typeof channelStats;
      if (channelStats[ch]) {
        channelStats[ch].total++;
        if (cand.estado_aprobacion === "aprobado") channelStats[ch].aprobados++;
        else if (cand.estado_aprobacion === "rechazado") channelStats[ch].rechazados++;
      }
    });
  });

  const avgSentiment =
    sentimentCount > 0 ? (sumSentiment / sentimentCount).toFixed(2) : "0.00";
  const avgRelevance =
    totalCasos > 0 ? (sumRelevance / totalCasos).toFixed(0) : "0";

  const tasaAprobacion =
    totalCandidatos > 0
      ? Math.round((totalAprobados / totalCandidatos) * 100)
      : 0;

  let sentimientoPredominante = "neutral";
  if (
    sentimientoCounts.positivo >= sentimientoCounts.neutral &&
    sentimientoCounts.positivo >= sentimientoCounts.negativo
  ) {
    sentimientoPredominante = "positivo";
  } else if (
    sentimientoCounts.negativo >= sentimientoCounts.neutral &&
    sentimientoCounts.negativo >= sentimientoCounts.positivo
  ) {
    sentimientoPredominante = "negativo";
  }

  return {
    totalCasos,
    totalCandidatos,
    totalAprobados,
    totalRechazados,
    tasaAprobacion,
    avgSentiment,
    avgRelevance,
    sentimientoPredominante,
    sentimientoCounts,
    relevanceBuckets,
    channelStats,
  };
}

export type DashboardStats = ReturnType<typeof computeDashboardStats>;
