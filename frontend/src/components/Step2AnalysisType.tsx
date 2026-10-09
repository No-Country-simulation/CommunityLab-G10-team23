"use client";

import React from "react";
import { Zap, Compass } from "lucide-react";

interface Step2AnalysisTypeProps {
  isStep1Valid: boolean;
  selectedType: "auto" | "directed" | null;
  onSelectType: (type: "auto" | "directed") => void;
  isLoading?: boolean;
}

export function Step2AnalysisType({
  isStep1Valid,
  selectedType,
  onSelectType,
  isLoading = false,
}: Step2AnalysisTypeProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
          Paso 2: Tipo de Análisis
        </h2>
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded ${
            !isStep1Valid
              ? "bg-slate-100 text-slate-400"
              : isLoading
              ? "bg-indigo-100 text-indigo-700 animate-pulse"
              : selectedType
              ? "bg-indigo-100 text-indigo-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          {!isStep1Valid ? "Pendiente JSON" : isLoading ? "Procesando..." : selectedType ? "Seleccionado" : "Disponible"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {/* Opción 1: Análisis Automático */}
        <button
          onClick={() => onSelectType("auto")}
          disabled={!isStep1Valid || isLoading}
          className={`w-full text-left p-3.5 rounded-xl border transition group relative shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            selectedType === "auto"
              ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20"
              : "border-slate-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/30"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ${
                selectedType === "auto"
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
              }`}
            >
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-700">
                  Análisis Automático
                </span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                  Recomendado
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Nosotros procesaremos el documento y te propondremos diferentes tipos de caminos a publicar
              </p>
            </div>
          </div>
        </button>

        {/* Opción 2: Análisis Direccionado */}
        <button
          onClick={() => onSelectType("directed")}
          disabled={!isStep1Valid || isLoading}
          className={`w-full text-left p-3.5 rounded-xl border transition group relative shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            selectedType === "directed"
              ? "border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20"
              : "border-slate-200 bg-white hover:border-teal-400 hover:bg-teal-50/30"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ${
                selectedType === "directed"
                  ? "bg-teal-600 text-white"
                  : "bg-teal-100 text-teal-600 group-hover:bg-teal-600 group-hover:text-white"
              }`}
            >
              <Compass className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 group-hover:text-teal-700">
                  Análisis Direccionado
                </span>
                <span className="text-[10px] bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-full">
                  Personalizado
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                Podrás direccionar el análisis a LinkedIn, Newsletter, Contenido FAQ o Casos de Éxito
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
