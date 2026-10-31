"use client";

import React, { useEffect, useRef, useState } from "react";
import { MoreVertical, Eye, Check, X, Clock, AlertTriangle } from "lucide-react";
import { ActivoCandidato, EstadoAprobacion, ResultadoPipelineItem } from "@/types/backend";
import {
  CATEGORY_LABELS,
  FORMATS,
  isAlert,
  ReviewRow,
  STATUS_BADGE,
  STATUS_DOT,
  STATUS_LABELS,
} from "@/lib/review";

export type TableMode = "formato" | "todos" | "motivo";

interface ReviewTableProps {
  rows: ReviewRow[];
  mode: TableMode;
  savingId: string | null;
  onOpen: (row: ReviewRow) => void;
  onSetStatus: (item: ResultadoPipelineItem, candidato: ActivoCandidato, status: EstadoAprobacion) => void;
}

const LAST_COLUMN: Record<TableMode, string> = {
  formato: "Estado",
  todos: "Formatos",
  motivo: "Motivo",
};

export function ReviewTable({ rows, mode, savingId, onOpen, onSetStatus }: ReviewTableProps) {
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
      <table className="w-full min-w-[880px] text-sm border-separate border-spacing-0">
        <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            {["Autor", "Canal", "Mensaje", "Categoría", "Relevancia", LAST_COLUMN[mode]].map((h) => (
              <th key={h} className="text-left font-semibold px-4 py-2.5 border-b border-slate-200">
                {h}
              </th>
            ))}
            <th className="w-12 border-b border-slate-200" aria-label="Acciones" />
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
                className={`cursor-pointer hover:bg-indigo-50/50 ${menu?.row.key === row.key ? "bg-indigo-50/50" : ""}`}
              >
                <td className="px-4 py-3 border-b border-slate-100 font-medium text-slate-800 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    {item.interaccion.autor}
                    {problem && (
                      <span title={problem}>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-label={problem} />
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 border-b border-slate-100 text-slate-500 whitespace-nowrap">
                  {item.interaccion.canal}
                </td>
                <td className="px-4 py-3 border-b border-slate-100 text-slate-600 max-w-[360px]">
                  <span className="line-clamp-1">{item.interaccion.texto}</span>
                </td>
                <td className="px-4 py-3 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                  {category ? CATEGORY_LABELS[category] : <span className="text-slate-400">Sin clasificar</span>}
                </td>
                <td className="px-4 py-3 border-b border-slate-100 whitespace-nowrap">
                  {score !== undefined ? <RelevanceBar score={score} /> : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 border-b border-slate-100">
                  {mode === "formato" && candidato && <StatusBadge status={candidato.estado_aprobacion} />}
                  {mode === "todos" && <FormatChips item={item} />}
                  {mode === "motivo" && (
                    <span className="text-xs text-slate-500 line-clamp-2">{item.enrutamiento?.motivo ?? "—"}</span>
                  )}
                </td>
                <td className="px-2 py-3 border-b border-slate-100 text-right">
                  <button
                    onClick={(e) => openMenu(e, row)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 cursor-pointer"
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
          className="fixed z-40 w-48 bg-white rounded-lg shadow-xl ring-1 ring-slate-200 py-1 text-sm"
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
              <div className="my-1 border-t border-slate-100" />
              {(
                [
                  ["aprobado", "Aprobar", <Check key="a" className="w-4 h-4 text-emerald-600" />],
                  ["rechazado", "Rechazar", <X key="r" className="w-4 h-4 text-rose-600" />],
                  ["pendiente", "Marcar pendiente", <Clock key="p" className="w-4 h-4 text-amber-600" />],
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
      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
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
  const color = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-indigo-500" : "bg-slate-400";
  return (
    <span className="flex items-center gap-2">
      <span className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <span className={`block h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </span>
      <span className="text-xs tabular-nums text-slate-600">{Math.round(score)}</span>
    </span>
  );
}

function FormatChips({ item }: { item: ResultadoPipelineItem }) {
  if (item.activos_candidatos.length === 0) {
    return isAlert(item) ? (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 ring-1 ring-orange-200">
        <AlertTriangle className="w-3 h-3" /> Alerta
      </span>
    ) : (
      <span className="text-xs text-slate-400">Sin contenido</span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {item.activos_candidatos.map((c) => (
        <span
          key={c.candidato_id}
          title={STATUS_LABELS[c.estado_aprobacion]}
          className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.estado_aprobacion]}`} />
          {FORMATS[c.tipo_activo].label}
        </span>
      ))}
    </span>
  );
}
