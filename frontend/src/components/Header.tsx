"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, Upload, Cloud, LayoutList } from "lucide-react";

interface HeaderProps {
  batch: { origen: string; periodo: string; total: number } | null;
  isLoading: boolean;
  progress: { procesadas: number; total: number } | null;
  onPickFile: () => void;
  onReprocess: () => void;
  onPublishOCI?: () => void;
  isPublishing?: boolean;
  viewMode?: "revision" | "historial";
  onViewModeChange?: (mode: "revision" | "historial") => void;
}

export function Header({
  batch,
  isLoading,
  progress,
  onPickFile,
  onReprocess,
  onPublishOCI,
  isPublishing = false,
  viewMode = "revision",
  onViewModeChange,
}: HeaderProps) {
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      setBackendStatus("checking");
      const res = await fetch("/api/health");
      const data = await res.json();
      setBackendStatus(data.status === "online" ? "online" : "offline");
    } catch {
      setBackendStatus("offline");
    }
  };

  return (
    <header className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-3">
        <img
          src="/logo.jpg"
          alt="Community Lab"
          className="w-9 h-9 rounded-xl object-cover shadow-xs border border-slate-700/60"
        />
        <div className="leading-tight">
          <h1 className="text-base font-bold tracking-tight">Community Lab</h1>
        </div>
      </div>

      {/* Switcher de Vistas: Bandeja de Revisión vs Historial OCI */}
      {onViewModeChange && (
        <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
          <button
            onClick={() => onViewModeChange("revision")}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === "revision"
                ? "bg-indigo-600 text-white font-bold shadow-xs"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            Bandeja de Revisión
          </button>
          <button
            onClick={() => onViewModeChange("historial")}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
              viewMode === "historial"
                ? "bg-indigo-600 text-white font-bold shadow-xs"
                : "text-slate-300 hover:text-white"
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            Historial
          </button>
        </div>
      )}

      {viewMode === "revision" && progress && (
        <div className="text-xs flex items-center gap-1.5 text-indigo-300 font-medium bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Procesando {progress.procesadas} de {progress.total}…
        </div>
      )}

      <div className="ml-auto flex items-center gap-2 flex-wrap">
        {viewMode === "revision" && batch && (
          <button
            onClick={onReprocess}
            disabled={isLoading || isPublishing}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Reprocesar
          </button>
        )}
        {viewMode === "revision" && batch && onPublishOCI && (
          <button
            onClick={onPublishOCI}
            disabled={isLoading || isPublishing}
            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer text-white shadow-sm"
            title="Guardar cambios en OCI Object Storage (Equipo D)"
          >
            <Upload className={`w-3.5 h-3.5 ${isPublishing ? "animate-spin" : ""}`} />
            {isPublishing ? "Guardando cambios…" : "Guardar cambios"}
          </button>
        )}
        {viewMode === "revision" && (
          <button
            onClick={onPickFile}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 font-semibold transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Cargar JSON
          </button>
        )}

        <button
          onClick={checkHealth}
          className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          title="Haz clic para volver a verificar la conexión"
        >
          {backendStatus === "checking" && (
            <span className="text-slate-400 flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin" /> Conectando…
            </span>
          )}
          {backendStatus === "online" && (
            <span className="text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
            </span>
          )}
          {backendStatus === "offline" && (
            <span className="text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Modo demostración
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
