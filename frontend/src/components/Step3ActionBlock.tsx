"use client";

import React from "react";
import { Lock, Loader2, ArrowRight } from "lucide-react";
import { AssetCategoryKey } from "@/types/backend";

interface PlatformCounts {
  linkedin: number;
  newsletter: number;
  faq: number;
  testimonios: number;
}

interface Step3ActionBlockProps {
  selectedType: "auto" | "directed" | null;
  isLoading: boolean;
  platformCounts: PlatformCounts;
  activePlatformFilter: AssetCategoryKey;
  onSelectPlatformFilter: (platform: AssetCategoryKey) => void;
  onTriggerDirectedAction: (platform: AssetCategoryKey) => void;
  onCancelLoading?: () => void;
}

export function Step3ActionBlock({
  selectedType,
  isLoading,
  platformCounts,
  activePlatformFilter,
  onSelectPlatformFilter,
  onTriggerDirectedAction,
  onCancelLoading,
}: Step3ActionBlockProps) {
  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
          Paso 3: Canales y Formatos
        </h2>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded ${
            !selectedType
              ? "bg-slate-100 text-slate-400"
              : isLoading
              ? "bg-indigo-100 text-indigo-700 animate-pulse"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {!selectedType ? "Bloqueado" : isLoading ? "Analizando..." : "Listo"}
        </span>
      </div>

      {/* Estado 1: Bloqueado */}
      {!selectedType && (
        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-6 text-center text-slate-400 flex flex-col items-center justify-center flex-1">
          <Lock className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-xs font-medium text-slate-600">Paso 3 desbloqueable</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Elige "Análisis Automático" o "Análisis Direccionado" en el Paso 2
          </p>
        </div>
      )}

      {/* Estado 2: Loading Amigable */}
      {selectedType && isLoading && (
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-6 text-center flex flex-col items-center justify-center flex-1">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p className="text-xs font-bold text-indigo-900">Analizando mensajes de la comunidad...</p>
          <p className="text-[11px] text-indigo-600 mt-1 max-w-sm">
            Identificando historias de impacto, dudas frecuentes y redactando propuestas para cada canal.
          </p>
          {onCancelLoading && (
            <button
              onClick={onCancelLoading}
              className="mt-3 text-xs bg-white hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-300 font-medium transition shadow-xs cursor-pointer"
            >
              Cancelar Espera
            </button>
          )}
        </div>
      )}

      {/* Estado 3A: Modo Automático (4 canales con subtítulo de proceso en trasfondo) */}
      {selectedType === "auto" && !isLoading && (
        <div className="flex flex-col gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Contenido Generado por Canal:</span>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
              Sugerencias Listas
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Haz clic en un canal para ver y revisar sus propuestas de publicación abajo:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* 1. LinkedIn */}
            <button
              onClick={() => onSelectPlatformFilter("linkedin")}
              className={`w-full flex flex-col justify-between p-3 rounded-xl border transition text-left cursor-pointer ${
                activePlatformFilter === "linkedin"
                  ? "border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20 shadow-xs"
                  : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/20"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    LN
                  </div>
                  <span className="text-xs font-bold text-slate-800">LinkedIn</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    platformCounts.linkedin > 0
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {platformCounts.linkedin} {platformCounts.linkedin === 1 ? "publicación" : "publicaciones"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Procesa el texto para destacar aprendizajes y logros con tono profesional y llamada a la acción.
              </p>
            </button>

            {/* 2. Newsletter */}
            <button
              onClick={() => onSelectPlatformFilter("newsletter")}
              className={`w-full flex flex-col justify-between p-3 rounded-xl border transition text-left cursor-pointer ${
                activePlatformFilter === "newsletter"
                  ? "border-amber-500 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs"
                  : "border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/20"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                    NL
                  </div>
                  <span className="text-xs font-bold text-slate-800">Newsletter</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    platformCounts.newsletter > 0
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {platformCounts.newsletter} {platformCounts.newsletter === 1 ? "publicación" : "publicaciones"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Sintetiza la información en un formato editorial de titulares y resúmenes para el boletín semanal.
              </p>
            </button>

            {/* 3. Contenido FAQ */}
            <button
              onClick={() => onSelectPlatformFilter("faq")}
              className={`w-full flex flex-col justify-between p-3 rounded-xl border transition text-left cursor-pointer ${
                activePlatformFilter === "faq"
                  ? "border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-xs"
                  : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/20"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    FAQ
                  </div>
                  <span className="text-xs font-bold text-slate-800">Contenido FAQ</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    platformCounts.faq > 0
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {platformCounts.faq} {platformCounts.faq === 1 ? "sugerencia" : "sugerencias"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Detecta patrones en consultas para formular preguntas frecuentes y derivarlas a guías o mentoría.
              </p>
            </button>

            {/* 4. Casos de Éxito & Testimonios */}
            <button
              onClick={() => onSelectPlatformFilter("testimonios")}
              className={`w-full flex flex-col justify-between p-3 rounded-xl border transition text-left cursor-pointer ${
                activePlatformFilter === "testimonios"
                  ? "border-teal-500 bg-teal-50/70 ring-2 ring-teal-500/20 shadow-xs"
                  : "border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/20"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                    CE
                  </div>
                  <span className="text-xs font-bold text-slate-800">Casos de Éxito & Testimonios</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    platformCounts.testimonios > 0
                      ? "bg-teal-100 text-teal-700"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {platformCounts.testimonios} {platformCounts.testimonios === 1 ? "historia" : "historias"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Evalúa y puntúa el impacto de testimonios reales para dar visibilidad y reconocimiento al autor.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Estado 3B: Modo Direccionado (4 acciones oficiales) */}
      {selectedType === "directed" && !isLoading && (
        <div className="flex flex-col gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Elige el Canal a Enfocar:</span>
            <span className="text-[10px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded-full">
              Modo Direccionado
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Haz clic en el formato que deseas generar a partir de las conversaciones cargadas:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* LinkedIn */}
            <button
              onClick={() => onTriggerDirectedAction("linkedin")}
              className="p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:bg-blue-50/40 flex flex-col justify-between transition text-left cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                    LN
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                    LinkedIn
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Procesa el texto para destacar aprendizajes y logros con tono profesional y llamada a la acción.
              </p>
            </button>

            {/* Newsletter */}
            <button
              onClick={() => onTriggerDirectedAction("newsletter")}
              className="p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-500 hover:bg-amber-50/40 flex flex-col justify-between transition text-left cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                    NL
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-amber-700">
                    Newsletter
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Sintetiza la información en un formato editorial de titulares y resúmenes para el boletín semanal.
              </p>
            </button>

            {/* Contenido FAQ */}
            <button
              onClick={() => onTriggerDirectedAction("faq")}
              className="p-3 rounded-xl border border-slate-200 bg-white hover:border-indigo-500 hover:bg-indigo-50/40 flex flex-col justify-between transition text-left cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    FAQ
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
                    Contenido FAQ
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Detecta patrones en consultas para formular preguntas frecuentes y derivarlas a guías o mentoría.
              </p>
            </button>

            {/* Casos de Éxito & Testimonios */}
            <button
              onClick={() => onTriggerDirectedAction("testimonios")}
              className="p-3 rounded-xl border border-slate-200 bg-white hover:border-teal-500 hover:bg-teal-50/40 flex flex-col justify-between transition text-left cursor-pointer shadow-xs group"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-teal-100 text-teal-600 flex items-center justify-center font-bold text-xs">
                    CE
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-teal-700">
                    Casos de Éxito & Testimonios
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Evalúa y puntúa el impacto de testimonios reales para dar visibilidad y reconocimiento al autor.
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
