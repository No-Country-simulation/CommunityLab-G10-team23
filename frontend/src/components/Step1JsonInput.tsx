"use client";

import React, { useRef, useState, useMemo } from "react";
import { UploadCloud, CheckCircle, AlertTriangle, Code, Trash2, Eye, EyeOff, MessageSquare } from "lucide-react";
import { SolicitudProcesamiento } from "@/types/backend";

interface Step1JsonInputProps {
  jsonString: string;
  setJsonString: (val: string) => void;
  isValid: boolean;
  validationError: string | null;
  onValidDataChange: (data: SolicitudProcesamiento | null) => void;
}

export function Step1JsonInput({
  jsonString,
  setJsonString,
  isValid,
  validationError,
  onValidDataChange,
}: Step1JsonInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showRawCode, setShowRawCode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const summary = useMemo(() => {
    if (!isValid || !jsonString.trim()) return null;
    try {
      const data: SolicitudProcesamiento = JSON.parse(jsonString);
      return {
        comunidad: data.origen_comunidad || "Comunidad",
        periodo: data.periodo_referencia || "General",
        total: data.interacciones?.length || 0,
        autores: (data.interacciones || []).map((i) => i.autor).filter(Boolean).slice(0, 4),
        canales: Array.from(new Set((data.interacciones || []).map((i) => i.canal).filter(Boolean))),
      };
    } catch {
      return null;
    }
  }, [isValid, jsonString]);

  const readJsonFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const formatted = JSON.stringify(parsed, null, 2);
        setJsonString(formatted);
      } catch (err: any) {
        alert("El archivo subido no es un JSON válido: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readJsonFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readJsonFile(file);
    }
  };

  const formatJson = () => {
    try {
      const obj = JSON.parse(jsonString);
      setJsonString(JSON.stringify(obj, null, 2));
    } catch {
      // Ignorar si hay error sintáctico
    }
  };

  const clearJson = () => {
    setJsonString("");
    onValidDataChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <section className="flex flex-col gap-3.5 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
          Paso 1: Mensajes de la Comunidad
        </h2>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
            !jsonString
              ? "bg-slate-100 text-slate-500"
              : isValid
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {!jsonString ? "Esperando archivo" : isValid ? "Datos Listos" : "Formato Inválido"}
        </span>
      </div>

      {/* Upload Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-4 transition text-center group cursor-pointer relative shadow-2xs ${
          isDragging
            ? "border-indigo-600 bg-indigo-50/90 ring-4 ring-indigo-500/20 scale-[1.01]"
            : "border-slate-300 hover:border-indigo-500 bg-slate-50/80"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileUpload}
        />
        <div className="flex flex-col items-center justify-center gap-1.5 pointer-events-none">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
            isDragging ? "bg-indigo-600 text-white scale-110" : "bg-indigo-100 text-indigo-600 group-hover:scale-110"
          }`}>
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">
              {isDragging ? "¡Suelta el archivo aquí!" : "Subir archivo de conversaciones (.json)"}
            </p>
            <p className="text-[11px] text-slate-500">
              {isDragging ? "Detectando formato JSON..." : "Arrastra aquí o haz clic para cargar comentarios y testimonios"}
            </p>
          </div>
        </div>
      </div>

      {/* Resumen amigable para usuarios no técnicos */}
      {summary && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{summary.total} mensajes listos para procesar</span>
            </div>
            <span className="text-[10px] bg-white border border-emerald-200 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
              {summary.comunidad}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-emerald-800">
            <span className="text-slate-500">Autores detectados:</span>
            {summary.autores.map((autor, idx) => (
              <span key={idx} className="bg-white/80 px-2 py-0.5 rounded-md border border-emerald-100 font-medium">
                {autor}
              </span>
            ))}
          </div>

          {summary.canales.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-500">
              <span>Canales de origen:</span>
              {summary.canales.map((canal, idx) => (
                <span key={idx} className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">
                  {canal}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barra de herramientas y alternador de código */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setShowRawCode((prev) => !prev)}
          disabled={!jsonString}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer disabled:opacity-40"
        >
          {showRawCode ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>Ocultar código técnico</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>{jsonString ? "Ver código técnico (JSON)" : "Escribir código manualmente"}</span>
            </>
          )}
        </button>

        <div className="flex items-center gap-1.5">
          {showRawCode && (
            <button
              onClick={formatJson}
              disabled={!isValid || !jsonString}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded font-medium transition disabled:opacity-40 cursor-pointer"
            >
              Formatear
            </button>
          )}
          {jsonString && (
            <button
              onClick={clearJson}
              className="text-xs bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-700 px-2 py-1 rounded font-medium transition cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Text Area (Visible solo si el usuario lo activa o si aún no hay archivo) */}
      {(showRawCode || !isValid) && (
        <div className="relative flex-1 min-h-[180px] flex flex-col">
          <textarea
            value={jsonString}
            onChange={(e) => setJsonString(e.target.value)}
            placeholder={`{\n  "origen_comunidad": "Discord_Grupo_ONE_G10",\n  "periodo_referencia": "Semana_04",\n  "interacciones": [\n    {\n      "autor": "Mariana Souza",\n      "canal": "#logros",\n      "tipo": "testimonio",\n      "texto": "Quedé seleccionada para mi primer empleo."\n    }\n  ]\n}`}
            className="w-full flex-1 p-3 text-xs font-mono bg-slate-900 text-emerald-400 rounded-xl border border-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
          />
          {validationError && (
            <div className="absolute bottom-2 left-2 right-2 bg-rose-900/90 text-rose-200 text-xs px-3 py-1.5 rounded-lg backdrop-blur-sm border border-rose-700">
              {validationError}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
