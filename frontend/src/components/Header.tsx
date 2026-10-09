"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, FileText } from "lucide-react";

interface HeaderProps {
  onLoadSample: (type: "official" | "empty") => void;
}

export function Header({ onLoadSample }: HeaderProps) {
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      setBackendStatus("checking");
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.status === "online") {
        setBackendStatus("online");
      } else {
        setBackendStatus("offline");
      }
    } catch {
      setBackendStatus("offline");
    }
  };

  return (
    <header className="border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
      <div className="flex items-center gap-3">
        {/* Logo circular verde */}
        <div className="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white font-black text-xl tracking-tighter ring-2 ring-emerald-400/50">
          CL
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
            Community Lab
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              v1.0 Integrado
            </span>
          </h1>
          <p className="text-xs text-slate-300">
            Pipeline de orquestación comunitaria y distribución multicanal
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Backend health status badge */}
        <div
          onClick={checkHealth}
          className="cursor-pointer text-xs flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 hover:border-slate-500 transition shadow-xs"
          title="Haz clic para re-verificar la conexión del sistema"
        >
          {backendStatus === "checking" && (
            <span className="text-slate-400 flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin text-slate-400" /> Conectando...
            </span>
          )}
          {backendStatus === "online" && (
            <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Servidor Conectado
            </span>
          )}
          {backendStatus === "offline" && (
            <span className="text-amber-400 flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Modo Demostración
            </span>
          )}
        </div>

        {/* Carga rápida de muestras oficiales */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onLoadSample("official")}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5 font-medium shadow-xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            Cargar Conversaciones Reales
          </button>
          <button
            onClick={() => onLoadSample("empty")}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5 font-medium shadow-xs cursor-pointer"
          >
            Cargar Ejemplo Vacío
          </button>
        </div>
      </div>
    </header>
  );
}
