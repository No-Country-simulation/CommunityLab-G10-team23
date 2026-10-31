export type AssetCategory =
  | "SUCCESS_STORY"
  | "FAQ"
  | "EDUCATIONAL_CONTENT"
  | "SOCIAL_POST"
  | "COMMUNITY_HIGHLIGHT"
  | "SUPPORT_ALERT"
  | "IGNORE";

export type TipoActivoOficial =
  | "post_linkedin"
  | "destaque_newsletter_semanal"
  | "sugerencia_contenido_faq";

export type EstadoAprobacion = "pendiente" | "aprobado" | "rechazado";

export interface InteraccionEntrada {
  autor: string;
  canal: string;
  tipo: string;
  texto: string;
}

export interface SolicitudProcesamiento {
  origen_comunidad: string;
  periodo_referencia: string;
  interacciones: InteraccionEntrada[];
}

export interface AnalisisInterno {
  sentimiento: string;
  sentimiento_score: number;
  temas: string[];
  entidades: string[];
  resumen: string;
  intencion: string;
}

export interface OportunidadInterna {
  categoria: AssetCategory;
  relevance_score: number;
}

export interface EnrutamientoInterno {
  ruta: string;
  motivo: string;
}

/** Quién hizo algo y cuándo; lo sella el backend con la sesión, nunca lo envía el cliente. */
export interface Autoria {
  usuario_id: string;
  nombre: string;
  en: string;
}

export interface ActivoCandidato {
  candidato_id: string;
  tipo_activo: TipoActivoOficial;
  contenido: Record<string, any>;
  estado_aprobacion: EstadoAprobacion;
  revisado_por?: Autoria | null;
  /** Versión que vio el revisor; el backend responde 409 si otra persona lo cambió después. */
  version?: number;
}

export interface ResultadoPipelineItem {
  interaccion: {
    id: string;
    autor: string;
    canal: string;
    tipo: string;
    texto: string;
    timestamp: string;
  };
  analisis: AnalisisInterno;
  oportunidad?: OportunidadInterna | null;
  enrutamiento?: EnrutamientoInterno | null;
  activos_candidatos: ActivoCandidato[];
  error?: string | null;
  degradado?: boolean;
}

export interface ResultadoPipeline {
  origen_comunidad: string;
  periodo_referencia: string;
  interacciones_procesadas: ResultadoPipelineItem[];
}

export type EstadoTrabajo = "en_cola" | "en_proceso" | "completado" | "fallido";

export interface TrabajoPipeline {
  job_id: string;
  estado: EstadoTrabajo;
  origen_comunidad: string;
  periodo_referencia: string;
  total: number;
  procesadas: number;
  desde: number;
  interacciones_procesadas: ResultadoPipelineItem[];
  error?: string | null;
  creado_por?: Autoria | null;
  publicado_por?: Autoria | null;
}

/** Fila del listado de lotes del equipo (GET /pipeline/jobs). */
export interface ResumenLote {
  job_id: string;
  estado: EstadoTrabajo;
  origen_comunidad: string;
  periodo_referencia: string;
  total: number;
  procesadas: number;
  creado_por: Autoria;
  publicado_por?: Autoria | null;
  activos_pendientes: number;
  activos_aprobados: number;
  activos_rechazados: number;
}

// Vista de revisión (solo frontend)
export type ReviewTab = "todos" | "linkedin" | "newsletter" | "faq" | "alertas";
