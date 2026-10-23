"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Cloud,
  RefreshCw,
  Download,
  Copy,
  Check,
  TrendingUp,
  Table as TableIcon,
  X,
  Eye,
  FileCode,
  Share2,
  Search,
  CheckCircle2,
  Layers,
  BarChart3,
  Sparkles,
  MessageSquare,
  Tag,
  Filter,
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

interface FlatCase extends CasoItem {
  paqueteNombre: string;
  paqueteFecha: string;
  paqueteRuta: string;
  origenComunidad: string;
  periodoReferencia: string;
}

function formatFechaLegible(fechaStr?: string): string {
  if (!fechaStr) return "";
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return fechaStr;
  }
}

export function HistoryView() {
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [selectedPackageRuta, setSelectedPackageRuta] = useState<string>("todos");
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [activeView, setActiveView] = useState<"tabla" | "dashboard">("tabla");

  // Modal de inspección
  const [inspectCase, setInspectCase] = useState<FlatCase | null>(null);
  const [inspectTab, setInspectTab] = useState<"detalle" | "json">("detalle");
  const [inspectActiveChannel, setInspectActiveChannel] = useState<string>("post_linkedin");
  const [copiedModalText, setCopiedModalText] = useState(false);
  const [copiedCaseJson, setCopiedCaseJson] = useState(false);

  // Filtros de la tabla
  const [channelFilter, setChannelFilter] = useState<"todos" | "post_linkedin" | "destaque_newsletter_semanal" | "sugerencia_contenido_faq">("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "aprobados" | "rechazados">("todos");
  const [searchQuery, setSearchQuery] = useState<string>("");

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
      }
    } catch (err) {
      console.error("Error al listar paquetes OCI:", err);
    } finally {
      setIsLoadingList(false);
    }
  };

  // Recolectar todos los casos según el paquete seleccionado
  const allCases: FlatCase[] = useMemo(() => {
    const targetPackages =
      selectedPackageRuta === "todos"
        ? packages
        : packages.filter((p) => p.ruta_objeto === selectedPackageRuta);

    const list: FlatCase[] = [];
    targetPackages.forEach((pkg) => {
      const casos = pkg.data?.casos || [];
      const fecha = formatFechaLegible(pkg.data?.fecha_guardado || pkg.fecha_creacion);
      const origen = pkg.data?.origen_comunidad || "General";
      const periodo = pkg.data?.periodo_referencia || pkg.periodo_referencia;

      casos.forEach((c) => {
        list.push({
          ...c,
          paqueteNombre: pkg.nombre,
          paqueteFecha: fecha,
          paqueteRuta: pkg.ruta_objeto,
          origenComunidad: origen,
          periodoReferencia: periodo,
        });
      });
    });
    return list;
  }, [packages, selectedPackageRuta]);

  // Aplicar filtros a la tabla
  const filteredCases = useMemo(() => {
    return allCases.filter((c) => {
      // 1. Filtro por canal
      if (channelFilter !== "todos") {
        const hasChannel = (c.activos_candidatos || []).some(
          (cand) => cand.tipo_activo === channelFilter
        );
        if (!hasChannel) return false;
      }

      // 2. Filtro por estado
      if (statusFilter !== "todos") {
        const statuses = (c.activos_candidatos || []).map((cand) => cand.estado_aprobacion);
        if (statusFilter === "aprobados") {
          if (!statuses.includes("aprobado")) return false;
        } else if (statusFilter === "rechazados") {
          if (!statuses.includes("rechazado")) return false;
        }
      }

      // 3. Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const autorMatch = c.interaccion.autor.toLowerCase().includes(q);
        const canalMatch = c.interaccion.canal.toLowerCase().includes(q);
        const textoMatch = c.interaccion.texto.toLowerCase().includes(q);
        if (!autorMatch && !canalMatch && !textoMatch) return false;
      }

      return true;
    });
  }, [allCases, channelFilter, statusFilter, searchQuery]);

  // Métricas y estadísticas completas para el Dashboard
  const dashboardStats = useMemo(() => {
    const totalCasos = allCases.length;
    let totalCandidatos = 0;
    let totalAprobados = 0;
    let totalRechazados = 0;
    let totalPendientes = 0;

    const sentimientoCounts: Record<string, number> = { positivo: 0, neutral: 0, negativo: 0 };
    let scoreSentimentSum = 0;
    let sentimentCountWithScore = 0;

    const channelStats = {
      post_linkedin: { total: 0, aprobados: 0, rechazados: 0 },
      destaque_newsletter_semanal: { total: 0, aprobados: 0, rechazados: 0 },
      sugerencia_contenido_faq: { total: 0, aprobados: 0, rechazados: 0 },
    };

    const topicsCounter: Record<string, number> = {};
    const categoriesCounter: Record<string, number> = {};

    let relevanceSum = 0;
    let relevanceCount = 0;
    const relevanceBuckets = { alta: 0, media: 0, baja: 0 }; // >=70, 40-69, <40

    allCases.forEach((c) => {
      // Sentimiento
      const sent = (c.analisis?.sentimiento || "neutral").toLowerCase();
      if (sent.includes("pos")) sentimientoCounts.positivo++;
      else if (sent.includes("neg")) sentimientoCounts.negativo++;
      else sentimientoCounts.neutral++;

      if (typeof c.analisis?.sentimiento_score === "number") {
        scoreSentimentSum += c.analisis.sentimiento_score;
        sentimentCountWithScore++;
      }

      // Relevancia
      const rel = c.oportunidad?.relevance_score;
      if (typeof rel === "number") {
        relevanceSum += rel;
        relevanceCount++;
        if (rel >= 70) relevanceBuckets.alta++;
        else if (rel >= 40) relevanceBuckets.media++;
        else relevanceBuckets.baja++;
      }

      // Categorías
      const cat = c.oportunidad?.categoria || "Sin categoría";
      categoriesCounter[cat] = (categoriesCounter[cat] || 0) + 1;

      // Temas
      (c.analisis?.temas || []).forEach((t) => {
        topicsCounter[t] = (topicsCounter[t] || 0) + 1;
      });

      // Candidatos
      (c.activos_candidatos || []).forEach((cand) => {
        totalCandidatos++;
        if (cand.estado_aprobacion === "aprobado") totalAprobados++;
        else if (cand.estado_aprobacion === "rechazado") totalRechazados++;
        else totalPendientes++;

        const t = cand.tipo_activo as keyof typeof channelStats;
        if (channelStats[t]) {
          channelStats[t].total++;
          if (cand.estado_aprobacion === "aprobado") channelStats[t].aprobados++;
          else if (cand.estado_aprobacion === "rechazado") channelStats[t].rechazados++;
        }
      });
    });

    const topTemas = Object.entries(topicsCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);

    const sortedSent = Object.entries(sentimientoCounts).sort((a, b) => b[1] - a[1]);
    const sentimientoPredominante = sortedSent[0]?.[0] || "neutral";

    const tasaAprobacion =
      totalCandidatos > 0 ? Math.round((totalAprobados / totalCandidatos) * 100) : 0;
    const avgRelevance =
      relevanceCount > 0 ? Math.round(relevanceSum / relevanceCount) : 0;
    const avgSentiment =
      sentimentCountWithScore > 0
        ? (scoreSentimentSum / sentimentCountWithScore).toFixed(2)
        : "0.00";

    return {
      totalCasos,
      totalCandidatos,
      totalAprobados,
      totalRechazados,
      totalPendientes,
      tasaAprobacion,
      sentimientoCounts,
      sentimientoPredominante,
      avgSentiment,
      avgRelevance,
      relevanceBuckets,
      channelStats,
      topTemas,
      categoriesCounter,
    };
  }, [allCases]);

  // Descarga del JSON
  const downloadCurrentJSON = () => {
    if (selectedPackageRuta === "todos") {
      const allData = packages.map((p) => p.data || p);
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "todos-los-paquetes-historial.json";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const currentPkg = packages.find((p) => p.ruta_objeto === selectedPackageRuta);
      if (!currentPkg?.data) return;
      const blob = new Blob([JSON.stringify(currentPkg.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedPackageRuta.split("/").slice(-2).join("-") || "paquete-distribucion.json"}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const openCaseModal = (caso: FlatCase) => {
    setInspectCase(caso);
    setInspectTab("detalle");
    const firstType = caso.activos_candidatos?.[0]?.tipo_activo || "post_linkedin";
    setInspectActiveChannel(firstType);
  };

  const copyModalContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedModalText(true);
    setTimeout(() => setCopiedModalText(false), 2000);
  };

  const copyCaseJsonContent = () => {
    if (!inspectCase) return;
    navigator.clipboard.writeText(JSON.stringify(inspectCase, null, 2));
    setCopiedCaseJson(true);
    setTimeout(() => setCopiedCaseJson(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden h-full">
      {/* 1. ENCABEZADO SUPERIOR LIMPIO */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">Historial</h2>
          <p className="text-xs text-slate-500">Paquetes consolidados guardados en almacenamiento</p>
        </div>

        {/* Pestañas de Vista: [ Tabla de Casos ] [ Dashboard de Comunidad ] */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveView("tabla")}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeView === "tabla"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Tabla de Casos
          </button>
          <button
            onClick={() => setActiveView("dashboard")}
            className={`text-xs px-3 py-1.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeView === "dashboard"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
            Dashboard de Comunidad
          </button>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchPackagesList}
            disabled={isLoadingList}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-2xs"
            title="Refrescar lista de paquetes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingList ? "animate-spin" : ""}`} />
            Actualizar
          </button>

          <button
            onClick={downloadCurrentJSON}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Descargar paquete(s) en formato JSON"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar JSON
          </button>
        </div>
      </div>

      {/* 2. VISTA: TABLA DE CASOS */}
      {activeView === "tabla" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* BARRA DE FILTROS EN UNA SOLA LÍNEA */}
          <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Selector de Paquetes desplegable */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="package-select" className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Paquete:
                </label>
                <select
                  id="package-select"
                  value={selectedPackageRuta}
                  onChange={(e) => setSelectedPackageRuta(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="todos">Todos los paquetes ({packages.length})</option>
                  {packages.map((pkg) => {
                    const fecha = formatFechaLegible(pkg.data?.fecha_guardado || pkg.fecha_creacion);
                    return (
                      <option key={pkg.ruta_objeto} value={pkg.ruta_objeto}>
                        {pkg.nombre} {fecha ? `- ${fecha}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="h-5 w-px bg-slate-200" />

              {/* Filtro por Canal */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => setChannelFilter("todos")}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    channelFilter === "todos"
                      ? "bg-white text-indigo-700 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setChannelFilter("post_linkedin")}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    channelFilter === "post_linkedin"
                      ? "bg-white text-indigo-700 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  LinkedIn
                </button>
                <button
                  onClick={() => setChannelFilter("destaque_newsletter_semanal")}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    channelFilter === "destaque_newsletter_semanal"
                      ? "bg-white text-indigo-700 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Newsletter
                </button>
                <button
                  onClick={() => setChannelFilter("sugerencia_contenido_faq")}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    channelFilter === "sugerencia_contenido_faq"
                      ? "bg-white text-indigo-700 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  FAQ
                </button>
              </div>

              <div className="h-5 w-px bg-slate-200" />

              {/* Filtro por Estado */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  onClick={() => setStatusFilter("todos")}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    statusFilter === "todos"
                      ? "bg-white text-indigo-700 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setStatusFilter("aprobados")}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    statusFilter === "aprobados"
                      ? "bg-white text-emerald-700 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Aprobados
                </button>
                <button
                  onClick={() => setStatusFilter("rechazados")}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                    statusFilter === "rechazados"
                      ? "bg-white text-rose-700 font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Rechazados
                </button>
              </div>
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar autor, canal o texto…"
                className="text-xs pl-8 pr-3 py-1.5 w-60 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>

          {/* TABLA DE CONTENIDO */}
          <div className="flex-1 overflow-auto p-6 bg-slate-50">
            {filteredCases.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-md mx-auto my-8 shadow-xs">
                <Cloud className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-800 mb-1">No se encontraron casos</h3>
                <p className="text-xs text-slate-500">
                  Prueba cambiando el paquete seleccionado o ajustando los filtros de canal y estado.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Fecha / Paquete</th>
                      <th className="py-3 px-3">Autor</th>
                      <th className="py-3 px-3">Canal</th>
                      <th className="py-3 px-3">Categoría</th>
                      <th className="py-3 px-3">Sentimiento</th>
                      <th className="py-3 px-3 text-center">Relevancia</th>
                      <th className="py-3 px-3">Activos</th>
                      <th className="py-3 px-3 text-center">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCases.map((caso, idx) => {
                      const score = caso.oportunidad?.relevance_score ?? 0;
                      const sent = caso.analisis?.sentimiento || "neutral";
                      const candidatos = caso.activos_candidatos || [];

                      return (
                        <tr
                          key={`${caso.interaccion.id}-${idx}`}
                          onClick={() => openCaseModal(caso)}
                          className="hover:bg-slate-50/80 transition cursor-pointer"
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-medium text-slate-800">{caso.paqueteFecha || "--"}</div>
                            <div className="text-[11px] text-slate-400 font-mono truncate max-w-[130px]">
                              {caso.paqueteNombre}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-900 whitespace-nowrap">
                            {caso.interaccion.autor}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px] text-slate-700">
                              {caso.interaccion.canal}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-700">
                            {caso.oportunidad?.categoria || "--"}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                sent.includes("pos")
                                  ? "bg-emerald-100 text-emerald-800"
                                  : sent.includes("neg")
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {sent}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
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
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                                      c.estado_aprobacion === "aprobado"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : c.estado_aprobacion === "rechazado"
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                    title={`${c.tipo_activo} (${c.estado_aprobacion})`}
                                  >
                                    {c.tipo_activo === "post_linkedin"
                                      ? "LinkedIn"
                                      : c.tipo_activo === "destaque_newsletter_semanal"
                                      ? "Newsletter"
                                      : "FAQ"}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Sin activos</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openCaseModal(caso)}
                              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold transition cursor-pointer border border-indigo-200 shadow-2xs"
                              title="Ver activo oficial y detalles"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver activo
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
        </div>
      )}

      {/* 3. VISTA: DASHBOARD DE COMUNIDAD */}
      {activeView === "dashboard" && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
          {/* Selector de paquete dentro del dashboard */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <label htmlFor="dash-package-select" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                Alcance del Dashboard:
              </label>
              <select
                id="dash-package-select"
                value={selectedPackageRuta}
                onChange={(e) => setSelectedPackageRuta(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="todos">Todos los paquetes guardados ({packages.length})</option>
                {packages.map((pkg) => {
                  const fecha = formatFechaLegible(pkg.data?.fecha_guardado || pkg.fecha_creacion);
                  return (
                    <option key={pkg.ruta_objeto} value={pkg.ruta_objeto}>
                      {pkg.nombre} {fecha ? `- ${fecha}` : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Mostrando métricas calculadas sobre <strong>{allCases.length}</strong> casos registrados.
            </div>
          </div>

          {/* 4 TARJETAS KPI PRINCIPALES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Total Interacciones</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">{dashboardStats.totalCasos}</span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  {packages.length} paquete(s) registrados
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Tasa de Aprobación</span>
                <span className="text-2xl font-black text-emerald-600 mt-1 block">
                  {dashboardStats.tasaAprobacion}%
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  {dashboardStats.totalAprobados} de {dashboardStats.totalCandidatos} activos
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Sentimiento Predominante</span>
                <span className="text-lg font-bold capitalize text-slate-900 mt-1 block flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      dashboardStats.sentimientoPredominante.includes("pos")
                        ? "bg-emerald-500"
                        : dashboardStats.sentimientoPredominante.includes("neg")
                        ? "bg-rose-500"
                        : "bg-amber-400"
                    }`}
                  />
                  {dashboardStats.sentimientoPredominante}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Score medio: <strong>{dashboardStats.avgSentiment}</strong>
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 4 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Relevancia Media</span>
                <span className="text-2xl font-black text-indigo-700 mt-1 block">
                  {dashboardStats.avgRelevance} <span className="text-xs font-medium text-slate-400">/ 100</span>
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Potencial editorial de contenido
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* GRÁFICAS VISUALES INTERACTIVAS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfica 1: Distribución de Sentimiento */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Distribución de Sentimiento</h4>
                  <p className="text-xs text-slate-500">Tono emocional de las consultas de la comunidad</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {dashboardStats.totalCasos} casos
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {[
                  {
                    key: "positivo",
                    label: "Positivo",
                    count: dashboardStats.sentimientoCounts.positivo,
                    color: "bg-emerald-500",
                  },
                  {
                    key: "neutral",
                    label: "Neutral",
                    count: dashboardStats.sentimientoCounts.neutral,
                    color: "bg-amber-400",
                  },
                  {
                    key: "negativo",
                    label: "Negativo",
                    count: dashboardStats.sentimientoCounts.negativo,
                    color: "bg-rose-500",
                  },
                ].map((item) => {
                  const pct =
                    dashboardStats.totalCasos > 0
                      ? Math.round((item.count / dashboardStats.totalCasos) * 100)
                      : 0;
                  return (
                    <div key={item.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                          {item.label}
                        </span>
                        <span className="text-slate-500 font-mono">
                          {item.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} transition-all duration-500 rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gráfica 2: Activos por Canal y Aprobación */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Activos Generados por Canal</h4>
                  <p className="text-xs text-slate-500">Distribución y estado por formato editorial</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {dashboardStats.totalCandidatos} activos
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {[
                  {
                    key: "post_linkedin",
                    label: "LinkedIn Posts",
                    stats: dashboardStats.channelStats.post_linkedin,
                  },
                  {
                    key: "destaque_newsletter_semanal",
                    label: "Newsletter Destacados",
                    stats: dashboardStats.channelStats.destaque_newsletter_semanal,
                  },
                  {
                    key: "sugerencia_contenido_faq",
                    label: "FAQ & Mentoring",
                    stats: dashboardStats.channelStats.sugerencia_contenido_faq,
                  },
                ].map((ch) => {
                  const total = ch.stats.total;
                  const aprobPct = total > 0 ? Math.round((ch.stats.aprobados / total) * 100) : 0;
                  const rechPct = total > 0 ? Math.round((ch.stats.rechazados / total) * 100) : 0;
                  return (
                    <div key={ch.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-800">{ch.label}</span>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-700 font-medium">{ch.stats.aprobados} aprob.</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-rose-700 font-medium">{ch.stats.rechazados} rech.</span>
                          <span className="text-slate-400">({total} total)</span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-500"
                          style={{ width: `${aprobPct}%` }}
                          title={`${ch.stats.aprobados} aprobados`}
                        />
                        <div
                          className="bg-rose-500 h-full transition-all duration-500"
                          style={{ width: `${rechPct}%` }}
                          title={`${ch.stats.rechazados} rechazados`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gráfica 3: Top Temas Más Mencionados */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Top Temas de la Comunidad</h4>
                  <p className="text-xs text-slate-500">Conceptos y tecnologías con mayor frecuencia</p>
                </div>
                <Tag className="w-4 h-4 text-indigo-600" />
              </div>

              {dashboardStats.topTemas.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4 text-center">
                  No hay temas registrados en el paquete seleccionado.
                </p>
              ) : (
                <div className="space-y-2.5 pt-1">
                  {dashboardStats.topTemas.map(([tema, freq], i) => {
                    const maxFreq = dashboardStats.topTemas[0]?.[1] || 1;
                    const pct = Math.round((freq / maxFreq) * 100);
                    return (
                      <div key={tema} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-800 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-700 text-[10px] flex items-center justify-center font-bold">
                              {i + 1}
                            </span>
                            #{tema}
                          </span>
                          <span className="text-indigo-600 font-mono">
                            {freq} mención{freq !== 1 ? "es" : ""}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gráfica 4: Niveles de Relevancia Editorial */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Niveles de Relevancia</h4>
                  <p className="text-xs text-slate-500">Clasificación de valor editorial de las interacciones</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                  Score medio: {dashboardStats.avgRelevance}/100
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {[
                  {
                    label: "Alta Relevancia (70 - 100)",
                    desc: "Casos con alto valor para publicación",
                    count: dashboardStats.relevanceBuckets.alta,
                    color: "bg-indigo-600",
                  },
                  {
                    label: "Media Relevancia (40 - 69)",
                    desc: "Casos para boletines o resúmenes",
                    count: dashboardStats.relevanceBuckets.media,
                    color: "bg-amber-500",
                  },
                  {
                    label: "Baja Relevancia (0 - 39)",
                    desc: "Soporte rápido o interacciones menores",
                    count: dashboardStats.relevanceBuckets.baja,
                    color: "bg-slate-400",
                  },
                ].map((b) => {
                  const pct =
                    dashboardStats.totalCasos > 0
                      ? Math.round((b.count / dashboardStats.totalCasos) * 100)
                      : 0;
                  return (
                    <div key={b.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <div>
                          <span className="text-slate-800 block">{b.label}</span>
                          <span className="text-[11px] text-slate-400 font-normal">{b.desc}</span>
                        </div>
                        <span className="text-slate-700 font-mono">
                          {b.count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${b.color} transition-all duration-500 rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL COMPLETO DE INSPECCIÓN (VER ACTIVO / LECTURA COMPLETA) */}
      {inspectCase && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectCase(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del modal */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>{inspectCase.interaccion.autor}</span>
                  <span className="text-xs font-normal text-slate-500">
                    <code className="font-mono font-semibold text-indigo-700">{inspectCase.interaccion.canal}</code>
                    {inspectCase.interaccion.timestamp && ` · ${formatFechaLegible(inspectCase.interaccion.timestamp)}`}
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Paquete: <strong>{inspectCase.paqueteNombre}</strong> · {inspectCase.origenComunidad}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Selector de pestañas: Vista Detallada vs JSON */}
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                  <button
                    onClick={() => setInspectTab("detalle")}
                    className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      inspectTab === "detalle"
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Vista Detallada
                  </button>
                  <button
                    onClick={() => setInspectTab("json")}
                    className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      inspectTab === "json"
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    JSON del Caso
                  </button>
                </div>

                <button
                  onClick={() => setInspectCase(null)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Contenido del modal */}
            <div className="flex-1 overflow-y-auto">
              {inspectTab === "detalle" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  {/* COLUMNA IZQUIERDA: Interacción Original, Análisis IA, Clasificación */}
                  <div className="p-6 space-y-5 bg-slate-50/50 overflow-y-auto">
                    {/* Interacción Original */}
                    <div className="space-y-2">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Interacción original
                      </h5>
                      <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs text-slate-800 leading-relaxed font-sans">
                        <p className="italic">&ldquo;{inspectCase.interaccion.texto}&rdquo;</p>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Tipo declarado: <strong className="text-slate-600">{inspectCase.interaccion.tipo}</strong></span>
                        <span className="italic">(no se usa para clasificar)</span>
                      </div>
                    </div>

                    {/* Análisis IA */}
                    <div className="space-y-3 pt-1 border-t border-slate-200">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Análisis IA
                      </h5>

                      {/* Sentimiento */}
                      <div>
                        <span className="text-xs text-slate-500 block mb-1 font-medium">Sentimiento</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              (inspectCase.analisis?.sentimiento || "").includes("pos")
                                ? "bg-emerald-100 text-emerald-800"
                                : (inspectCase.analisis?.sentimiento || "").includes("neg")
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {inspectCase.analisis?.sentimiento || "neutral"}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            ({typeof inspectCase.analisis?.sentimiento_score === "number"
                              ? inspectCase.analisis.sentimiento_score >= 0
                                ? `+${inspectCase.analisis.sentimiento_score.toFixed(2)}`
                                : inspectCase.analisis.sentimiento_score.toFixed(2)
                              : "0.00"})
                          </span>
                        </div>
                      </div>

                      {/* Temas */}
                      <div>
                        <span className="text-xs text-slate-500 block mb-1 font-medium">Temas</span>
                        <div className="flex flex-wrap gap-1">
                          {(inspectCase.analisis?.temas || []).length > 0 ? (
                            inspectCase.analisis?.temas.map((tema, i) => (
                              <span
                                key={i}
                                className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-medium"
                              >
                                #{tema}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sin temas identificados</span>
                          )}
                        </div>
                      </div>

                      {/* Entidades */}
                      <div>
                        <span className="text-xs text-slate-500 block mb-1 font-medium">Entidades</span>
                        <div className="flex flex-wrap gap-1">
                          {(inspectCase.analisis?.entidades || []).length > 0 ? (
                            inspectCase.analisis?.entidades.map((ent, i) => (
                              <span
                                key={i}
                                className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium"
                              >
                                {ent}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">Sin entidades</span>
                          )}
                        </div>
                      </div>

                      {/* Resumen */}
                      {inspectCase.analisis?.resumen && (
                        <div>
                          <span className="text-xs text-slate-500 block mb-1 font-medium">Resumen</span>
                          <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                            {inspectCase.analisis.resumen}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Clasificación */}
                    <div className="space-y-3 pt-1 border-t border-slate-200">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Clasificación
                      </h5>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-slate-500 block mb-1 font-medium">Categoría</span>
                          <span className="text-xs font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 block truncate">
                            {inspectCase.oportunidad?.categoria || "Sin categoría"}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block mb-1 font-medium">Relevancia</span>
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 block">
                            {inspectCase.oportunidad?.relevance_score ?? 0} / 100
                          </span>
                        </div>
                      </div>

                      {inspectCase.enrutamiento?.motivo && (
                        <div>
                          <span className="text-xs text-slate-500 block mb-1 font-medium">Motivo</span>
                          <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                            {inspectCase.enrutamiento.motivo}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COLUMNA DERECHA: Contenido Generado por Canales (Read-Only) */}
                  <div className="p-6 space-y-5 overflow-y-auto">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Contenido generado
                        </h5>
                      </div>

                      {/* Selector de canales (LinkedIn / Newsletter / FAQ) */}
                      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-3">
                        {(inspectCase.activos_candidatos || []).map((cand) => {
                          const isSel = inspectActiveChannel === cand.tipo_activo;
                          const channelName =
                            cand.tipo_activo === "post_linkedin"
                              ? "LinkedIn"
                              : cand.tipo_activo === "destaque_newsletter_semanal"
                              ? "Newsletter"
                              : "FAQ";
                          return (
                            <button
                              key={cand.candidato_id}
                              onClick={() => setInspectActiveChannel(cand.tipo_activo)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-2 ${
                                isSel
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              <span>{channelName}</span>
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  cand.estado_aprobacion === "aprobado"
                                    ? "bg-emerald-400"
                                    : cand.estado_aprobacion === "rechazado"
                                    ? "bg-rose-400"
                                    : "bg-amber-300 animate-pulse"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>

                      {/* Contenido del canal activo */}
                      {(() => {
                        const currentCand =
                          (inspectCase.activos_candidatos || []).find(
                            (c) => c.tipo_activo === inspectActiveChannel
                          ) || (inspectCase.activos_candidatos || [])[0];

                        if (!currentCand) {
                          return (
                            <div className="p-8 text-center text-slate-400 text-xs italic">
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
                              <span className="text-xs text-slate-500 font-medium">Estado del activo:</span>
                              <span
                                className={`text-xs font-bold px-2.5 py-0.5 rounded-full capitalize ${
                                  estado === "aprobado"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : estado === "rechazado"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {estado}
                              </span>
                            </div>

                            {/* Formatos específicos */}
                            {tipo === "post_linkedin" && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                                  <span>Canal: <strong>{content.canal_recomendado || "LinkedIn Oficial"}</strong></span>
                                  {content.potencial_engagement && (
                                    <span>Engagement: <strong className="text-indigo-600">{content.potencial_engagement}</strong></span>
                                  )}
                                </div>
                                <div>
                                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Título
                                  </label>
                                  <div className="text-xs font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                    {content.titulo}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Copy
                                  </label>
                                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                                    {content.copy}
                                  </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                  <button
                                    onClick={() => copyModalContent(`${content.titulo}\n\n${content.copy}`)}
                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-semibold transition cursor-pointer shadow-2xs"
                                  >
                                    {copiedModalText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-white" />}
                                    {copiedModalText ? "¡Copiado!" : "Copiar contenido"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {tipo === "destaque_newsletter_semanal" && (
                              <div className="space-y-3">
                                <div>
                                  <span className="text-xs font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                                    Sección: {content.seccion || "Historia de la Semana"}
                                  </span>
                                </div>
                                <div>
                                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Titular
                                  </label>
                                  <div className="text-xs font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                    {content.titular}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Resumen
                                  </label>
                                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                                    {content.resumen}
                                  </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                  <button
                                    onClick={() => copyModalContent(`${content.titular}\n\n${content.resumen}`)}
                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-semibold transition cursor-pointer shadow-2xs"
                                  >
                                    {copiedModalText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-white" />}
                                    {copiedModalText ? "¡Copiado!" : "Copiar contenido"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {tipo === "sugerencia_contenido_faq" && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                                  <span>Status: <strong className="text-slate-800">{content.status || "derivado_a_mentoria"}</strong></span>
                                </div>
                                <div>
                                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Tema / Pregunta
                                  </label>
                                  <div className="text-xs font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                    {content.tema}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Origen / Contexto
                                  </label>
                                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                                    {content.origen}
                                  </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                  <button
                                    onClick={() => copyModalContent(`${content.tema}\n\n${content.origen}`)}
                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-semibold transition cursor-pointer shadow-2xs"
                                  >
                                    {copiedModalText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-white" />}
                                    {copiedModalText ? "¡Copiado!" : "Copiar contenido"}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ) : (
                /* VISTA: JSON DEL CASO */
                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Estructura JSON completa del caso persistido:</span>
                    <button
                      onClick={copyCaseJsonContent}
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    >
                      {copiedCaseJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCaseJson ? "¡Copiado!" : "Copiar JSON"}
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-[480px] leading-relaxed">
                    {JSON.stringify(inspectCase, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer del modal: estrictamente de lectura */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Registro consolidado · Modo solo lectura
              </span>
              <button
                onClick={() => setInspectCase(null)}
                className="text-xs px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}