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

export interface ActivoCandidato {
  candidato_id: string;
  tipo_activo: TipoActivoOficial;
  contenido: Record<string, any>;
  estado_aprobacion: EstadoAprobacion;
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

export type AssetCategoryKey = "linkedin" | "newsletter" | "faq" | "testimonios";

export interface PublicationCard {
  id: string;
  candidato_id?: string;
  tipo_activo: TipoActivoOficial | "testimonio_comunidad";
  titulo: string;
  enfoque: string;
  contenido: string;
  plataforma: AssetCategoryKey;
  estado_aprobacion: EstadoAprobacion;
  relevance_score?: number;
  autor_origen?: string;
  canal_origen?: string;
  detalles?: {
    potencial_engagement?: string;
    canal_recomendado?: string;
    seccion_newsletter?: string;
    tema_faq?: string;
    status_faq?: string;
  };
}
