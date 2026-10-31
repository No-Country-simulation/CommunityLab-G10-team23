import { useState } from "react";
import { Check, Copy, Eye, FileCode, Send } from "lucide-react";
import { copyToClipboard } from "@/lib/client/clipboard";
import { CATEGORY_LABELS } from "@/features/review/review";
import { ChannelTabs, DetailColumns, DetailPanel, EstadoPill, InteractionSummary, PanelTitle } from "@/components/shared/DetailPanel";
import type { FlatCase } from "@/features/history/model";

interface CaseDetailModalProps {
  caso: FlatCase;
  onClose: () => void;
}

// Detalle de un caso guardado: mismo panel que la bandeja de revisión, en solo lectura,
// con una pestaña para ver el JSON del caso. El padre lo monta con `key` por caso para que
// la pestaña y el canal activo vuelvan a su valor inicial al abrir otro.
export function CaseDetailModal({ caso, onClose }: CaseDetailModalProps) {
  const [tab, setTab] = useState<"detalle" | "json">("detalle");
  const [activeChannel, setActiveChannel] = useState<string>(caso.activos_candidatos?.[0]?.tipo_activo || "post_linkedin");
  const [copiedModalText, setCopiedModalText] = useState(false);
  const [copiedCaseJson, setCopiedCaseJson] = useState(false);

  const copyModalContent = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedModalText(true);
      setTimeout(() => setCopiedModalText(false), 2000);
    }
  };

  const copyCaseJsonContent = async () => {
    const ok = await copyToClipboard(JSON.stringify(caso, null, 2));
    if (ok) {
      setCopiedCaseJson(true);
      setTimeout(() => setCopiedCaseJson(false), 2000);
    }
  };

  return (
        <DetailPanel
          icon={<Eye className="w-5 h-5" />}
          autor={caso.interaccion.autor}
          canal={caso.interaccion.canal}
          subtitle={caso.paqueteFecha ? `Fecha de registro: ${caso.paqueteFecha}` : "Interacción de la comunidad"}
          onRequestClose={() => onClose()}
          headerActions={
            <div className="flex items-center gap-1 bg-ink-200/70 p-1 rounded-lg" role="tablist">
              {(
                [
                  ["detalle", "Detalle", null],
                  ["json", "Ver JSON", <FileCode key="i" className="w-3.5 h-3.5" />],
                ] as const
              ).map(([key, label, icon]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`text-xs px-3 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                    tab === key ? "bg-surface text-brand-700 shadow-2xs" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          }
          footer={
            <>
              <span className="text-xs text-ink-500">Registro consolidado · Modo solo lectura</span>
              <button onClick={() => onClose()} className="btn-ghost ml-auto">
                Cerrar
              </button>
            </>
          }
        >
          {tab === "detalle" ? (
            <DetailColumns
              left={
                <InteractionSummary
                  texto={caso.interaccion.texto}
                  tipoNote={`Tipo declarado: ${caso.interaccion.tipo || "consulta"}`}
                  fecha={caso.paqueteFecha}
                  alerts={caso.degradado ? ["Análisis degradado: la IA no respondió y se usó un resultado neutral."] : []}
                  analisis={caso.analisis}
                  categoria={
                    CATEGORY_LABELS[caso.oportunidad?.categoria as keyof typeof CATEGORY_LABELS] ||
                    caso.oportunidad?.categoria ||
                    "Sin categoría"
                  }
                  relevancia={`${caso.oportunidad?.relevance_score ?? 0} / 100`}
                  motivo={caso.enrutamiento?.motivo}
                />
              }
              right={
                <div className="space-y-3">
                  <PanelTitle>Contenido generado</PanelTitle>
                  <ChannelTabs
                    tabs={(caso.activos_candidatos || []).map((cand) => ({
                      id: cand.tipo_activo,
                      label:
                        cand.tipo_activo === "post_linkedin"
                          ? "LinkedIn"
                          : cand.tipo_activo === "destaque_newsletter_semanal"
                          ? "Newsletter"
                          : "FAQ",
                      estado: cand.estado_aprobacion,
                    }))}
                    activeId={activeChannel}
                    onSelect={setActiveChannel}
                  />

            {/* Contenido del canal activo */}
            {(() => {
              const currentCand =
                (caso.activos_candidatos || []).find(
                  (c) => c.tipo_activo === activeChannel
                ) || (caso.activos_candidatos || [])[0];

              if (!currentCand) {
                return (
                  <div className="p-8 text-center text-ink-500 text-xs italic">
                    No se generó contenido para este canal en este caso.
                  </div>
                );
              }

              const tipo = currentCand.tipo_activo;
              const content = currentCand.contenido;
              const estado = currentCand.estado_aprobacion;

              return (
                <div className="space-y-4 pt-1">
                  {/* Estado del activo */}
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs text-ink-500 font-medium">Estado del activo:</span>
                    <EstadoPill estado={estado} />
                  </div>

                  {/* Formatos específicos */}
                  {tipo === "post_linkedin" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-ink-500 border-b border-ink-100 pb-2">
                        <span>Canal: <strong>{content.canal_recomendado || "LinkedIn Oficial"}</strong></span>
                        {content.potencial_engagement && (
                          <span>Engagement: <strong className="text-brand-600">{content.potencial_engagement}</strong></span>
                        )}
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Título
                        </label>
                        <div className="text-xs font-bold text-ink-900 bg-ink-50 p-2.5 rounded-lg border border-ink-200">
                          {content.titulo}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Copy
                        </label>
                        <div className="p-3.5 bg-ink-50 border border-ink-200 rounded-lg text-xs text-ink-800 leading-relaxed whitespace-pre-wrap font-sans">
                          {content.copy}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => copyModalContent(`${content.titulo ? content.titulo + "\n\n" : ""}${content.copy || ""}`)}
                          className="btn-primary"
                        >
                          {copiedModalText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copiedModalText ? "¡Copiado!" : "Copiar contenido"}
                        </button>
                        <button
                          onClick={async () => {
                            const text = `${content.titulo ? content.titulo + "\n\n" : ""}${content.copy || ""}`;
                            await copyToClipboard(text);
                            window.open(
                              `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`,
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }}
                          className="btn-soft"
                        >
                          <Send className="w-4 h-4" />
                          Publicar en LinkedIn
                        </button>
                      </div>
                    </div>
                  )}

                  {tipo === "destaque_newsletter_semanal" && (
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-bold text-brand-800 bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded-full">
                          Sección: {content.seccion || "Historia de la Semana"}
                        </span>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Titular
                        </label>
                        <div className="text-xs font-bold text-ink-900 bg-ink-50 p-2.5 rounded-lg border border-ink-200">
                          {content.titular}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Resumen
                        </label>
                        <div className="p-3.5 bg-ink-50 border border-ink-200 rounded-lg text-xs text-ink-800 leading-relaxed whitespace-pre-wrap font-sans">
                          {content.resumen}
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => copyModalContent(`${content.titular}\n\n${content.resumen}`)}
                          className="btn-primary"
                        >
                          {copiedModalText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copiedModalText ? "¡Copiado!" : "Copiar contenido"}
                        </button>
                      </div>
                    </div>
                  )}

                  {tipo === "sugerencia_contenido_faq" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Tema / Pregunta
                        </label>
                        <div className="text-xs font-bold text-ink-900 bg-ink-50 p-2.5 rounded-lg border border-ink-200">
                          {content.tema}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Origen / Contexto
                        </label>
                        <div className="p-3.5 bg-ink-50 border border-ink-200 rounded-lg text-xs text-ink-800 leading-relaxed whitespace-pre-wrap font-sans">
                          {content.origen}
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => copyModalContent(`${content.tema}\n\n${content.origen}`)}
                          className="btn-primary"
                        >
                          {copiedModalText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copiedModalText ? "¡Copiado!" : "Copiar contenido"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
                </div>
              }
            />
          ) : (
              /* VISTA: JSON DEL CASO */
              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between text-xs text-ink-500">
                  <span>Estructura JSON completa del caso persistido:</span>
                  <button
                    onClick={copyCaseJsonContent}
                    className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-800 font-semibold cursor-pointer"
                  >
                    {copiedCaseJson ? <Check className="w-3.5 h-3.5 text-success-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCaseJson ? "¡Copiado!" : "Copiar JSON"}
                  </button>
                </div>
                <pre className="p-4 bg-chrome text-chrome-text rounded-xl text-xs font-mono overflow-x-auto max-h-[480px] leading-relaxed">
                  {JSON.stringify(caso, null, 2)}
                </pre>
              </div>
          )}
        </DetailPanel>
  );
}
