import type { ReactNode } from "react";

// Gráficos del dashboard basados en Smart Charts Kit [figma:charts]. Solo representan datos
// que ya calcula HistoryView; los colores salen de los tokens --chart-* de global.css.

export type ChartColor = "violet" | "blue" | "yellow" | "green" | "red" | "orange";

const fill = (color: ChartColor) => ({ backgroundImage: `var(--chart-${color})` });

export function ChartCard({
  title,
  subtitle,
  badge,
  className = "",
  children,
}: {
  title: string;
  subtitle: string;
  badge?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`chart-card p-5 sm:p-6 flex flex-col gap-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <p className="text-sm text-ink-900/60">{subtitle}</p>
        </div>
        {badge && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand-100 text-brand-800 whitespace-nowrap">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

export interface Segment {
  label: string;
  value: number;
  color: ChartColor;
}

// Anillo segmentado (Chart 3): valor central grande y segmentos con separación.
export function RingChart({ segments, center, caption }: { segments: Segment[]; center: string; caption: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = 70;
  const c = 2 * Math.PI * r;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 4 : 0;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-44 h-44 shrink-0">
        <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90" aria-hidden="true">
          <defs>
            {segments.map((s) => (
              <linearGradient key={s.color} id={`ring-${s.color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" style={{ stopColor: `var(--chart-${s.color}-from)` }} />
                <stop offset="1" style={{ stopColor: `var(--chart-${s.color}-to)` }} />
              </linearGradient>
            ))}
          </defs>
          <circle cx="90" cy="90" r={r} fill="none" stroke="var(--color-chart-track)" strokeWidth="22" />
          {total > 0 &&
            segments.map((s) => {
              const len = (s.value / total) * c;
              const dash = Math.max(0, len - gap);
              const el = (
                <circle
                  key={s.label}
                  cx="90"
                  cy="90"
                  r={r}
                  fill="none"
                  stroke={`url(#ring-${s.color})`}
                  strokeWidth="22"
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return s.value > 0 ? el : null;
            })}
        </svg>
        <div className="absolute inset-[38px] rounded-full bg-white shadow-[0_5px_25px_rgb(0_0_0/0.1)] flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-medium text-chart-text leading-none">{center}</span>
          <span className="text-[11px] text-ink-500 mt-1">{caption}</span>
        </div>
      </div>
      <Legend segments={segments} total={total} />
    </div>
  );
}

function Legend({ segments, total }: { segments: Segment[]; total: number }) {
  return (
    <ul className="flex flex-col gap-2.5 w-full">
      {segments.map((s) => (
        <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 text-ink-900/80">
            <span className="w-3 h-3 rounded-full" style={fill(s.color)} />
            {s.label}
          </span>
          <span className="text-chart-text tabular-nums whitespace-nowrap">
            <span className="font-semibold">{s.value}</span>
            <span className="text-ink-500"> · {total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// Barras horizontales (Chart 12): etiqueta encima, pista redondeada y marca blanca al final.
export function BarList({ items, total }: { items: (Segment & { hint?: string })[]; total: number }) {
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => {
        const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
        return (
          <li key={item.label} className="flex flex-col gap-2">
            <div className="flex items-end justify-between gap-3 text-sm">
              <span>
                <span className="font-semibold text-ink-900">{item.label}</span>
                {item.hint && <span className="block text-xs text-ink-500">{item.hint}</span>}
              </span>
              <span className="text-chart-text tabular-nums whitespace-nowrap">
                <span className="font-semibold">{item.value}</span>
                <span className="text-ink-500"> · {pct}%</span>
              </span>
            </div>
            <div
              className="relative h-[22px] rounded-full bg-chart-track"
              role="img"
              aria-label={`${item.label}: ${item.value} (${pct}%)`}
            >
              {pct > 0 && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full border-[0.5px] border-white flex items-center justify-end pr-2 transition-[width] duration-500"
                  style={{ ...fill(item.color), width: `${Math.max(pct, 6)}%` }}
                >
                  <span className="w-[3px] h-2.5 rounded-full bg-white" />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Columnas apiladas (Chart 6): pista completa al 20% y segmentos apilados desde la base.
export function StackedColumns({
  columns,
  legend,
}: {
  columns: { label: string; segments: Segment[] }[];
  legend: { label: string; color: ChartColor }[];
}) {
  const max = Math.max(1, ...columns.map((col) => col.segments.reduce((sum, s) => sum + s.value, 0)));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-around gap-4 h-48">
        {columns.map((col) => {
          const total = col.segments.reduce((sum, s) => sum + s.value, 0);
          return (
            <div key={col.label} className="flex flex-col items-center gap-2 h-full">
              <span className="text-sm font-semibold text-chart-text tabular-nums">{total}</span>
              <div
                className="relative w-[35px] flex-1 rounded-[10px] bg-chart-track overflow-hidden flex flex-col-reverse"
                role="img"
                aria-label={`${col.label}: ${col.segments.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(", ")}`}
              >
                {col.segments.map((s) =>
                  s.value > 0 ? (
                    <div
                      key={s.label}
                      className="w-full rounded-[10px] transition-[height] duration-500"
                      style={{ ...fill(s.color), height: `${(s.value / max) * 100}%` }}
                      title={`${s.value} ${s.label.toLowerCase()}`}
                    />
                  ) : null
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-around gap-4 text-xs text-chart-text/70 -mt-2">
        {columns.map((col) => (
          <span key={col.label} className="w-20 text-center">
            {col.label}
          </span>
        ))}
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-ink-900/70">
        {legend.map((l) => (
          <li key={l.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={fill(l.color)} />
            {l.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
