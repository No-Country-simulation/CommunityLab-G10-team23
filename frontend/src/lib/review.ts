import {
  ActivoCandidato,
  AssetCategory,
  EstadoAprobacion,
  ResultadoPipelineItem,
  ReviewTab,
  TipoActivoOficial,
} from "@/types/backend";

// Una fila de la tabla. En las pestañas de formato cada fila es un candidato;
// en "Todos", "Alertas" y "Descartadas" cada fila es una interacción.
export interface ReviewRow {
  key: string;
  item: ResultadoPipelineItem;
  candidato?: ActivoCandidato;
}

export const TABS: { key: ReviewTab; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "newsletter", label: "Newsletter" },
  { key: "faq", label: "FAQ" },
  { key: "alertas", label: "Alertas de soporte" },
];

export const TAB_TIPO: Partial<Record<ReviewTab, TipoActivoOficial>> = {
  linkedin: "post_linkedin",
  newsletter: "destaque_newsletter_semanal",
  faq: "sugerencia_contenido_faq",
};

export const STATUSES: EstadoAprobacion[] = ["pendiente", "aprobado", "rechazado"];

export const STATUS_LABELS: Record<EstadoAprobacion, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export const STATUS_PLURAL: Record<EstadoAprobacion, string> = {
  pendiente: "Pendientes",
  aprobado: "Aprobados",
  rechazado: "Rechazados",
};

export const STATUS_BADGE: Record<EstadoAprobacion, string> = {
  pendiente: "bg-amber-50 text-amber-800 ring-amber-200",
  aprobado: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rechazado: "bg-rose-50 text-rose-800 ring-rose-200",
};

export const STATUS_DOT: Record<EstadoAprobacion, string> = {
  pendiente: "bg-amber-500",
  aprobado: "bg-emerald-500",
  rechazado: "bg-rose-500",
};

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  SUCCESS_STORY: "Caso de éxito",
  FAQ: "Pregunta frecuente",
  EDUCATIONAL_CONTENT: "Contenido educativo",
  SOCIAL_POST: "Post social",
  COMMUNITY_HIGHLIGHT: "Destacado de comunidad",
  SUPPORT_ALERT: "Alerta de soporte",
  IGNORE: "Descartada",
};

interface FormatField {
  key: string;
  label: string;
  rows?: number; // con rows se edita como textarea
  readOnly?: boolean; // se muestra pero no se edita
}

// Solo se muestran estos campos; el resto del contenido (p. ej. potencial_engagement o status)
// se conserva intacto al guardar, porque el backend reemplaza `contenido` completo.

export const FORMATS: Record<
  TipoActivoOficial,
  { label: string; channel: string; fields: FormatField[] }
> = {
  post_linkedin: {
    label: "LinkedIn",
    channel: "LinkedIn",
    fields: [
      { key: "titulo", label: "Título" },
      { key: "copy", label: "Copy", rows: 10 },
      { key: "canal_recomendado", label: "Canal recomendado", readOnly: true },
    ],
  },
  destaque_newsletter_semanal: {
    label: "Newsletter",
    channel: "Newsletter",
    fields: [
      { key: "seccion", label: "Sección", readOnly: true },
      { key: "titular", label: "Titular" },
      { key: "resumen", label: "Resumen", rows: 10 },
    ],
  },
  sugerencia_contenido_faq: {
    label: "FAQ",
    channel: "FAQ",
    fields: [
      { key: "tema", label: "Tema", rows: 2 },
      { key: "origen", label: "Origen", readOnly: true },
    ],
  },
};

export function fieldText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function copyText(tipo: TipoActivoOficial, contenido: Record<string, any>): string {
  return FORMATS[tipo].fields
    .filter((f) => !f.readOnly)
    .map((f) => fieldText(contenido[f.key]))
    .filter(Boolean)
    .join("\n\n");
}

export function isDiscarded(item: ResultadoPipelineItem): boolean {
  return item.oportunidad?.categoria === "IGNORE" || item.enrutamiento?.ruta === "flujo.descartar";
}

export function isAlert(item: ResultadoPipelineItem): boolean {
  return (
    item.oportunidad?.categoria === "SUPPORT_ALERT" ||
    item.enrutamiento?.ruta === "equipo_c.revision_prioritaria"
  );
}

// Determina el estado primario y único de una fila para evitar que aparezca simultáneamente
// en 'Pendientes' y 'Aprobados'.
export function rowPrimaryStatus(row: ReviewRow): EstadoAprobacion {
  if (row.candidato) return row.candidato.estado_aprobacion;
  const statuses = row.item.activos_candidatos.map((c) => c.estado_aprobacion);
  if (statuses.length === 0) return "pendiente";
  if (statuses.includes("aprobado")) return "aprobado";
  if (statuses.every((s) => s === "rechazado")) return "rechazado";
  return "pendiente";
}

// Una fila pertenece a un único estado de revisión.
export function rowStatuses(row: ReviewRow): EstadoAprobacion[] {
  return [rowPrimaryStatus(row)];
}

export function rowsForTab(items: ResultadoPipelineItem[], tab: ReviewTab): ReviewRow[] {
  const active = items.filter((item) => !isDiscarded(item));
  const tipo = TAB_TIPO[tab];
  let rows: ReviewRow[];

  if (tipo) {
    rows = active.flatMap((item) =>
      item.activos_candidatos
        .filter((c) => c.tipo_activo === tipo)
        .map((c) => ({ key: c.candidato_id, item, candidato: c }))
    );
  } else if (tab === "alertas") {
    rows = active.filter(isAlert).map((item) => ({ key: item.interaccion.id, item }));
  } else {
    rows = active.map((item) => ({ key: item.interaccion.id, item }));
  }
  return sortByRelevance(rows);
}

export function discardedRows(items: ResultadoPipelineItem[]): ReviewRow[] {
  return sortByRelevance(
    items.filter(isDiscarded).map((item) => ({ key: item.interaccion.id, item }))
  );
}

function sortByRelevance(rows: ReviewRow[]): ReviewRow[] {
  return [...rows].sort(
    (a, b) => (b.item.oportunidad?.relevance_score ?? -1) - (a.item.oportunidad?.relevance_score ?? -1)
  );
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesSearch(row: ReviewRow, query: string): boolean {
  const q = normalize(query.trim());
  return !q || normalize(row.item.interaccion.autor).includes(q);
}
