import type { ReactNode } from "react";
import { Ban, CheckCircle2, Clock, Layers, XCircle } from "lucide-react";

export type ReviewFilter = "pendiente" | "aprobado" | "rechazado" | "descartado";
export type StatusCardKey = ReviewFilter | "todos";

// Colores sólidos por estado: las etiquetas de estado nunca usan degradados.
const STYLES: Record<StatusCardKey, { label: string; icon: ReactNode; chip: string; active: string; ring: string }> = {
  todos: {
    label: "Todos",
    icon: <Layers className="w-4 h-4" />,
    chip: "bg-brand-100 text-brand-800",
    active: "border-brand-600 bg-brand-50",
    ring: "bg-brand-600",
  },
  pendiente: {
    label: "Pendientes",
    icon: <Clock className="w-4 h-4" />,
    chip: "bg-warning-100 text-warning-800",
    active: "border-warning-500 bg-warning-50",
    ring: "bg-warning-500",
  },
  aprobado: {
    label: "Aprobados",
    icon: <CheckCircle2 className="w-4 h-4" />,
    chip: "bg-success-100 text-success-800",
    active: "border-success-600 bg-success-50",
    ring: "bg-success-600",
  },
  rechazado: {
    label: "Rechazados",
    icon: <XCircle className="w-4 h-4" />,
    chip: "bg-danger-100 text-danger-800",
    active: "border-danger-600 bg-danger-50",
    ring: "bg-danger-600",
  },
  descartado: {
    label: "Descartados",
    icon: <Ban className="w-4 h-4" />,
    chip: "bg-ink-100 text-ink-700",
    active: "border-ink-700 bg-ink-50",
    ring: "bg-ink-700",
  },
};

export interface StatusCardData<K extends StatusCardKey = StatusCardKey> {
  key: K;
  count: number;
  metric: string;
}

interface StatusCardsProps<K extends StatusCardKey> {
  cards: StatusCardData<K>[];
  active: K;
  onSelect: (key: K) => void;
}

// Tarjetas resumen seleccionables: cada una filtra la tabla por su estado de revisión.
export function StatusCards<K extends StatusCardKey>({ cards, active, onSelect }: StatusCardsProps<K>) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${cards.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4"}`} role="group" aria-label="Filtrar por estado de revisión">
      {cards.map((card) => {
        const st = STYLES[card.key];
        const selected = card.key === active;
        return (
          <button
            key={card.key}
            onClick={() => onSelect(card.key)}
            aria-pressed={selected}
            className={`relative text-left rounded-2xl border-2 p-4 transition cursor-pointer flex flex-col gap-3 ${
              selected ? st.active : "border-ink-200 bg-surface hover:border-ink-300 hover:shadow-[0_5px_25px_rgb(0_0_0/0.06)]"
            }`}
          >
            {selected && (
              <span className={`absolute top-3 right-3 w-5 h-5 rounded-full text-white flex items-center justify-center ${st.ring}`}>
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 self-start text-xs font-semibold px-2.5 py-1 rounded-full ${st.chip}`}>
              {st.icon}
              {st.label}
            </span>
            <span className="text-3xl font-semibold text-ink-900 leading-none tabular-nums">{card.count}</span>
            <span className="text-xs text-ink-500">{card.metric}</span>
          </button>
        );
      })}
    </div>
  );
}
