import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";

// Panel de detalle compartido por la bandeja de revisión y el historial: misma estructura
// (cabecera, dos columnas, pie) y mismos bloques; cada contexto aporta sus acciones.

type Estado = "pendiente" | "aprobado" | "rechazado" | string;

const ESTADO_PILL: Record<string, string> = {
  aprobado: "bg-success-100 text-success-800",
  rechazado: "bg-danger-100 text-danger-800",
  pendiente: "bg-warning-100 text-warning-800",
};

const ESTADO_DOT: Record<string, string> = {
  aprobado: "bg-success-400",
  rechazado: "bg-danger-400",
  pendiente: "bg-warning-300 animate-pulse",
};

interface DetailPanelProps {
  icon: ReactNode;
  autor: string;
  canal: string;
  subtitle: string;
  headerActions?: ReactNode;
  footer: ReactNode;
  onRequestClose: () => void;
  children: ReactNode;
}

export function DetailPanel({
  icon,
  autor,
  canal,
  subtitle,
  headerActions,
  footer,
  onRequestClose,
  children,
}: DetailPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onRequestClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onRequestClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-panel-title"
        className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] border border-ink-200"
      >
        <div className="px-4 sm:px-6 py-4 border-b border-ink-200 flex flex-wrap items-center justify-between gap-3 bg-ink-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2 rounded-xl bg-brand-50 text-brand-700 shrink-0">{icon}</span>
            <div className="min-w-0">
              <h2 id="detail-panel-title" className="text-sm font-bold text-ink-900 flex flex-wrap items-center gap-2">
                <span>{autor}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-ink-200 text-ink-700 font-mono font-normal">{canal}</span>
              </h2>
              <p className="text-xs text-ink-500">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {headerActions}
            <button
              ref={closeRef}
              onClick={onRequestClose}
              className="p-1.5 rounded-lg text-ink-500 hover:text-ink-700 hover:bg-ink-100 transition cursor-pointer ml-1"
              aria-label="Cerrar"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>

        <div className="px-4 sm:px-6 py-3 border-t border-ink-200 bg-ink-50 flex flex-wrap items-center gap-2">{footer}</div>
      </div>
    </div>
  );
}

export function DetailColumns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-ink-200">
      <div className="p-4 sm:p-6 space-y-5 bg-ink-50/40">{left}</div>
      <div className="p-4 sm:p-6 space-y-5 min-w-0">{right}</div>
    </div>
  );
}

export function PanelTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-500">{children}</h3>;
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
      {children}
    </label>
  );
}

export function EstadoPill({ estado, label }: { estado: Estado; label?: string }) {
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize ${ESTADO_PILL[estado] ?? ESTADO_PILL.pendiente}`}>
      {label ?? estado}
    </span>
  );
}

export interface ChannelTab {
  id: string;
  label: string;
  estado: Estado;
  dirty?: boolean;
}

export function ChannelTabs({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: ChannelTab[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-200 pb-3" role="tablist">
      {tabs.map((t) => {
        const selected = t.id === activeId;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(t.id)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-2 ${
              selected ? "bg-brand-600 text-white shadow-xs" : "bg-ink-100 text-ink-700 hover:bg-ink-200"
            }`}
          >
            <span>{t.label}</span>
            <span className={`w-2 h-2 rounded-full ${ESTADO_DOT[t.estado] ?? ESTADO_DOT.pendiente}`} title={`Estado: ${t.estado}`} />
            {t.dirty && <span className={selected ? "text-brand-100" : "text-brand-600"} title="Cambios sin guardar">•</span>}
          </button>
        );
      })}
    </div>
  );
}

interface InteractionSummaryProps {
  texto: string;
  tipoNote: string;
  fecha?: string;
  alerts?: string[];
  analisis?: { sentimiento: string; sentimiento_score: number; temas: string[]; entidades: string[]; resumen: string } | null;
  categoria: string;
  relevancia: string;
  motivo?: string | null;
}

// Columna izquierda: interacción original, análisis de la IA y clasificación.
export function InteractionSummary({ texto, tipoNote, fecha, alerts, analisis, categoria, relevancia, motivo }: InteractionSummaryProps) {
  const sentimiento = analisis?.sentimiento || "neutral";
  const score = analisis?.sentimiento_score;
  return (
    <>
      {alerts && alerts.length > 0 && (
        <div className="flex gap-2 text-xs text-warning-900 bg-warning-50 ring-1 ring-warning-200 rounded-xl p-3">
          <AlertTriangle className="w-4 h-4 shrink-0 text-warning-600" />
          <div className="space-y-1">
            {alerts.map((a) => (
              <p key={a}>{a}</p>
            ))}
          </div>
        </div>
      )}

      <section className="space-y-2">
        <PanelTitle>Interacción original</PanelTitle>
        <blockquote className="p-3.5 bg-white border border-ink-200 rounded-xl text-xs text-ink-800 leading-relaxed shadow-2xs whitespace-pre-wrap">
          {texto}
        </blockquote>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-500 pt-0.5">
          {fecha && <span>{fecha}</span>}
        </div>
      </section>

      <section className="space-y-3 pt-1 border-t border-ink-200">
        <PanelTitle>Análisis IA</PanelTitle>
        <div>
          <span className="text-xs text-ink-500 block mb-1 font-medium">Sentimiento</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                sentimiento.includes("pos")
                  ? "bg-success-100 text-success-800"
                  : sentimiento.includes("neg")
                  ? "bg-danger-100 text-danger-800"
                  : "bg-ink-100 text-ink-700"
              }`}
            >
              {sentimiento}
            </span>
            <span className="text-xs text-ink-500 font-mono">
              ({typeof score === "number" ? (score >= 0 ? `+${score.toFixed(2)}` : score.toFixed(2)) : "0.00"})
            </span>
          </div>
        </div>
        <ChipList label="Temas" values={analisis?.temas ?? []} empty="Sin temas identificados" prefix="#" />
        <ChipList label="Entidades" values={analisis?.entidades ?? []} empty="Sin entidades" accent />
        {analisis?.resumen && <TextBox label="Resumen">{analisis.resumen}</TextBox>}
      </section>

      <section className="space-y-3 pt-1 border-t border-ink-200">
        <PanelTitle>Clasificación</PanelTitle>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-ink-500 block mb-1 font-medium">Categoría</span>
            <span className="text-xs font-bold text-ink-800 bg-white px-2.5 py-1 rounded-lg border border-ink-200 block truncate">
              {categoria}
            </span>
          </div>
          <div>
            <span className="text-xs text-ink-500 block mb-1 font-medium">Relevancia</span>
            <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200 block">
              {relevancia}
            </span>
          </div>
        </div>
        {motivo && <TextBox label="Motivo">{motivo}</TextBox>}
      </section>
    </>
  );
}

function ChipList({
  label,
  values,
  empty,
  prefix = "",
  accent,
}: {
  label: string;
  values: string[];
  empty: string;
  prefix?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <span className="text-xs text-ink-500 block mb-1 font-medium">{label}</span>
      <div className="flex flex-wrap gap-1">
        {values.length > 0 ? (
          values.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${
                accent ? "bg-brand-50 border-brand-100 text-brand-700" : "bg-white border-ink-200 text-ink-700"
              }`}
            >
              {prefix}
              {v}
            </span>
          ))
        ) : (
          <span className="text-xs text-ink-500 italic">{empty}</span>
        )}
      </div>
    </div>
  );
}

function TextBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="text-xs text-ink-500 block mb-1 font-medium">{label}</span>
      <p className="text-xs text-ink-600 bg-white p-2.5 rounded-lg border border-ink-200 leading-relaxed">{children}</p>
    </div>
  );
}
