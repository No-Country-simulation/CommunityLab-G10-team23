"use client";

import React, { useState } from "react";
import { AlertCircle, Copy, Check, Inbox, ThumbsUp, XCircle, Clock, Pencil } from "lucide-react";
import { PublicationCard, EstadoAprobacion } from "@/types/backend";

interface Step4ResultsListProps {
  cards: PublicationCard[];
  selectedCardIndex: number | null;
  onSelectCard: (index: number) => void;
  hasRunAnalysis: boolean;
  onUpdateApproval?: (index: number, newStatus: EstadoAprobacion) => void;
  onUpdateContent?: (index: number, newContent: string) => void;
}

export function Step4ResultsList({
  cards,
  selectedCardIndex,
  onSelectCard,
  hasRunAnalysis,
  onUpdateApproval,
  onUpdateContent,
}: Step4ResultsListProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<string>("");

  const handleCopy = (index: number, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 1. Estado Inicial (Antes de ejecutar) */}
      {!hasRunAnalysis && (
        <div className="border border-slate-200 border-dashed rounded-2xl bg-slate-50/70 p-10 text-center flex flex-col items-center justify-center min-h-[200px] text-slate-400">
          <Inbox className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-600">Aún no se han generado propuestas</p>
          <p className="text-xs text-slate-400 max-w-md mt-1">
            Sube las conversaciones en el Paso 1 y selecciona el tipo de análisis en el Paso 2 para descubrir el contenido relevante.
          </p>
        </div>
      )}

      {/* 2. Si no se encuentran respuestas (0 respuestas / vacío) */}
      {hasRunAnalysis && cards.length === 0 && (
        <div className="border border-amber-200 bg-amber-50/90 rounded-2xl p-8 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-base font-bold text-amber-900">
            No se encontró contenido relevante para publicar
          </p>
          <p className="text-xs text-amber-700 mt-1.5 max-w-md leading-relaxed">
            Los mensajes analizados no alcanzaron el nivel de impacto o relevancia necesario para generar propuestas de publicación en este canal. Puedes cargar otro archivo o probar con el <strong>Caso Oficial</strong>.
          </p>
        </div>
      )}

      {/* 3. Lista de Tarjetas de Publicación (Grid amplio de 2 columnas) */}
      {hasRunAnalysis && cards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
          {cards.map((card, index) => {
            const isSelected = selectedCardIndex === index;
            const approval = card.estado_aprobacion || "pendiente";

            // Formato amigable de impacto
            const scoreLabel = card.relevance_score
              ? card.relevance_score >= 90
                ? `⭐ Impacto Excelente (${card.relevance_score.toFixed(0)}%)`
                : card.relevance_score >= 70
                ? `✓ Impacto Alto (${card.relevance_score.toFixed(0)}%)`
                : `Impacto Moderado (${card.relevance_score.toFixed(0)}%)`
              : null;

            return (
              <div
                key={card.id || index}
                onClick={() => onSelectCard(index)}
                className={`cursor-pointer rounded-2xl p-5 transition shadow-xs relative flex flex-col justify-between gap-3.5 bg-white ${
                  isSelected
                    ? "border-2 border-indigo-600 bg-indigo-50/20 ring-4 ring-indigo-500/10 shadow-md"
                    : "border border-slate-200 hover:border-indigo-300 hover:shadow-xs"
                }`}
              >
                {/* Cabecera de la Tarjeta */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 transition ${
                        isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 leading-snug">
                        {card.titulo || `Propuesta #${index + 1}`}
                      </h4>
                      {card.autor_origen && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Basado en comentario de <strong className="text-slate-600 font-medium">{card.autor_origen}</strong>
                          {card.canal_origen ? ` en ${card.canal_origen}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Acciones de la Cabecera (Editar & Copiar) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editingIndex === index) {
                          setEditingIndex(null);
                        } else {
                          setEditingIndex(index);
                          setEditContent(card.contenido);
                        }
                      }}
                      className={`text-xs px-2 py-1 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                        editingIndex === index
                          ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold"
                          : "border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50"
                      }`}
                      title="Editar el texto de esta propuesta"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline text-[11px]">Editar</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(index, card.contenido);
                      }}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition flex items-center gap-1 cursor-pointer"
                      title="Copiar texto al portapapeles"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[11px] text-emerald-600 font-medium">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline text-[11px]">Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Etiquetas y Metadatos Amigables */}
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  {scoreLabel && (
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">
                      {scoreLabel}
                    </span>
                  )}
                  {card.detalles?.seccion_newsletter && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                      Sección: {card.detalles.seccion_newsletter}
                    </span>
                  )}
                  {card.detalles?.potencial_engagement && (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">
                      Interacción estimada: {card.detalles.potencial_engagement}
                    </span>
                  )}
                  {card.detalles?.canal_recomendado && (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                      Canal: {card.detalles.canal_recomendado}
                    </span>
                  )}
                  {card.detalles?.status_faq && (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">
                      Estado: Para Mentoría y Guías
                    </span>
                  )}
                </div>

                {/* Área de Contenido (Texto o Editor Cómodo) */}
                {editingIndex === index ? (
                  <div className="flex flex-col gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                    <label className="text-[11px] font-bold text-indigo-900">
                      Editando propuesta de publicación:
                    </label>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full text-xs text-slate-800 bg-white p-3 rounded-xl border border-indigo-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed min-h-[110px]"
                      rows={5}
                    />
                    <div className="flex items-center gap-2 justify-end pt-1">
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="text-xs text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 bg-white transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          onUpdateContent?.(index, editContent);
                          setEditingIndex(null);
                        }}
                        className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-lg font-medium transition cursor-pointer shadow-xs"
                      >
                        Guardar Cambios
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-700 bg-slate-50/90 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap font-sans leading-relaxed flex-1">
                    {card.contenido}
                  </div>
                )}

                {/* Pie de Tarjeta con Controles de Revisión Humana */}
                <div className="flex items-center justify-between text-xs border-t border-slate-100 pt-3 mt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 text-[11px] font-medium mr-1">
                      Revisión Humana:
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateApproval?.(index, "aprobado");
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                        approval === "aprobado"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                      title="Aprobar para publicar en canales oficiales"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      Aprobado
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateApproval?.(index, "pendiente");
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                        approval === "pendiente"
                          ? "bg-amber-500 text-white shadow-xs"
                          : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                      title="Dejar en revisión pendiente"
                    >
                      <Clock className="w-3 h-3" />
                      Pendiente
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateApproval?.(index, "rechazado");
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                        approval === "rechazado"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                      }`}
                      title="Descartar esta propuesta"
                    >
                      <XCircle className="w-3 h-3" />
                      Descartado
                    </button>
                  </div>

                  <div>
                    {isSelected ? (
                      <span className="text-indigo-600 font-bold text-xs flex items-center gap-1">
                        ✓ Seleccionada
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">
                        Clic para seleccionar
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
