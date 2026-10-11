"use client";

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, RefreshCw, Upload, FlaskConical, ChevronDown } from "lucide-react";
import { SAMPLES } from "@/lib/samples";

interface HeaderProps {
  batch: { origen: string; periodo: string; total: number } | null;
  isLoading: boolean;
  progress: { procesadas: number; total: number } | null;
  onPickFile: () => void;
  onReprocess: () => void;
  onLoadSample: (key: string) => void;
}

export function Header({ batch, isLoading, progress, onPickFile, onReprocess, onLoadSample }: HeaderProps) {
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [demoOpen, setDemoOpen] = useState(false);
  const demoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkHealth();
  }, []);

  useEffect(() => {
    if (!demoOpen) return;
    const close = (e: MouseEvent) => {
      if (!demoRef.current?.contains(e.target as Node)) setDemoOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [demoOpen]);

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
        <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center font-black text-sm tracking-tighter">
          CL
        </div>
        <div className="leading-tight">
          <h1 className="text-base font-bold tracking-tight">Community Lab</h1>
        </div>
      </div>

      {batch && (
        <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-2">
          <span className="font-semibold text-white">{batch.origen}</span>
          <span className="text-slate-500">·</span>
          <span>{batch.periodo}</span>
          <span className="text-slate-500">·</span>
          {progress ? (
            <span className="flex items-center gap-1.5 text-indigo-300 font-medium">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Procesando {progress.procesadas} de {progress.total}
            </span>
          ) : (
            <span>
              {batch.total} {batch.total === 1 ? "interacción" : "interacciones"}
            </span>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2 flex-wrap">
        {batch && (
          <button
            onClick={onReprocess}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Reprocesar
          </button>
        )}
        <button
          onClick={onPickFile}
          disabled={isLoading}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 font-semibold transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          Cargar JSON
        </button>

        <div ref={demoRef} className="relative">
          <button
            onClick={() => setDemoOpen((o) => !o)}
            disabled={isLoading}
            className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1 disabled:opacity-40 cursor-pointer"
            aria-haspopup="menu"
            aria-expanded={demoOpen}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Datos de prueba
            <ChevronDown className="w-3 h-3" />
          </button>
          {demoOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-52 bg-white text-slate-700 rounded-lg shadow-xl ring-1 ring-slate-200 py-1 z-30"
            >
              {SAMPLES.map((s) => (
                <button
                  key={s.key}
                  role="menuitem"
                  onClick={() => {
                    setDemoOpen(false);
                    onLoadSample(s.key);
                  }}
                  className="w-full text-left text-xs px-3 py-2 hover:bg-slate-100 cursor-pointer"
                >
                  {s.label}
                  <span className="block text-[11px] text-slate-400">
                    {s.data.interacciones.length} interacciones
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

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
