"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Cloud,
  RefreshCw,
  FolderArchive,
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
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  Layers,
  ChevronDown,
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
  const [inspectCase, setInspectCase] = useState<FlatCase | null>(null);
  const [inspectTab, setInspectTab] = useState<"activo" | "json">("activo");
  const [inspectActiveChannel, setInspectActiveChannel] = useState<string>("post_linkedin");
  const [showGlobalResumenModal, setShowGlobalResumenModal] = useState(false);
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

  // Aplicar filtros: Canal, Estado (Aprobados/Rechazados) y Búsqueda
  const filteredCases = useMemo(() => {
    return allCases.filter((c) => {
      // 1. Filtro por canal
      if (channelFilter !== "todos") {
        const hasChannel = (c.activos_candidatos || []).some(
          (cand) => cand.tipo_activo === channelFilter
        );
        if (!hasChannel) return false;
      }

      // 2. Filtro por estado (Aprobados / Rechazados)
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

  // Métricas globales acumuladas para el botón "Resumen Comunidad"
  const globalResumen = useMemo(() => {
    let totalInteracciones = 0;
    const temasCounter: Record<string, number> = {};
    const sentimientos: string[] = [];

    packages.forEach((pkg) => {
      const data = pkg.data;
      if (data?.resumen_comunidad) {
        totalInteracciones += data.resumen_comunidad.total_interacciones_procesadas || 0;
        if (data.resumen_comunidad.sentimiento_predominante) {
          sentimientos.push(data.resumen_comunidad.sentimiento_predominante);
        }
        (data.resumen_comunidad.temas_principales || []).forEach((t) => {
          temasCounter[t] = (temasCounter[t] || 0) + 1;
        });
      } else if (data?.casos) {
        totalInteracciones += data.casos.length;
        data.casos.forEach((c) => {
          if (c.analisis?.sentimiento) sentimientos.push(c.analisis.sentimiento);
          (c.analisis?.temas || []).forEach((t) => {
            temasCounter[t] = (temasCounter[t] || 0) + 1;
          });
        });
      }
    });

    const sentCount: Record<string, number> = {};
    sentimientos.forEach((s) => (sentCount[s] = (sentCount[s] || 0) + 1));
    const sortedSent = Object.entries(sentCount).sort((a, b) => b[1] - a[1]);
    const sentimientoPredominante = sortedSent[0]?.[0] || "Positivo";

    const topTemas = Object.entries(temasCounter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tema]) => tema);

    return {
      totalInteracciones,
      totalPaquetes: packages.length,
      sentimientoPredominante,
      temasPrincipales: topTemas,
    };
  }, [packages]);

  // Descarga del JSON
  const downloadCurrentJSON = () => {
    if (selectedPackageRuta === "todos") {
      const allData = packages.map((p) => p.data || p);
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `todos-los-paquetes-historial.json`;
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

  const selectedPkgData = packages.find((p) => p.ruta_objeto === selectedPackageRuta);

  const openCaseModal = (caso: FlatCase) => {
    setInspectCase(caso);
    setInspectTab("activo");
    // Preseleccionar el primer canal disponible
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
      {/* 1. ENCABEZADO LIMPIO */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">Historial</h2>
          <p className="text-xs text-slate-500">Paquetes JSON consolidados</p>
        </div>

        {/* 2. BOTONES SUPERIORES: [ Actualizar ] [ Resumen Comunidad ] [ Descargar JSON ] */}
        <div className="flex items-center gap-2.5 flex-wrap">
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
            onClick={() => setShowGlobalResumenModal(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Ver métricas consolidadas de todos los paquetes"
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            Resumen Comunidad
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

      {/* 3. BARRA DE FILTROS PROFESIONAL */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Selector de Paquetes desplegable */}
          <div className="flex items-center gap-2">
            <label htmlFor="package-select" className="text-xs font-semibold text-slate-600 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Paquete:
            </label>
            <select
              id="package-select"
              value={selectedPackageRuta}
              onChange={(e) => setSelectedPackageRuta(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="todos">Todos los paquetes (acumulado)</option>
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

          {/* Badge de Origen y Periodo cuando se selecciona un paquete específico */}
          {selectedPkgData && (
            <div className="inline-flex items-center gap-2 text-xs bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-700">
              <span>
                Origen: <strong>{selectedPkgData.data?.origen_comunidad || "General"}</strong>
              </span>
              <span className="text-slate-300">·</span>
              <span>
                Periodo: <strong>{selectedPkgData.data?.periodo_referencia || selectedPkgData.periodo_referencia}</strong>
              </span>
            </div>
          )}

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

          {/* Filtro por Estado (Sin "Pendientes") */}
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
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
                statusFilter === "aprobados"
                  ? "bg-white text-emerald-700 font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Aprobados
            </button>
            <button
              onClick={() => setStatusFilter("rechazados")}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
                statusFilter === "rechazados"
                  ? "bg-white text-rose-700 font-bold shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <XCircle className="w-3 h-3 text-rose-600" />
              Rechazados
            </button>
          </div>
        </div>

        {/* Buscador interactivo */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por autor, texto o canal…"
            className="text-xs pl-8 pr-3 py-1.5 w-60 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </div>

      {/* 4. TABLA DE CASOS */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoadingList ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span>Cargando historial de paquetes…</span>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 text-center bg-white rounded-xl border border-slate-200 p-8">
            <FolderArchive className="w-10 h-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No hay casos para mostrar con los filtros seleccionados</p>
            <p className="text-xs text-slate-500 max-w-sm">
              Prueba cambiando el canal, el estado de aprobación o seleccionando &quot;Todos los paquetes&quot;.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold">
                Mostrando <strong className="text-slate-900">{filteredCases.length}</strong> {filteredCases.length === 1 ? "caso" : "casos"}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {selectedPackageRuta === "todos" ? "Vista acumulada de toda la comunidad" : selectedPackageRuta}
              </span>
            </div>

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
                  {filteredCases.map((caso, idx) => {
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
                      <tr
                        key={inter.id || idx}
                        onClick={() => openCaseModal(caso)}
                        className="hover:bg-indigo-50/20 transition cursor-pointer"
                      >
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
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                                    c.estado_aprobacion === "aprobado"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : c.estado_aprobacion === "rechazado"
                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
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
                            title="Ver activo oficial y JSON"
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
          </div>
        )}
      </div>

      {/* 5. MODAL UNIFICADO: ACTIVO OFICIAL + JSON DEL CASO */}
      {inspectCase && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectCase(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del modal */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Caso: {inspectCase.interaccion.autor}
                </h4>
                <p className="text-xs text-slate-500">
                  Canal: <code className="font-mono text-indigo-700">{inspectCase.interaccion.canal}</code> · {inspectCase.paqueteNombre}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Selector de pestañas dentro del modal: Activo Oficial vs JSON */}
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                  <button
                    onClick={() => setInspectTab("activo")}
                    className={`text-xs px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      inspectTab === "activo"
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Activo Oficial
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
            <div className="flex-1 overflow-y-auto p-6">
              {inspectTab === "activo" ? (
                <div className="space-y-4">
                  {/* Selector de canal si el caso tiene varios candidatos */}
                  {(inspectCase.activos_candidatos || []).length > 1 && (
                    <div className="flex items-center gap-1 border-b border-slate-200 pb-3">
                      {(inspectCase.activos_candidatos || []).map((cand) => (
                        <button
                          key={cand.candidato_id}
                          onClick={() => setInspectActiveChannel(cand.tipo_activo)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                            inspectActiveChannel === cand.tipo_activo
                              ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {cand.tipo_activo === "post_linkedin"
                            ? "LinkedIn"
                            : cand.tipo_activo === "destaque_newsletter_semanal"
                            ? "Newsletter"
                            : "FAQ"}
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              cand.estado_aprobacion === "aprobado"
                                ? "bg-emerald-500"
                                : cand.estado_aprobacion === "rechazado"
                                ? "bg-rose-500"
                                : "bg-amber-400"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Renderizar el activo correspondiente */}
                  {(() => {
                    const currentCand =
                      (inspectCase.activos_candidatos || []).find(
                        (c) => c.tipo_activo === inspectActiveChannel
                      ) || (inspectCase.activos_candidatos || [])[0];

                    if (!currentCand) {
                      return (
                        <div className="p-8 text-center text-slate-400 text-sm italic">
                          No se generó contenido para este canal en este caso.
                        </div>
                      );
                    }

                    const tipo = currentCand.tipo_activo;
                    const content = currentCand.contenido;

                    if (tipo === "post_linkedin") {
                      const fullCopy = `${content.titulo}\n\n${content.copy}`;
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                            <span>Canal recomendado: <strong>{content.canal_recomendado || "LinkedIn Oficial"}</strong></span>
                            {content.potencial_engagement && (
                              <span>Engagement estimado: <strong className="text-indigo-600">{content.potencial_engagement}</strong></span>
                            )}
                          </div>
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Título del Post
                            </label>
                            <h4 className="text-sm font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              {content.titulo}
                            </h4>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Copy Propuesto para LinkedIn
                            </label>
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                              {content.copy}
                            </div>
                          </div>
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => copyModalContent(fullCopy)}
                              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-semibold transition cursor-pointer shadow-2xs"
                            >
                              {copiedModalText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedModalText ? "¡Copiado al portapapeles!" : "Copiar texto completo"}
                            </button>
                          </div>
                        </div>
                      );
                    } else if (tipo === "destaque_newsletter_semanal") {
                      const fullNewsletter = `${content.titular}\n\n${content.resumen}`;
                      return (
                        <div className="space-y-4">
                          <div>
                            <span className="text-xs font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                              Sección: {content.seccion || "Comunidad y Tendencias"}
                            </span>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Titular Noticioso
                            </label>
                            <h4 className="text-sm font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              {content.titular}
                            </h4>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Resumen / Entradilla
                            </label>
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                              {content.resumen}
                            </div>
                          </div>
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => copyModalContent(fullNewsletter)}
                              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-semibold transition cursor-pointer shadow-2xs"
                            >
                              {copiedModalText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedModalText ? "¡Copiado al portapapeles!" : "Copiar resumen"}
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      const fullFaq = `${content.tema}\n\n${content.origen}`;
                      return (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-100 pb-2">
                            <span>Status: <strong className="text-slate-800">{content.status || "derivado_a_mentoria"}</strong></span>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Pregunta / Tema Frecuente
                            </label>
                            <h4 className="text-sm font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              {content.tema}
                            </h4>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Origen de la Duda
                            </label>
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                              {content.origen}
                            </div>
                          </div>
                          <div className="flex justify-end pt-2">
                            <button
                              onClick={() => copyModalContent(fullFaq)}
                              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-semibold transition cursor-pointer shadow-2xs"
                            >
                              {copiedModalText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiedModalText ? "¡Copiado al portapapeles!" : "Copiar FAQ"}
                            </button>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Estructura JSON completa del caso:</span>
                    <button
                      onClick={copyCaseJsonContent}
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
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
          </div>
        </div>
      )}

      {/* 6. MODAL DE RESUMEN COMUNIDAD GLOBAL */}
      {showGlobalResumenModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowGlobalResumenModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Resumen Global de la Comunidad
                </h3>
              </div>
              <button
                onClick={() => setShowGlobalResumenModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-xs text-slate-500">
                Métricas acumuladas calculadas sobre los <strong>{globalResumen.totalPaquetes}</strong> paquetes guardados en el historial de la comunidad:
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block mb-1">Total Casos Acumulados</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {globalResumen.totalInteracciones}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-500 block mb-1">Sentimiento Predominante</span>
                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {globalResumen.sentimientoPredominante}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Temas Principales Más Recurrentes
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {globalResumen.temasPrincipales.length > 0 ? (
                    globalResumen.temasPrincipales.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100"
                      >
                        #{t}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No se identificaron temas acumulados</span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowGlobalResumenModal(false)}
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
