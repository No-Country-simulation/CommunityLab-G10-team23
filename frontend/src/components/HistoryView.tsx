"use client";

import React, { useEffect, useState } from "react";
import {
  Cloud,
  RefreshCw,
  FolderArchive,
  Download,
  Copy,
  Check,
  Package,
  Layers,
  FileCode,
  Share2,
  FileText,
  HelpCircle,
  TrendingUp,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Table as TableIcon,
  X,
  Eye,
  CheckCircle2,
  AlertCircle,
  Hash,
  Tag,
} from "lucide-react";

interface CasoItem {
  interaccion: {
    id: string;
    autor: string;
    canal: string;
    tipo: string;
    texto: string;
    timestamp?: string;
  };
  analisis?: {
    sentimiento: string;
    sentimiento_score: number;
    temas: string[];
    entidades: string[];
    resumen: string;
    intencion: string;
  };
  oportunidad?: {
    categoria: string;
    relevance_score: number;
  };
  enrutamiento?: {
    ruta: string;
    motivo: string;
  };
  activos_candidatos?: Array<{
    candidato_id: string;
    tipo_activo: string;
    contenido: Record<string, any>;
    estado_aprobacion: string;
  }>;
  degradado?: boolean;
}

interface PackageData {
  status: string;
  nombre_paquete?: string;
  periodo_referencia?: string;
  origen_comunidad?: string;
  fecha_guardado?: string;
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
  casos?: CasoItem[];
}

interface PackageSummary {
  nombre: string;
  periodo_referencia: string;
  ruta_objeto: string;
  tamano_bytes: number;
  fecha_creacion?: string;
  total_casos?: number;
  data?: PackageData;
}

export function HistoryView() {
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [currentPackage, setCurrentPackage] = useState<PackageData | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCase, setCopiedCase] = useState(false);
  const [activeTab, setActiveTab] = useState<"casos" | "json" | "activos" | "metricas">("casos");
  const [activeAssetTab, setActiveAssetTab] = useState<"linkedin" | "newsletter" | "faq">("linkedin");
  const [inspectCase, setInspectCase] = useState<CasoItem | null>(null);

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
          // Seleccionar el primer paquete (el más reciente) por default
          const firstPkg = json.packages[0];
          setSelectedPath(firstPkg.ruta_objeto);
          if (firstPkg.data) {
            setCurrentPackage(firstPkg.data);
          } else {
            loadPackage(firstPkg.ruta_objeto);
          }
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

  const selectPackage = (pkg: PackageSummary) => {
    setSelectedPath(pkg.ruta_objeto);
    if (pkg.data) {
      setCurrentPackage(pkg.data);
    } else {
      loadPackage(pkg.ruta_objeto);
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

  const copyCaseJSON = (caso: CasoItem) => {
    navigator.clipboard.writeText(JSON.stringify(caso, null, 2));
    setCopiedCase(true);
    setTimeout(() => setCopiedCase(false), 2000);
  };

  const downloadJSON = () => {
    if (!currentPackage) return;
    const blob = new Blob([JSON.stringify(currentPackage, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedPath.split("/").slice(-2).join("-") || "paquete-distribucion.json"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSummary = packages.find((p) => p.ruta_objeto === selectedPath);
  const packageName = currentPackage?.nombre_paquete || currentSummary?.nombre || "Paquete";
  const casos: CasoItem[] = currentPackage?.casos || [];
  const resumen = currentPackage?.resumen_comunidad;
  const activos = currentPackage?.activos_distribucion_generados;
  const linkedin = activos?.post_linkedin;
  const newsletter = activos?.destaque_newsletter_semanal;
  const faq = activos?.sugerencia_contenido_faq;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden h-full">
      {/* 1. BARRA SUPERIOR DE INFORMACIÓN DE OCI BUCKET */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800">Historial de Paquetes en OCI Object Storage</h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Oracle Cloud Always Free
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Paquetes JSON consolidados persistidos bajo <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-700">activos/</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchPackagesList}
            disabled={isLoadingList || isLoadingDetail}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-2xs"
            title="Refrescar lista desde OCI"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList || isLoadingDetail ? "animate-spin" : ""}`} />
            Actualizar OCI
          </button>

          {currentPackage && (
            <>
              <button
                onClick={copyRawJSON}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Copiar JSON completo"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copiado" : "Copiar JSON"}
              </button>
              <button
                onClick={downloadJSON}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Descargar archivo JSON completo"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. SELECTOR SECUENCIAL DE PAQUETES (PAQUETE 1, PAQUETE 2, ...) */}
      <div className="bg-slate-100/90 border-b border-slate-200 px-6 py-2.5 flex items-center gap-3 overflow-x-auto">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1 shrink-0">
          <Layers className="w-3.5 h-3.5 text-indigo-600" />
          Paquetes ({packages.length}):
        </span>

        {packages.length === 0 ? (
          <span className="text-xs text-slate-400 italic">No hay paquetes publicados aún en el Bucket</span>
        ) : (
          <div className="flex items-center gap-2">
            {packages.map((pkg) => {
              const active = pkg.ruta_objeto === selectedPath;
              const count = pkg.total_casos ?? pkg.data?.casos?.length ?? 0;
              return (
                <button
                  key={pkg.ruta_objeto}
                  onClick={() => selectPackage(pkg)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-2 cursor-pointer shadow-2xs shrink-0 ${
                    active
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>{pkg.nombre}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      active ? "bg-indigo-500/40 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count} {count === 1 ? "caso" : "casos"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. SUB-BARRA DE DETALLES DEL PAQUETE SELECCIONADO Y PESTAÑAS */}
      {selectedPath && (
        <div className="bg-white border-b border-slate-200 px-6 py-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600">
            <span className="font-bold text-slate-900 text-sm">{packageName}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Ruta OCI:</span>
            <code className="bg-slate-100 text-indigo-800 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold">
              {selectedPath}
            </code>
            {currentPackage?.periodo_referencia && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Periodo: <strong>{currentPackage.periodo_referencia}</strong></span>
              </>
            )}
            {currentPackage?.origen_comunidad && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Origen: <strong>{currentPackage.origen_comunidad}</strong></span>
              </>
            )}
          </div>

          {/* Selector de Pestañas: Tabla de Casos | JSON Completo | Activos Oficiales | Métricas */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab("casos")}
              className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "casos"
                  ? "bg-white text-indigo-700 font-bold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Tabla con cada Caso ({casos.length})
            </button>
            <button
              onClick={() => setActiveTab("json")}
              className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "json"
                  ? "bg-white text-indigo-700 font-bold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              JSON Completo OCI
            </button>
            <button
              onClick={() => setActiveTab("activos")}
              className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "activos"
                  ? "bg-white text-indigo-700 font-bold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              Activos Oficiales
            </button>
            <button
              onClick={() => setActiveTab("metricas")}
              className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "metricas"
                  ? "bg-white text-indigo-700 font-bold shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Resumen Comunidad
            </button>
          </div>
        </div>
      )}

      {/* 4. CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isLoadingDetail ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Descargando contenido completo del paquete desde OCI…</span>
          </div>
        ) : !currentPackage ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400 text-center">
            <FolderArchive className="w-12 h-12 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No hay paquetes publicados aún en OCI Object Storage</p>
            <p className="text-xs max-w-sm text-slate-500">
              Carga un lote en la Bandeja de Revisión y presiona el botón &quot;Guardar cambios&quot; en la barra superior para persistir el paquete de distribución oficial.
            </p>
          </div>
        ) : (
          <>
            {/* VISTA 1: TABLA CON CADA CASO */}
            {activeTab === "casos" && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <TableIcon className="w-4 h-4 text-indigo-600" />
                      Casos del {packageName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Total de interacciones analizadas y persistidas en OCI ({casos.length} casos)
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Bucket: <strong className="text-slate-800">communitylab-activos-marketing</strong>
                  </div>
                </div>

                {casos.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm space-y-2">
                    <p className="font-semibold text-slate-700">Este paquete no incluye el listado detallado de casos.</p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Fue creado en una versión previa. Los nuevos paquetes guardados con el botón &quot;Guardar cambios&quot; almacenan todos los casos automáticamente.
                    </p>
                    <button
                      onClick={() => setActiveTab("json")}
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-600 font-semibold hover:underline mt-2"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      Ver el JSON Completo disponible en OCI
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                          <th className="py-2.5 px-3 w-12 text-center">#</th>
                          <th className="py-2.5 px-3">Autor</th>
                          <th className="py-2.5 px-3">Canal / Tipo</th>
                          <th className="py-2.5 px-3 min-w-[280px]">Mensaje / Consulta</th>
                          <th className="py-2.5 px-3">Sentimiento</th>
                          <th className="py-2.5 px-3">Categoría</th>
                          <th className="py-2.5 px-3 text-center">Relevancia</th>
                          <th className="py-2.5 px-3">Activos Derivados</th>
                          <th className="py-2.5 px-3 text-center">Detalle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {casos.map((caso, idx) => {
                          const inter = caso.interaccion;
                          const ana = caso.analisis;
                          const op = caso.oportunidad;
                          const score = op?.relevance_score ?? 0;
                          const candidatos = caso.activos_candidatos ?? [];

                          const sentLabel = ana?.sentimiento || "Neutral";
                          const isPos = sentLabel.toLowerCase().includes("pos");
                          const isNeg = sentLabel.toLowerCase().includes("neg");

                          const catLabel = op?.categoria
                            ? op.categoria.replace(/_/g, " ")
                            : "General";

                          return (
                            <tr key={inter.id || idx} className="hover:bg-indigo-50/20 transition">
                              <td className="py-3 px-3 text-center font-mono text-slate-400 font-bold">
                                {idx + 1}
                              </td>
                              <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                                {inter.autor}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                                  {inter.canal}
                                </span>
                                <span className="text-slate-400 block text-[10px] mt-0.5">
                                  {inter.tipo}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-700 leading-relaxed max-w-md">
                                <p className="line-clamp-2" title={inter.texto}>
                                  {inter.texto}
                                </p>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isPos
                                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                      : isNeg
                                      ? "bg-rose-50 text-rose-800 border border-rose-200"
                                      : "bg-slate-100 text-slate-700 border border-slate-200"
                                  }`}
                                >
                                  {sentLabel}
                                  {ana?.sentimiento_score !== undefined && (
                                    <span className="text-[9px] opacity-75">
                                      ({ana.sentimiento_score > 0 ? "+" : ""}{ana.sentimiento_score.toFixed(2)})
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap">
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                  {catLabel}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                    score >= 70
                                      ? "bg-indigo-100 text-indigo-800"
                                      : score >= 40
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                                >
                                  {score.toFixed(0)}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex flex-wrap gap-1">
                                  {candidatos.length > 0 ? (
                                    candidatos.map((c) => (
                                      <span
                                        key={c.candidato_id}
                                        className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                                        title={`${c.tipo_activo} (${c.estado_aprobacion})`}
                                      >
                                        {c.tipo_activo.replace(/_/g, " ")}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 text-[11px] italic">Sin activos</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <button
                                  onClick={() => setInspectCase(caso)}
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-medium transition cursor-pointer border border-slate-200"
                                  title="Ver JSON individual de este caso"
                                >
                                  <Eye className="w-3 h-3" />
                                  JSON
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* VISTA 2: JSON COMPLETO TAL CUAL SE GUARDA EN OCI */}
            {activeTab === "json" && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-bold text-slate-800">
                      JSON Completo del Objeto en OCI
                    </span>
                    <span className="text-xs text-slate-500 font-mono">({selectedPath})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={copyRawJSON}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      {copied ? "¡Copiado!" : "Copiar JSON"}
                    </button>
                    <button
                      onClick={downloadJSON}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 font-semibold transition cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      Descargar archivo
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-slate-900 overflow-x-auto max-h-[600px]">
                  <pre className="text-slate-100 text-xs font-mono leading-relaxed">
                    {JSON.stringify(currentPackage, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* VISTA 3: ACTIVOS OFICIALES DE MARKETING (LINKEDIN, NEWSLETTER, FAQ) */}
            {activeTab === "activos" && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="border-b border-slate-200 px-6 pt-4 flex gap-2">
                  <button
                    onClick={() => setActiveAssetTab("linkedin")}
                    className={`text-xs px-3 py-2 border-b-2 font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      activeAssetTab === "linkedin"
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    LinkedIn
                    {linkedin && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                  </button>

                  <button
                    onClick={() => setActiveAssetTab("newsletter")}
                    className={`text-xs px-3 py-2 border-b-2 font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      activeAssetTab === "newsletter"
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Newsletter Semanal
                    {newsletter && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                  </button>

                  <button
                    onClick={() => setActiveAssetTab("faq")}
                    className={`text-xs px-3 py-2 border-b-2 font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      activeAssetTab === "faq"
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Sugerencia FAQ
                    {faq && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                  </button>
                </div>

                <div className="p-6">
                  {activeAssetTab === "linkedin" && (
                    <div>
                      {linkedin ? (
                        <div className="space-y-4 max-w-2xl">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                              Canal: {linkedin.canal_recomendado || "LinkedIn Oficial"}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              Potencial de Engagement: <strong className="text-indigo-600">{linkedin.potencial_engagement}</strong>
                            </span>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Título del Post
                            </label>
                            <h4 className="text-base font-bold text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-200">
                              {linkedin.titulo}
                            </h4>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Copy Propuesto para LinkedIn
                            </label>
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                              {linkedin.copy}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">No se generó post de LinkedIn para este paquete.</p>
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
                </div>
              </div>
            )}

            {/* VISTA 4: MÉTRICAS Y RESUMEN DE COMUNIDAD */}
            {activeTab === "metricas" && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Resumen de la Comunidad en {packageName}
                </h3>
                {resumen ? (
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
                          <span className="text-xs text-slate-400 italic">No se identificaron temas</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No hay métricas registradas para este paquete.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 5. MODAL DE INSPECCIÓN JSON DEL CASO INDIVIDUAL */}
      {inspectCase && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectCase(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Caso: {inspectCase.interaccion.autor} ({inspectCase.interaccion.canal})
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyCaseJSON(inspectCase)}
                  className="text-xs px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer flex items-center gap-1"
                >
                  {copiedCase ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copiedCase ? "Copiado" : "Copiar"}
                </button>
                <button
                  onClick={() => setInspectCase(null)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-900 overflow-y-auto flex-1 font-mono text-xs text-slate-100 leading-relaxed">
              <pre>{JSON.stringify(inspectCase, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
