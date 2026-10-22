"use client";

import React, { useEffect, useState } from "react";
import {
  Cloud,
  RefreshCw,
  FolderArchive,
  Download,
  Copy,
  Check,
  Share2,
  FileText,
  HelpCircle,
  TrendingUp,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Code2,
} from "lucide-react";

interface PackageSummary {
  periodo_referencia: string;
  ruta_objeto: string;
  tamano_bytes: number;
  fecha_creacion?: string;
}

interface PackageData {
  status: string;
  resumen_comunidad?: {
    total_interacciones_procesadas: number;
    sentimiento_predominante: string;
    temas_principales: string[];
  };
  activos_distribucion_generados?: {
    post_linkedin?: {
      titulo: string;
      copy: string;
      canal_recomendado: string;
      potencial_engagement: string;
    };
    destaque_newsletter_semanal?: {
      seccion: string;
      titular: string;
      resumen: string;
    };
    sugerencia_contenido_faq?: {
      tema: string;
      origen: string;
      status: string;
    };
  };
}

export function HistoryView() {
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [currentPackage, setCurrentPackage] = useState<PackageData | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeAssetTab, setActiveAssetTab] = useState<"linkedin" | "newsletter" | "faq" | "raw">("linkedin");

  useEffect(() => {
    fetchPackagesList();
  }, []);

  const fetchPackagesList = async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch("/api/storage/packages");
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.packages)) {
        setPackages(json.packages);
        if (json.packages.length > 0) {
          loadPackage(json.packages[0].ruta_objeto);
        } else {
          setCurrentPackage(null);
        }
      }
    } catch (err) {
      console.error("Error al listar paquetes OCI:", err);
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadPackage = async (objectPath: string) => {
    setSelectedPath(objectPath);
    setIsLoadingDetail(true);
    try {
      const res = await fetch(`/api/storage/packages/${encodeURIComponent(objectPath)}`);
      const json = await res.json().catch(() => null);
      if (res.ok && json?.data) {
        setCurrentPackage(json.data);
      }
    } catch (err) {
      console.error("Error al cargar paquete OCI:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const copyRawJSON = () => {
    if (!currentPackage) return;
    navigator.clipboard.writeText(JSON.stringify(currentPackage, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJSON = () => {
    if (!currentPackage) return;
    const blob = new Blob([JSON.stringify(currentPackage, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedPath.split("/").pop() || "paquete-distribucion.json"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resumen = currentPackage?.resumen_comunidad;
  const activos = currentPackage?.activos_distribucion_generados;
  const linkedin = activos?.post_linkedin;
  const newsletter = activos?.destaque_newsletter_semanal;
  const faq = activos?.sugerencia_contenido_faq;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden h-full">
      {/* Barra superior de control del bucket */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Historial de Paquetes en OCI Object Storage</h2>
            <p className="text-xs text-slate-500">
              Objetos oficiales <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded font-mono">paquete-distribucion.json</code> persistidos en el Bucket de Oracle Cloud
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {packages.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Paquete:</span>
              <select
                value={selectedPath}
                onChange={(e) => loadPackage(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {packages.map((pkg) => (
                  <option key={pkg.ruta_objeto} value={pkg.ruta_objeto}>
                    {pkg.periodo_referencia} — {pkg.ruta_objeto} ({pkg.tamano_bytes} B)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <span className="text-xs text-slate-400 italic">No hay paquetes en el Bucket</span>
          )}

          <button
            onClick={fetchPackagesList}
            disabled={isLoadingList || isLoadingDetail}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600 font-medium transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            title="Refrescar lista desde OCI"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList || isLoadingDetail ? "animate-spin" : ""}`} />
            Actualizar
          </button>

          {currentPackage && (
            <button
              onClick={downloadJSON}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium transition flex items-center gap-1.5 cursor-pointer"
              title="Descargar paquete JSON"
            >
              <Download className="w-3.5 h-3.5" />
              Descargar JSON
            </button>
          )}
        </div>
      </div>

      {/* Sub-barra informativa con ruta exacta en OCI */}
      {selectedPath && (
        <div className="bg-slate-100/80 border-b border-slate-200 px-6 py-2 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">Objeto OCI:</span>
            <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[11px] font-mono text-indigo-700 font-semibold">
              {selectedPath}
            </code>
            <span className="text-slate-400">·</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              ● Estado: {currentPackage?.status || "exito"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyRawJSON}
              className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded hover:bg-slate-50 transition cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copied ? "¡Copiado!" : "Copiar JSON"}
            </button>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoadingDetail ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Descargando paquete JSON oficial desde OCI Object Storage…</span>
          </div>
        ) : !currentPackage ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 text-center">
            <FolderArchive className="w-12 h-12 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No hay paquetes publicados aún en OCI Object Storage</p>
            <p className="text-xs max-w-sm text-slate-500">
              Carga un lote en la Bandeja de Revisión y presiona el botón &quot;Publicar en OCI&quot; en la barra superior para persistir el paquete de distribución oficial.
            </p>
          </div>
        ) : (
          <>
            {/* 1. SECCIÓN: RESUMEN DE LA COMUNIDAD */}
            {resumen && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Resumen de la Comunidad (Métricas Oficiales)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500 block mb-1">Total Interacciones</span>
                    <span className="text-2xl font-bold text-slate-800">
                      {resumen.total_interacciones_procesadas}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500 block mb-1">Sentimiento Predominante</span>
                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {resumen.sentimiento_predominante}
                    </span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500 block mb-1.5">Temas Principales</span>
                    <div className="flex flex-wrap gap-1.5">
                      {resumen.temas_principales && resumen.temas_principales.length > 0 ? (
                        resumen.temas_principales.map((t, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                          >
                            #{t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No especificados</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. SECCIÓN: ACTIVOS DE DISTRIBUCIÓN OFICIALES */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-3 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Activos de Distribución Oficiales en el Objeto
                </h3>

                {/* Tabs de formatos */}
                <div className="flex items-center gap-1.5 bg-slate-200/60 p-1 rounded-lg">
                  <button
                    onClick={() => setActiveAssetTab("linkedin")}
                    className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      activeAssetTab === "linkedin"
                        ? "bg-white text-blue-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    LinkedIn
                  </button>
                  <button
                    onClick={() => setActiveAssetTab("newsletter")}
                    className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      activeAssetTab === "newsletter"
                        ? "bg-white text-purple-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Newsletter
                  </button>
                  <button
                    onClick={() => setActiveAssetTab("faq")}
                    className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      activeAssetTab === "faq"
                        ? "bg-white text-amber-700 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    FAQ
                  </button>
                  <button
                    onClick={() => setActiveAssetTab("raw")}
                    className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      activeAssetTab === "raw"
                        ? "bg-white text-slate-800 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    JSON OCI
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activeAssetTab === "linkedin" && (
                  <div>
                    {linkedin ? (
                      <div className="space-y-4 max-w-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                            Canal: {linkedin.canal_recomendado || "LinkedIn Oficial"}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            Potencial de Engagement:{" "}
                            <strong className="text-slate-800 font-bold">{linkedin.potencial_engagement}</strong>
                          </span>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Título / Gancho
                          </label>
                          <h4 className="text-base font-bold text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            {linkedin.titulo}
                          </h4>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Copy para Publicación
                          </label>
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                            {linkedin.copy}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No se generó activo de LinkedIn para este paquete.</p>
                    )}
                  </div>
                )}

                {activeAssetTab === "newsletter" && (
                  <div>
                    {newsletter ? (
                      <div className="space-y-4 max-w-2xl">
                        <div>
                          <span className="text-xs font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                            Sección: {newsletter.seccion}
                          </span>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Titular Noticioso
                          </label>
                          <h4 className="text-base font-bold text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            {newsletter.titular}
                          </h4>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Resumen / Entradilla
                          </label>
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                            {newsletter.resumen}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No se generó destaque de newsletter para este paquete.</p>
                    )}
                  </div>
                )}

                {activeAssetTab === "faq" && (
                  <div>
                    {faq ? (
                      <div className="space-y-4 max-w-2xl">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            Sugerencia FAQ
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            Status: <strong className="text-slate-800">{faq.status}</strong>
                          </span>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Pregunta / Tema Frecuente
                          </label>
                          <h4 className="text-base font-bold text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            {faq.tema}
                          </h4>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Origen de la Duda
                          </label>
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                            {faq.origen}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No se generó sugerencia de contenido FAQ para este paquete.</p>
                    )}
                  </div>
                )}

                {activeAssetTab === "raw" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Representación JSON exacta del objeto persistido en OCI:</span>
                      <button
                        onClick={copyRawJSON}
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? "Copiado al portapapeles" : "Copiar todo"}
                      </button>
                    </div>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-[500px] leading-relaxed">
                      {JSON.stringify(currentPackage, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
