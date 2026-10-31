import { useState } from "react";
import type { ChangeEvent } from "react";
import { AlertTriangle, Ban, Check, ClipboardCheck, Clock, Copy, Send, X } from "lucide-react";
import type { ActivoCandidato, EstadoAprobacion, ResultadoPipelineItem } from "@/types/backend";
import { CATEGORY_LABELS, FORMATS, STATUS_LABELS, copyText, fieldText, isAlert, isDiscarded, revisionLabel } from "@/features/review/review";
import { copyToClipboard } from "@/lib/client/clipboard";
import { ChannelTabs, DetailColumns, DetailPanel, EstadoPill, FieldLabel, InteractionSummary, PanelTitle } from "@/components/shared/DetailPanel";

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
  onPublish?: (candidato: ActivoCandidato) => void;
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

  const active = candidatos.find((c) => c.candidato_id === activeId) ?? candidatos[0];

  const isDirty = (c: ActivoCandidato) =>
    Object.entries(drafts[c.candidato_id] ?? {}).some(([k, v]) => v !== fieldText(c.contenido[k]));
  const anyDirty = candidatos.some(isDirty);

  const requestClose = () => {
    // Cerrar con canales pendientes está permitido: el aviso se muestra al guardar el lote.
    if (anyDirty && !window.confirm("Tienes cambios sin guardar. ¿Cerrar de todos modos?")) return;
    onClose();
  };

  const valueOf = (c: ActivoCandidato, key: string) =>
    drafts[c.candidato_id]?.[key] ?? fieldText(c.contenido[key]);

  const setField = (c: ActivoCandidato, key: string, value: string) =>
    setDrafts((prev) => ({ ...prev, [c.candidato_id]: { ...prev[c.candidato_id], [key]: value } }));

  // Se envía el contenido completo: el backend reemplaza `contenido` en cada PATCH.
  const save = async (c: ActivoCandidato, status: EstadoAprobacion) => {
    const ok = await onSave(item, c, status, { ...c.contenido, ...drafts[c.candidato_id] });
    if (ok) {
      setDrafts(({ [c.candidato_id]: _, ...rest }) => rest);

      // Al tomar una decisión (aprobar o rechazar), avanzar automáticamente
      // al siguiente canal que aún tenga pendiente de revisión en este caso
      if (status === "aprobado" || status === "rechazado") {
        const nextPending = candidatos.find(
          (other) => other.candidato_id !== c.candidato_id && other.estado_aprobacion === "pendiente"
        );
        if (nextPending) {
          setActiveId(nextPending.candidato_id);
        }
      }
    }
  };

  const copy = async (c: ActivoCandidato) => {
    const merged = { ...c.contenido, ...drafts[c.candidato_id] };
    const ok = await copyToClipboard(copyText(c.tipo_activo, merged));
    if (ok) {
      onCopied();
    }
  };

  const handlePublish = async (c: ActivoCandidato) => {
    if (!onPublish) return;
    if (isDirty(c) || c.estado_aprobacion !== "aprobado") {
      const ok = await onSave(item, c, "aprobado", { ...c.contenido, ...drafts[c.candidato_id] });
      if (ok) {
        setDrafts(({ [c.candidato_id]: _, ...rest }) => rest);
        onPublish({ ...c, estado_aprobacion: "aprobado", contenido: { ...c.contenido, ...drafts[c.candidato_id] } });
      }
    } else {
      onPublish(c);
    }
  };

  const { interaccion, analisis, oportunidad, enrutamiento } = item;
  const saving = active ? savingId === active.candidato_id : false;
  const dirty = active ? isDirty(active) : false;

  const alerts = [
    ...(item.degradado ? ["Análisis degradado: la IA no respondió y se usó un resultado neutral."] : []),
    ...(item.error ? [item.error] : []),
  ];

  return (
    <DetailPanel
      icon={<ClipboardCheck className="w-5 h-5" />}
      autor={interaccion.autor}
      canal={interaccion.canal}
      subtitle={new Date(interaccion.timestamp).toLocaleString("es")}
      onRequestClose={requestClose}
      footer={
        active ? (
          <>
            <button onClick={() => copy(active)} className="btn-ghost">
              <Copy className="w-4 h-4" />
              Copiar
            </button>
            {onPublish && (
              <button onClick={() => handlePublish(active)} disabled={saving} className="btn-soft">
                <Send className="w-4 h-4" />
                {`Publicar en ${FORMATS[active.tipo_activo].channel}`}
              </button>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              {active.estado_aprobacion !== "rechazado" && (
                <button
                  onClick={() => save(active, "rechazado")}
                  disabled={saving}
                  className="btn-ghost text-danger-700! border-danger-200!"
                >
                  <X className="w-4 h-4" />
                  Rechazar
                </button>
              )}
              {active.estado_aprobacion !== "pendiente" && (
                <button onClick={() => save(active, "pendiente")} disabled={saving} className="btn-ghost">
                  <Clock className="w-4 h-4" />
                  Marcar pendiente
                </button>
              )}
              {active.estado_aprobacion !== "aprobado" && (
                <button onClick={() => save(active, "aprobado")} disabled={saving} className="btn-primary">
                  <Check className="w-4 h-4" />
                  {dirty ? "Guardar y aprobar" : "Aprobar"}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="text-xs text-ink-500">Sin propuestas de contenido para revisar</span>
            <button onClick={requestClose} className="btn-ghost ml-auto">
              Cerrar
            </button>
          </>
        )
      }
    >
      <DetailColumns
        left={
          <InteractionSummary
            texto={interaccion.texto}
            tipoNote={`Tipo declarado por el canal: ${interaccion.tipo} (no se usa para clasificar)`}
            alerts={alerts}
            analisis={analisis}
            categoria={oportunidad ? CATEGORY_LABELS[oportunidad.categoria] : "Sin clasificar"}
            relevancia={oportunidad ? `${Math.round(oportunidad.relevance_score)} / 100` : "—"}
            motivo={enrutamiento?.motivo}
          />
        }
        right={
          <div className="space-y-3">
            <PanelTitle>Contenido generado</PanelTitle>

            {!active ? (
              <EmptyContent item={item} />
            ) : (
              <>
                {candidatos.length > 1 && (
                  <ChannelTabs
                    tabs={candidatos.map((c) => ({
                      id: c.candidato_id,
                      label: FORMATS[c.tipo_activo].label,
                      estado: c.estado_aprobacion,
                      dirty: isDirty(c),
                    }))}
                    activeId={active.candidato_id}
                    onSelect={setActiveId}
                  />
                )}

                <div className="flex items-center justify-between gap-2 pb-1">
                  <span className="text-xs text-ink-500 font-medium">
                    {FORMATS[active.tipo_activo].label}
                    {dirty && <span className="text-brand-700"> · Cambios sin guardar</span>}
                  </span>
                  <EstadoPill estado={active.estado_aprobacion} label={STATUS_LABELS[active.estado_aprobacion]} />
                </div>
                {revisionLabel(active) && <p className="text-xs text-ink-500 -mt-2">{revisionLabel(active)}</p>}

                <div className="space-y-3">
                  {FORMATS[active.tipo_activo].fields.map((f) => {
                    if (f.readOnly) {
                      return (
                        <div key={f.key}>
                          <FieldLabel>{f.label}</FieldLabel>
                          <p className="text-xs text-ink-800 bg-ink-50 p-2.5 rounded-lg border border-ink-200">
                            {fieldText(active.contenido[f.key]) || "—"}
                          </p>
                        </div>
                      );
                    }
                    const id = `${active.candidato_id}-${f.key}`;
                    const common = {
                      id,
                      value: valueOf(active, f.key),
                      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                        setField(active, f.key, e.target.value),
                      className:
                        "w-full text-sm text-ink-800 leading-relaxed bg-surface rounded-lg border border-ink-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500",
                    };
                    return (
                      <div key={f.key}>
                        <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
                        {f.rows ? <textarea rows={f.rows} {...common} /> : <input type="text" {...common} />}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        }
      />
    </DetailPanel>
  );
}

function EmptyContent({ item }: { item: ResultadoPipelineItem }) {
  const [icon, title, text] = isAlert(item)
    ? [
        <AlertTriangle key="i" className="w-6 h-6 text-warning-600" />,
        "Alerta de soporte",
        "Esta interacción requiere atención del equipo antes de generar contenido, por lo que no tiene propuestas.",
      ]
    : isDiscarded(item)
    ? [
        <Ban key="i" className="w-6 h-6 text-ink-500" />,
        "Descartada por la IA",
        "No se detectó una oportunidad de contenido relevante en esta interacción.",
      ]
    : [
        <AlertTriangle key="i" className="w-6 h-6 text-warning-500" />,
        "Sin contenido generado",
        "No se generaron propuestas para esta interacción. Revisa el error indicado o reprocesa el lote.",
      ];
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-12 px-6 rounded-xl border border-dashed border-ink-300 bg-ink-50">
      {icon}
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      <p className="text-xs text-ink-500 max-w-sm">{text}</p>
    </div>
  );
}
