"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Check, Clock, Copy, Save, Send, AlertTriangle, Ban } from "lucide-react";
import { ActivoCandidato, EstadoAprobacion, ResultadoPipelineItem } from "@/types/backend";
import { CATEGORY_LABELS, FORMATS, copyText, fieldText, isAlert, isDiscarded } from "@/lib/review";
import { StatusBadge } from "./ReviewTable";

interface InteractionDetailModalProps {
  item: ResultadoPipelineItem;
  initialCandidateId?: string;
  savingId: string | null;
  onClose: () => void;
  onSave: (
    item: ResultadoPipelineItem,
    candidato: ActivoCandidato,
    status: EstadoAprobacion,
    contenido: Record<string, any>
  ) => Promise<boolean>;
  onPublish: (candidato: ActivoCandidato) => void;
  onCopied: () => void;
}

// Ediciones sin guardar por candidato: solo los campos modificados.
type Drafts = Record<string, Record<string, string>>;

export function InteractionDetailModal({
  item,
  initialCandidateId,
  savingId,
  onClose,
  onSave,
  onPublish,
  onCopied,
}: InteractionDetailModalProps) {
  const candidatos = item.activos_candidatos;
  const [activeId, setActiveId] = useState(initialCandidateId ?? candidatos[0]?.candidato_id);
  const [drafts, setDrafts] = useState<Drafts>({});
  const closeRef = useRef<HTMLButtonElement>(null);

  const active = candidatos.find((c) => c.candidato_id === activeId) ?? candidatos[0];

  const isDirty = (c: ActivoCandidato) =>
    Object.entries(drafts[c.candidato_id] ?? {}).some(([k, v]) => v !== fieldText(c.contenido[k]));
  const anyDirty = candidatos.some(isDirty);

  const requestClose = () => {
    if (anyDirty && !window.confirm("Tienes cambios sin guardar. ¿Cerrar de todos modos?")) return;
    onClose();
  };

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const valueOf = (c: ActivoCandidato, key: string) =>
    drafts[c.candidato_id]?.[key] ?? fieldText(c.contenido[key]);

  const setField = (c: ActivoCandidato, key: string, value: string) =>
    setDrafts((prev) => ({ ...prev, [c.candidato_id]: { ...prev[c.candidato_id], [key]: value } }));

  // Se envía el contenido completo: el backend reemplaza `contenido` en cada PATCH.
  const save = async (c: ActivoCandidato, status: EstadoAprobacion) => {
    const ok = await onSave(item, c, status, { ...c.contenido, ...drafts[c.candidato_id] });
    if (ok) {
      setDrafts(({ [c.candidato_id]: _, ...rest }) => rest);
    }
  };

  const copy = (c: ActivoCandidato) => {
    const merged = { ...c.contenido, ...drafts[c.candidato_id] };
    navigator.clipboard.writeText(copyText(c.tipo_activo, merged)).then(onCopied);
  };

  const { interaccion, analisis, oportunidad, enrutamiento } = item;
  const saving = active ? savingId === active.candidato_id : false;
  const dirty = active ? isDirty(active) : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        className="bg-white w-full max-w-5xl max-h-[92dvh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="detail-title" className="text-base font-bold text-slate-900">
              {interaccion.autor}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {interaccion.canal} · {new Date(interaccion.timestamp).toLocaleString("es")}
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={requestClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* Interacción, análisis y clasificación */}
          <div className="p-6 flex flex-col gap-6 bg-slate-50/70 lg:border-r border-slate-200">
            {(item.error || item.degradado) && (
              <div className="flex gap-2 text-xs text-amber-900 bg-amber-50 ring-1 ring-amber-200 rounded-lg p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <div>
                  {item.degradado && <p>Análisis degradado: la IA no respondió y se usó un resultado neutral.</p>}
                  {item.error && <p>{item.error}</p>}
                </div>
              </div>
            )}

            <Section title="Interacción original">
              <blockquote className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {interaccion.texto}
              </blockquote>
              <p className="text-[11px] text-slate-400 mt-2">
                Tipo declarado por el canal: {interaccion.tipo} (no se usa para clasificar)
              </p>
            </Section>

            <Section title="Análisis IA">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Term label="Sentimiento">
                  {analisis.sentimiento}{" "}
                  <span className="text-slate-400 tabular-nums">
                    ({analisis.sentimiento_score > 0 ? "+" : ""}
                    {analisis.sentimiento_score.toFixed(2)})
                  </span>
                </Term>
                <Term label="Temas">
                  <Chips values={analisis.temas} />
                </Term>
                <Term label="Entidades">
                  <Chips values={analisis.entidades} />
                </Term>
              </dl>
              <p className="text-sm text-slate-600 mt-3 leading-relaxed">{analisis.resumen}</p>
            </Section>

            <Section title="Clasificación">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Term label="Categoría">{oportunidad ? CATEGORY_LABELS[oportunidad.categoria] : "Sin clasificar"}</Term>
                <Term label="Relevancia">
                  {oportunidad ? <span className="tabular-nums">{Math.round(oportunidad.relevance_score)}/100</span> : "—"}
                </Term>
                <Term label="Motivo">{enrutamiento?.motivo ?? "—"}</Term>
              </dl>
            </Section>
          </div>

          {/* Contenido generado */}
          <div className="p-6 flex flex-col gap-4 min-w-0">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Contenido generado</h3>

            {!active ? (
              <EmptyContent item={item} />
            ) : (
              <>
                {candidatos.length > 1 && (
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg self-start" role="tablist">
                    {candidatos.map((c) => (
                      <button
                        key={c.candidato_id}
                        role="tab"
                        aria-selected={c.candidato_id === active.candidato_id}
                        onClick={() => setActiveId(c.candidato_id)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer ${
                          c.candidato_id === active.candidato_id
                            ? "bg-white shadow-sm text-slate-900"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {FORMATS[c.tipo_activo].label}
                        {isDirty(c) && <span className="ml-1 text-indigo-500">•</span>}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{FORMATS[active.tipo_activo].label}</span>
                  <StatusBadge status={active.estado_aprobacion} />
                  {dirty && <span className="text-xs text-indigo-600">Cambios sin guardar</span>}
                </div>

                <div className="flex flex-col gap-3">
                  {FORMATS[active.tipo_activo].fields.map((f) => {
                    if (f.readOnly) {
                      return (
                        <div key={f.key}>
                          <p className="text-xs font-medium text-slate-600 mb-1">{f.label}</p>
                          <p className="text-sm text-slate-800 px-3 py-2 rounded-lg bg-slate-100">
                            {fieldText(active.contenido[f.key]) || "—"}
                          </p>
                        </div>
                      );
                    }
                    const id = `${active.candidato_id}-${f.key}`;
                    const common = {
                      id,
                      value: valueOf(active, f.key),
                      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                        setField(active, f.key, e.target.value),
                      className:
                        "w-full text-sm text-slate-800 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
                    };
                    return (
                      <div key={f.key}>
                        <label htmlFor={id} className="block text-xs font-medium text-slate-600 mb-1">
                          {f.label}
                        </label>
                        {f.rows ? <textarea rows={f.rows} {...common} /> : <input type="text" {...common} />}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {active && (
          <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-t border-slate-200 bg-white">
            <FooterButton onClick={() => copy(active)} icon={<Copy className="w-4 h-4" />} label="Copiar" />
            <PublishButton
              channel={FORMATS[active.tipo_activo].channel}
              enabled={active.estado_aprobacion === "aprobado" && !dirty}
              onClick={() => onPublish(active)}
            />

            <div className="ml-auto flex flex-wrap gap-2">
              {active.estado_aprobacion !== "rechazado" && (
                <FooterButton
                  onClick={() => save(active, "rechazado")}
                  disabled={saving}
                  icon={<X className="w-4 h-4" />}
                  label="Rechazar"
                  className="text-rose-700 border-rose-200 hover:bg-rose-50"
                />
              )}
              {active.estado_aprobacion !== "pendiente" && (
                <FooterButton
                  onClick={() => save(active, "pendiente")}
                  disabled={saving}
                  icon={<Clock className="w-4 h-4" />}
                  label="Marcar pendiente"
                />
              )}
              <FooterButton
                onClick={() => save(active, active.estado_aprobacion)}
                disabled={saving || !dirty}
                icon={<Save className="w-4 h-4" />}
                label="Guardar"
              />
              {active.estado_aprobacion !== "aprobado" && (
                <FooterButton
                  onClick={() => save(active, "aprobado")}
                  disabled={saving}
                  icon={<Check className="w-4 h-4" />}
                  label={dirty ? "Guardar y aprobar" : "Aprobar"}
                  className="bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{title}</h3>
      {children}
    </section>
  );
}

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800 min-w-0">{children}</dd>
    </>
  );
}

function Chips({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((v) => (
        <span key={v} className="text-xs px-2 py-0.5 rounded-full bg-white ring-1 ring-slate-200 text-slate-700">
          {v}
        </span>
      ))}
    </span>
  );
}

function EmptyContent({ item }: { item: ResultadoPipelineItem }) {
  const [icon, title, text] = isAlert(item)
    ? [
        <AlertTriangle key="i" className="w-6 h-6 text-orange-500" />,
        "Alerta de soporte",
        "Esta interacción requiere atención del equipo antes de generar contenido, por lo que no tiene propuestas.",
      ]
    : isDiscarded(item)
    ? [
        <Ban key="i" className="w-6 h-6 text-slate-400" />,
        "Descartada por la IA",
        "No se detectó una oportunidad de contenido relevante en esta interacción.",
      ]
    : [
        <AlertTriangle key="i" className="w-6 h-6 text-amber-500" />,
        "Sin contenido generado",
        "No se generaron propuestas para esta interacción. Revisa el error indicado o reprocesa el lote.",
      ];
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-12 px-6 rounded-xl border border-dashed border-slate-300">
      {icon}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="text-sm text-slate-500 max-w-sm">{text}</p>
    </div>
  );
}

function FooterButton({
  onClick,
  icon,
  label,
  disabled,
  className = "text-slate-700 border-slate-300 hover:bg-slate-50",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}

function PublishButton({ channel, enabled, onClick }: { channel: string; enabled: boolean; onClick: () => void }) {
  return (
    <span title={enabled ? undefined : "Aprueba y guarda el contenido para habilitar la publicación"}>
      <FooterButton
        onClick={onClick}
        disabled={!enabled}
        icon={<Send className="w-4 h-4" />}
        label={`Publicar en ${channel}`}
        className="text-indigo-700 border-indigo-200 hover:bg-indigo-50"
      />
    </span>
  );
}
