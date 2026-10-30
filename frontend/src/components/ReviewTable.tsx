import React, { useEffect, useRef, useState } from "react";
import { MoreVertical, Eye, Check, X, Clock, AlertTriangle } from "lucide-react";
import type { ActivoCandidato, EstadoAprobacion, ResultadoPipelineItem } from "@/types/backend";
import {
  CATEGORY_LABELS,
  FORMATS,
  isAlert,
  type ReviewRow,
  STATUS_BADGE,
  STATUS_DOT,
  STATUS_LABELS,
} from "@/lib/review";

export type TableMode = "formato" | "todos" | "motivo";

interface ReviewTableProps {
  rows: ReviewRow[];
  mode: TableMode;
  savingId: string | null;
  selectedKey?: string | null;
  onOpen: (row: ReviewRow) => void;
  onSetStatus: (item: ResultadoPipelineItem, candidato: ActivoCandidato, status: EstadoAprobacion) => void;
}

const LAST_COLUMN: Record<TableMode, string> = {
  formato: "Estado",
  todos: "Formatos",
  motivo: "Motivo",
};

export function ReviewTable({ rows, mode, savingId, selectedKey, onOpen, onSetStatus }: ReviewTableProps) {
  const [menu, setMenu] = useState<{ row: ReviewRow; top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onMouseDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, row: ReviewRow) => {
    e.stopPropagation();
    if (menu?.row.key === row.key) {
      setMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 170;
    const top = rect.bottom + menuHeight > window.innerHeight ? rect.top - menuHeight : rect.bottom + 4;
    setMenu({ row, top, left: rect.right - 192 });
  };

  return (
    <>
      <table className="data-table w-full min-w-[880px] text-sm">
        <thead className="sticky top-0 z-10">
          <tr>
            {["Autor", "Canal", "Mensaje", "Categoría", "Relevancia", LAST_COLUMN[mode]].map((h) => (
              <th key={h} className="text-left">
                {h}
              </th>
            ))}
            <th className="w-14" aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { item, candidato } = row;
            const category = item.oportunidad?.categoria;
            const score = item.oportunidad?.relevance_score;
            const problem = item.error || (item.degradado ? "Análisis degradado: la IA no respondió y se usó un resultado neutral." : null);

            return (
              <tr
                key={row.key}
                onClick={() => onOpen(row)}
                data-selected={menu?.row.key === row.key || selectedKey === row.key}
                className="cursor-pointer"
              >
                <td className="font-medium text-ink-800 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    {item.interaccion.autor}
                    {problem && (
                      <span title={problem}>
                        <AlertTriangle className="w-3.5 h-3.5 text-warning-500" aria-label={problem} />
                      </span>
                    )}
                  </span>
                </td>
                <td className="text-ink-500 whitespace-nowrap">
                  {item.interaccion.canal}
                </td>
                <td className="text-ink-600 max-w-[360px]">
                  <span className="line-clamp-1">{item.interaccion.texto}</span>
                </td>
                <td className="text-ink-600 whitespace-nowrap">
                  {category ? CATEGORY_LABELS[category] : <span className="text-ink-500">Sin clasificar</span>}
                </td>
                <td className="whitespace-nowrap">
                  {score !== undefined ? <RelevanceBar score={score} /> : <span className="text-ink-500">—</span>}
                </td>
                <td>
                  {mode === "formato" && candidato && <StatusBadge status={candidato.estado_aprobacion} />}
                  {mode === "todos" && <FormatChips item={item} />}
                  {mode === "motivo" && (
                    <span className="text-xs text-ink-500 line-clamp-2">{item.enrutamiento?.motivo ?? "—"}</span>
                  )}
                </td>
                <td className="text-right">
                  <button
                    onClick={(e) => openMenu(e, row)}
                    className="table-action"
                    aria-label={`Acciones para ${item.interaccion.autor}`}
                    aria-haspopup="menu"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          style={{ top: menu.top, left: Math.max(8, menu.left) }}
          className="fixed z-40 w-48 bg-white rounded-lg shadow-xl ring-1 ring-ink-200 py-1 text-sm"
        >
          <MenuItem
            icon={<Eye className="w-4 h-4" />}
            label="Ver detalle"
            onClick={() => {
              setMenu(null);
              onOpen(menu.row);
            }}
          />
          {menu.row.candidato && (
            <>
              <div className="my-1 border-t border-ink-100" />
              {(
                [
                  ["aprobado", "Aprobar", <Check key="a" className="w-4 h-4 text-success-600" />],
                  ["rechazado", "Rechazar", <X key="r" className="w-4 h-4 text-danger-600" />],
                  ["pendiente", "Marcar pendiente", <Clock key="p" className="w-4 h-4 text-warning-600" />],
                ] as const
              )
                .filter(([status]) => status !== menu.row.candidato!.estado_aprobacion)
                .map(([status, label, icon]) => (
                  <MenuItem
                    key={status}
                    icon={icon}
                    label={label}
                    disabled={savingId === menu.row.candidato!.candidato_id}
                    onClick={() => {
                      setMenu(null);
                      onSetStatus(menu.row.item, menu.row.candidato!, status);
                    }}
                  />
                ))}
            </>
          )}
        </div>
      )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-ink-700 hover:bg-ink-100 disabled:opacity-40 cursor-pointer"
    >
      {icon}
      {label}
    </button>
  );
}

export function StatusBadge({ status }: { status: EstadoAprobacion }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${STATUS_BADGE[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function RelevanceBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-success-500" : score >= 50 ? "bg-brand-500" : "bg-ink-400";
  return (
    <span className="flex items-center gap-2">
      <span className="w-16 h-1.5 rounded-full bg-ink-200 overflow-hidden">
        <span className={`block h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </span>
      <span className="text-xs tabular-nums text-ink-600">{Math.round(score)}</span>
    </span>
  );
}

function FormatChips({ item }: { item: ResultadoPipelineItem }) {
  if (item.activos_candidatos.length === 0) {
    return isAlert(item) ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-warning-50 text-warning-800 ring-1 ring-warning-200">
        <AlertTriangle className="w-3 h-3" /> Alerta
      </span>
    ) : (
      <span className="text-xs text-ink-500">Sin contenido</span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {item.activos_candidatos.map((c) => (
        <span
          key={c.candidato_id}
          title={STATUS_LABELS[c.estado_aprobacion]}
          className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-ink-100 text-ink-700"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.estado_aprobacion]}`} />
          {FORMATS[c.tipo_activo].label}
        </span>
      ))}
    </span>
  );
}
