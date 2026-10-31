import { useEffect, useMemo, useState } from "react";
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
  Search,
  BarChart3,
  Sparkles,
  MessageSquare,
  Send,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { CATEGORY_LABELS } from "@/lib/review";
import { PageHeader } from "@/components/PageHeader";
import { BarList, ChartCard, RingChart, StackedColumns } from "@/components/DashboardCharts";
import { StatusCards } from "@/components/StatusCards";
import { ChannelTabs, DetailColumns, DetailPanel, EstadoPill, InteractionSummary, PanelTitle } from "@/components/DetailPanel";

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
  paqueteFechaIso?: string;
  paqueteRuta: string;
  origenComunidad: string;
  periodoReferencia: string;
}

type DateRangeOption = "todas" | "hoy" | "7dias" | "30dias" | "personalizado";
type SortColumn = "index" | "fecha" | "autor" | "relevancia" | "sentimiento";
type SortDirection = "asc" | "desc";

// Obtener fecha Date del caso en horario local
function getCaseLocalDate(c: FlatCase): Date | null {
  if (c.interaccion?.timestamp) {
    const d = new Date(c.interaccion.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (c.paqueteFechaIso) {
    const d = new Date(c.paqueteFechaIso);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// Formatear una fecha en string YYYY-MM-DD según la zona horaria local del navegador
function formatLocalYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

interface HistoryViewProps {
  view: "tabla" | "dashboard";
  onViewChange: (view: "tabla" | "dashboard") => void;
}

export function HistoryView({ view: activeView, onViewChange: setActiveView }: HistoryViewProps) {
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Modal de inspección
  const [inspectCase, setInspectCase] = useState<FlatCase | null>(null);
  const [inspectTab, setInspectTab] = useState<"detalle" | "json">("detalle");
  const [inspectActiveChannel, setInspectActiveChannel] = useState<string>("post_linkedin");
  const [copiedModalText, setCopiedModalText] = useState(false);
  const [copiedCaseJson, setCopiedCaseJson] = useState(false);

  // Filtros de la tabla e historial
  const [channelFilter, setChannelFilter] = useState<"todos" | "post_linkedin" | "destaque_newsletter_semanal" | "sugerencia_contenido_faq">("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "aprobado" | "rechazado">("todos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [sentimentFilter, setSentimentFilter] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Filtro temporal por rango de fechas
  const [dateRange, setDateRange] = useState<DateRangeOption>("todas");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Palabra seleccionada dentro de la nube de palabras (sin cambiar de vista)
  const [selectedCloudWord, setSelectedCloudWord] = useState<string | null>(null);

  // Ordenamiento interactivo de columnas
  const [sortColumn, setSortColumn] = useState<SortColumn>("index");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Paginación
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  useEffect(() => {
    fetchPackagesList();
  }, []);

  const fetchPackagesList = async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const res = await apiFetch("/api/storage/packages");
      const json = await res.json().catch(() => null);
      if (res.ok && Array.isArray(json?.packages)) {
        setPackages(json.packages);
      } else if (!res.ok) {
        setListError(typeof json?.detail === "string" ? json.detail : json?.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("Error al listar paquetes:", err);
      setListError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingList(false);
    }
  };

  // Recolectar todos los casos consolidados de todos los paquetes registrados
  const allCases: FlatCase[] = useMemo(() => {
    const list: FlatCase[] = [];
    packages.forEach((pkg) => {
      const casos = pkg.data?.casos || [];
      const rawFechaIso = pkg.data?.fecha_guardado || pkg.fecha_creacion || "";
      const fecha = formatFechaLegible(rawFechaIso);
      const origen = pkg.data?.origen_comunidad || "General";
      const periodo = pkg.data?.periodo_referencia || pkg.periodo_referencia;

      casos.forEach((c) => {
        list.push({
          ...c,
          paqueteNombre: pkg.nombre,
          paqueteFecha: fecha,
          paqueteFechaIso: rawFechaIso,
          paqueteRuta: pkg.ruta_objeto,
          origenComunidad: origen,
          periodoReferencia: periodo,
        });
      });
    });
    return list;
  }, [packages]);

  // Filtrado temporal por fechas en horario local
  const dateFilteredCases = useMemo(() => {
    if (dateRange === "todas") return allCases;

    const now = new Date();
    const todayStr = formatLocalYMD(now);

    return allCases.filter((c) => {
      const caseDate = getCaseLocalDate(c);
      if (!caseDate) return false;

      const caseDayStr = formatLocalYMD(caseDate);

      if (dateRange === "hoy") {
        return caseDayStr === todayStr;
      }
      if (dateRange === "7dias") {
        const diffMs = now.getTime() - caseDate.getTime();
        const diffDays = diffMs / (1000 * 3600 * 24);
        return diffDays >= -0.1 && diffDays <= 7;
      }
      if (dateRange === "30dias") {
        const diffMs = now.getTime() - caseDate.getTime();
        const diffDays = diffMs / (1000 * 3600 * 24);
        return diffDays >= -0.1 && diffDays <= 30;
      }
      if (dateRange === "personalizado") {
        const start = customStartDate.trim();
        const end = customEndDate.trim();

        if (start && end) {
          return caseDayStr >= start && caseDayStr <= end;
        }
        if (start && !end) {
          // Si solo se ingresó una fecha en 'Desde', filtrar exactamente ese día seleccionado
          return caseDayStr === start;
        }
        if (!start && end) {
          // Si solo se ingresó una fecha en 'Hasta', filtrar exactamente ese día seleccionado
          return caseDayStr === end;
        }
        return true;
      }
      return true;
    });
  }, [allCases, dateRange, customStartDate, customEndDate]);

  // Filtros de la tabla (Canal, Estado, Categoría, Sentimiento y Búsqueda)
  const filteredCases = useMemo(() => {
    return dateFilteredCases.filter((c) => {
      // 1. Filtro por canal de activo
      if (channelFilter !== "todos") {
        const hasChannel = (c.activos_candidatos || []).some(
          (cand) => cand.tipo_activo === channelFilter
        );
        if (!hasChannel) return false;
      }

      // 2. Filtro por estado
      if (statusFilter !== "todos") {
        const statuses = (c.activos_candidatos || []).map((cand) => cand.estado_aprobacion);
        if (statusFilter === "aprobado") {
          if (!statuses.includes("aprobado")) return false;
        } else if (statusFilter === "rechazado") {
          if (!statuses.includes("rechazado")) return false;
        }
      }

      // 3. Filtro por categoría
      if (categoryFilter !== "todas") {
        if (c.oportunidad?.categoria !== categoryFilter) return false;
      }

      // 4. Filtro por sentimiento
      if (sentimentFilter !== "todos") {
        const sent = (c.analisis?.sentimiento || "").toLowerCase();
        if (!sent.includes(sentimentFilter.toLowerCase())) return false;
      }

      // 5. Filtro de búsqueda textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const autorMatch = (c.interaccion.autor || "").toLowerCase().includes(q);
        const canalMatch = (c.interaccion.canal || "").toLowerCase().includes(q);
        const textoMatch = (c.interaccion.texto || "").toLowerCase().includes(q);
        const temasMatch = (c.analisis?.temas || []).some((t) => t.toLowerCase().includes(q));
        const entMatch = (c.analisis?.entidades || []).some((e) => e.toLowerCase().includes(q));
        if (!autorMatch && !canalMatch && !textoMatch && !temasMatch && !entMatch) return false;
      }

      return true;
    });
  }, [dateFilteredCases, channelFilter, statusFilter, categoryFilter, sentimentFilter, searchQuery]);

  // Ordenamiento interactivo de columnas
  const sortedCases = useMemo(() => {
    const list = [...filteredCases];
    if (sortColumn === "index") {
      if (sortDirection === "desc") list.reverse();
      return list;
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortColumn === "autor") {
        cmp = (a.interaccion.autor || "").localeCompare(b.interaccion.autor || "");
      } else if (sortColumn === "fecha") {
        const dateA = getCaseLocalDate(a)?.getTime() || 0;
        const dateB = getCaseLocalDate(b)?.getTime() || 0;
        cmp = dateA - dateB;
      } else if (sortColumn === "relevancia") {
        cmp = (a.oportunidad?.relevance_score ?? 0) - (b.oportunidad?.relevance_score ?? 0);
      } else if (sortColumn === "sentimiento") {
        cmp = (a.analisis?.sentimiento_score ?? 0) - (b.analisis?.sentimiento_score ?? 0);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return list;
  }, [filteredCases, sortColumn, sortDirection]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(sortedCases.length / pageSize));
  const pagedCases = useMemo(() => {
    if (pageSize >= 9999) return sortedCases;
    const start = (currentPage - 1) * pageSize;
    return sortedCases.slice(start, start + pageSize);
  }, [sortedCases, currentPage, pageSize]);

  // Reiniciar a página 1 cuando cambie cualquier filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [
    channelFilter,
    statusFilter,
    categoryFilter,
    sentimentFilter,
    searchQuery,
    dateRange,
    customStartDate,
    customEndDate,
    pageSize,
  ]);

  // Manejo de ordenamiento por clic en cabecera
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection(
        column === "relevancia" || column === "sentimiento" || column === "fecha" ? "desc" : "asc"
      );
    }
  };

  // Limpiar todos los filtros
  const hasActiveFilters =
    channelFilter !== "todos" ||
    statusFilter !== "todos" ||
    categoryFilter !== "todas" ||
    sentimentFilter !== "todos" ||
    dateRange !== "todas" ||
    searchQuery.trim() !== "";

  // Conteos dinámicos para los filtros de estado (Nivel 2)
  const statusCounts = useMemo(() => {
    let todos = 0;
    let aprobados = 0;
    let rechazados = 0;

    dateFilteredCases.forEach((c) => {
      if (channelFilter !== "todos") {
        const hasChannel = (c.activos_candidatos || []).some(
          (cand) => cand.tipo_activo === channelFilter
        );
        if (!hasChannel) return;
      }
      todos++;
      const statuses = (c.activos_candidatos || []).map((cand) => cand.estado_aprobacion);
      if (statuses.includes("aprobado")) aprobados++;
      if (statuses.includes("rechazado")) rechazados++;
    });

    return { todos, aprobados, rechazados };
  }, [dateFilteredCases, channelFilter]);

  const clearAllFilters = () => {
    setChannelFilter("todos");
    setStatusFilter("todos");
    setCategoryFilter("todas");
    setSentimentFilter("todos");
    setDateRange("todas");
    setCustomStartDate("");
    setCustomEndDate("");
    setSearchQuery("");
  };

  // Extracción de datos para Word Cloud (Nube de Palabras)
  const wordCloudData = useMemo(() => {
    const counts: Record<string, number> = {};

    dateFilteredCases.forEach((c) => {
      const temas = c.analisis?.temas || [];
      const entidades = c.analisis?.entidades || [];
      [...temas, ...entidades].forEach((term) => {
        if (!term || typeof term !== "string") return;
        const clean = term.replace(/^#/, "").trim();
        if (clean.length < 2) return;
        const formatted = clean.charAt(0).toUpperCase() + clean.slice(1);
        counts[formatted] = (counts[formatted] || 0) + 1;
      });
    });

    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);

    const maxWeight = sorted[0]?.[1] || 1;
    return { list: sorted, maxWeight };
  }, [dateFilteredCases]);

  // Métricas y estadísticas para el Dashboard
  const dashboardStats = useMemo(() => {
    const totalCasos = dateFilteredCases.length;
    let totalCandidatos = 0;
    let totalAprobados = 0;
    let totalRechazados = 0;

    let sumSentiment = 0;
    let sentimentCount = 0;
    const sentimientoCounts = { positivo: 0, neutral: 0, negativo: 0 };

    let sumRelevance = 0;
    const relevanceBuckets = { alta: 0, media: 0, baja: 0 };

    const channelStats = {
      post_linkedin: { total: 0, aprobados: 0, rechazados: 0 },
      destaque_newsletter_semanal: { total: 0, aprobados: 0, rechazados: 0 },
      sugerencia_contenido_faq: { total: 0, aprobados: 0, rechazados: 0 },
    };

    dateFilteredCases.forEach((c) => {
      const rel = c.oportunidad?.relevance_score ?? 0;
      sumRelevance += rel;
      if (rel >= 70) relevanceBuckets.alta++;
      else if (rel >= 40) relevanceBuckets.media++;
      else relevanceBuckets.baja++;

      if (c.analisis) {
        const sent = (c.analisis.sentimiento || "").toLowerCase();
        if (sent.includes("pos")) sentimientoCounts.positivo++;
        else if (sent.includes("neg")) sentimientoCounts.negativo++;
        else sentimientoCounts.neutral++;

        if (typeof c.analisis.sentimiento_score === "number") {
          sumSentiment += c.analisis.sentimiento_score;
          sentimentCount++;
        }
      }

      (c.activos_candidatos || []).forEach((cand) => {
        totalCandidatos++;
        if (cand.estado_aprobacion === "aprobado") totalAprobados++;
        else if (cand.estado_aprobacion === "rechazado") totalRechazados++;

        const ch = cand.tipo_activo as keyof typeof channelStats;
        if (channelStats[ch]) {
          channelStats[ch].total++;
          if (cand.estado_aprobacion === "aprobado") channelStats[ch].aprobados++;
          else if (cand.estado_aprobacion === "rechazado") channelStats[ch].rechazados++;
        }
      });
    });

    const avgSentiment =
      sentimentCount > 0 ? (sumSentiment / sentimentCount).toFixed(2) : "0.00";
    const avgRelevance =
      totalCasos > 0 ? (sumRelevance / totalCasos).toFixed(0) : "0";

    const tasaAprobacion =
      totalCandidatos > 0
        ? Math.round((totalAprobados / totalCandidatos) * 100)
        : 0;

    let sentimientoPredominante = "neutral";
    if (
      sentimientoCounts.positivo >= sentimientoCounts.neutral &&
      sentimientoCounts.positivo >= sentimientoCounts.negativo
    ) {
      sentimientoPredominante = "positivo";
    } else if (
      sentimientoCounts.negativo >= sentimientoCounts.neutral &&
      sentimientoCounts.negativo >= sentimientoCounts.positivo
    ) {
      sentimientoPredominante = "negativo";
    }

    return {
      totalCasos,
      totalCandidatos,
      totalAprobados,
      totalRechazados,
      tasaAprobacion,
      avgSentiment,
      avgRelevance,
      sentimientoPredominante,
      sentimientoCounts,
      relevanceBuckets,
      channelStats,
    };
  }, [dateFilteredCases]);

  // Descarga del paquete consolidado
  const downloadCurrentJSON = () => {
    const exportData = {
      meta: "Consolidado de paquetes JSON",
      total_paquetes: packages.length,
      total_casos: allCases.length,
      fecha_exportacion: new Date().toISOString(),
      paquetes: packages,
    };
    const filename = `communityia-consolidado-${new Date().toISOString().slice(0, 10)}.json`;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openCaseModal = (caso: FlatCase) => {
    setInspectCase(caso);
    setInspectTab("detalle");
    const firstType = caso.activos_candidatos?.[0]?.tipo_activo || "post_linkedin";
    setInspectActiveChannel(firstType);
  };

  const copyModalContent = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedModalText(true);
      setTimeout(() => setCopiedModalText(false), 2000);
    }
  };

  const copyCaseJsonContent = async () => {
    if (!inspectCase) return;
    const ok = await copyToClipboard(JSON.stringify(inspectCase, null, 2));
    if (ok) {
      setCopiedCaseJson(true);
      setTimeout(() => setCopiedCaseJson(false), 2000);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-ink-50 overflow-hidden h-full">
      {/* 1. ENCABEZADO: la vista (tabla o dashboard) se elige en la navegación lateral */}
      <PageHeader
        icon={activeView === "tabla" ? <TableIcon className="w-[27px] h-[27px]" /> : <BarChart3 className="w-[27px] h-[27px]" />}
        title={activeView === "tabla" ? "Tabla de casos" : "Dashboard de comunidad"}
        subtitle={
          activeView === "tabla"
            ? `Historial de paquetes JSON consolidados · ${sortedCases.length} casos`
            : "Métricas de los paquetes JSON consolidados"
        }
        actions={
          <>
            <button
              onClick={fetchPackagesList}
              disabled={isLoadingList}
              className="btn-ghost"
              title="Actualizar datos consolidados"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingList ? "animate-spin" : ""}`} />
              Actualizar
            </button>
            <button onClick={downloadCurrentJSON} className="btn-primary" title="Descargar paquete(s) en formato JSON">
              <Download className="w-4 h-4" />
              Descargar JSON
            </button>
          </>
        }
      />

      {/* 2. VISTA: TABLA DE CASOS */}
      {activeView === "tabla" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Nivel 1: estados (tarjetas resumen seleccionables) */}
          <div className="bg-surface px-4 sm:px-5 pb-4">
            <StatusCards
              active={statusFilter}
              onSelect={setStatusFilter}
              cards={[
                {
                  key: "todos",
                  count: statusCounts.todos,
                  metric: `de ${dateFilteredCases.length} casos en el período`,
                },
                {
                  key: "aprobado",
                  count: statusCounts.aprobados,
                  metric: `${statusCounts.todos > 0 ? Math.round((statusCounts.aprobados / statusCounts.todos) * 100) : 0}% de los casos con algún activo aprobado`,
                },
                {
                  key: "rechazado",
                  count: statusCounts.rechazados,
                  metric: `${statusCounts.todos > 0 ? Math.round((statusCounts.rechazados / statusCounts.todos) * 100) : 0}% de los casos con algún activo rechazado`,
                },
              ]}
            />
          </div>

          {/* Nivel 2: filtro por contenido (canal) */}
          <div className="bg-surface border-b border-ink-200 px-4 sm:px-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <nav className="flex gap-1 overflow-x-auto -mb-px max-w-full" role="tablist" aria-label="Filtrar por canal">
              {[
                { key: "todos", label: "Todos los Canales" },
                { key: "post_linkedin", label: "LinkedIn" },
                { key: "destaque_newsletter_semanal", label: "Newsletter" },
                { key: "sugerencia_contenido_faq", label: "FAQ" },
              ].map((ch) => {
                const selected = channelFilter === ch.key;
                return (
                  <button
                    key={ch.key}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setChannelFilter(ch.key as any)}
                    className={`px-3.5 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                      selected
                        ? "border-brand-600 text-brand-700"
                        : "border-transparent text-ink-500 hover:text-ink-900"
                    }`}
                  >
                    {ch.label}
                  </button>
                );
              })}
            </nav>
            <p className="text-xs text-ink-500 pb-2.5">
              Mostrando <strong className="text-ink-800">{filteredCases.length}</strong> de{" "}
              <strong className="text-ink-800">{dateFilteredCases.length}</strong> casos registrados
            </p>
          </div>

          {/* Nivel 3: Filtros por Período, Categoría, Sentimiento y Búsqueda */}
          <div className="bg-ink-50/70 border-b border-ink-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3 flex-wrap">
              {/* 1. Selector de Rango de Fechas */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="date-range-select" className="text-xs font-semibold text-ink-600 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-brand-600" />
                  Período:
                </label>
                <select
                  id="date-range-select"
                  value={dateRange}
                  onChange={(e) => {
                    const val = e.target.value as DateRangeOption;
                    setDateRange(val);
                    if (val === "personalizado" && !customStartDate && !customEndDate) {
                      const today = formatLocalYMD(new Date());
                      setCustomStartDate(today);
                      setCustomEndDate(today);
                    }
                  }}
                  className="text-xs border border-ink-300 rounded-lg px-2.5 py-1 bg-surface text-ink-800 font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="todas">Todas las fechas (Total)</option>
                  <option value="hoy">Hoy</option>
                  <option value="7dias">Últimos 7 días</option>
                  <option value="30dias">Últimos 30 días</option>
                  <option value="personalizado">Personalizado...</option>
                </select>

                {dateRange === "personalizado" && (
                  <div className="flex items-center gap-1.5 text-xs ml-1 bg-ink-100 px-2 py-0.5 rounded-lg border border-ink-200">
                    <span className="text-[11px] font-semibold text-ink-600">Desde:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="border border-ink-300 rounded px-1.5 py-0.5 text-xs text-ink-800 bg-surface font-medium focus:ring-1 focus:ring-brand-500"
                      title="Fecha desde"
                    />
                    <span className="text-[11px] font-semibold text-ink-600 ml-1">Hasta:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="border border-ink-300 rounded px-1.5 py-0.5 text-xs text-ink-800 bg-surface font-medium focus:ring-1 focus:ring-brand-500"
                      title="Fecha hasta"
                    />
                  </div>
                )}
              </div>

              <div className="h-5 w-px bg-ink-200" />

              {/* 2. Filtro por Categoría */}
              <div className="flex items-center gap-1">
                <label htmlFor="cat-filter" className="text-xs font-medium text-ink-500">
                  Categoría:
                </label>
                <select
                  id="cat-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs border border-ink-200 rounded-lg px-2 py-1 bg-surface text-ink-700 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer max-w-[130px] truncate"
                >
                  <option value="todas">Todas</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Filtro por Sentimiento */}
              <div className="flex items-center gap-1">
                <label htmlFor="sent-filter" className="text-xs font-medium text-ink-500">
                  Sentimiento:
                </label>
                <select
                  id="sent-filter"
                  value={sentimentFilter}
                  onChange={(e) => setSentimentFilter(e.target.value)}
                  className="text-xs border border-ink-200 rounded-lg px-2 py-1 bg-surface text-ink-700 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="todos">Todos</option>
                  <option value="positivo">Positivo</option>
                  <option value="neutral">Neutral</option>
                  <option value="negativo">Negativo</option>
                </select>
              </div>

              {/* Botón para limpiar filtros */}
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-danger-600 hover:text-danger-800 font-semibold flex items-center gap-1 px-2 py-1 rounded bg-danger-50 hover:bg-danger-100 transition cursor-pointer"
                  title="Restablecer todos los filtros"
                >
                  <X className="w-3 h-3" />
                  Limpiar
                </button>
              )}
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-ink-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar autor, canal, #tema…"
                className="text-xs pl-8 pr-7 py-1.5 w-60 rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-surface"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* TABLA DE CONTENIDO */}
          <div className="flex-1 overflow-auto p-6 bg-ink-50">
            {listError && packages.length === 0 ? (
              <div role="alert" className="bg-surface rounded-xl border border-danger-200 p-12 text-center max-w-md mx-auto my-8 shadow-xs">
                <Cloud className="w-10 h-10 text-danger-400 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-ink-800 mb-1">No se pudo cargar el historial</h3>
                <p className="text-xs text-ink-500 mb-4">
                  El almacenamiento no respondió ({listError}). Comprueba que el backend esté en marcha y vuelve a intentarlo.
                </p>
                <button
                  onClick={fetchPackagesList}
                  disabled={isLoadingList}
                  className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 font-semibold hover:bg-brand-100 transition cursor-pointer disabled:opacity-40"
                >
                  {isLoadingList ? "Reintentando…" : "Reintentar"}
                </button>
              </div>
            ) : sortedCases.length === 0 ? (
              <div className="bg-surface rounded-xl border border-ink-200 p-12 text-center max-w-md mx-auto my-8 shadow-xs">
                <Cloud className="w-10 h-10 text-ink-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-ink-800 mb-1">No se encontraron casos</h3>
                <p className="text-xs text-ink-500 mb-4">
                  Prueba cambiando el período de fechas o ajustando los filtros de canal, estado o categoría.
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearAllFilters}
                    className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 font-semibold hover:bg-brand-100 transition cursor-pointer"
                  >
                    Restablecer filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-surface border border-ink-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
                <div className="overflow-x-auto">
                  <table className="data-table w-full text-left text-xs text-ink-700">
                    <thead className="select-none">
                      <tr>
                        {/* Columna 1: # Índice Correlativo */}
                        <th
                          onClick={() => handleSort("index")}
                          className="py-3 px-3 text-center cursor-pointer hover:bg-ink-100 transition w-14"
                          title="Ordenar por número de fila"
                        >
                          <div className="inline-flex items-center gap-1">
                            <span>#</span>
                            {sortColumn === "index" ? (
                              sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-ink-500 opacity-50" />
                            )}
                          </div>
                        </th>

                        {/* Columna 2: Fecha */}
                        <th
                          onClick={() => handleSort("fecha")}
                          className="py-3 px-4 cursor-pointer hover:bg-ink-100 transition"
                          title="Ordenar cronológicamente"
                        >
                          <div className="flex items-center gap-1">
                            <span>Fecha</span>
                            {sortColumn === "fecha" ? (
                              sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-ink-500 opacity-50" />
                            )}
                          </div>
                        </th>

                        {/* Columna 3: Autor */}
                        <th
                          onClick={() => handleSort("autor")}
                          className="py-3 px-3 cursor-pointer hover:bg-ink-100 transition"
                          title="Ordenar alfabéticamente por autor"
                        >
                          <div className="flex items-center gap-1">
                            <span>Autor</span>
                            {sortColumn === "autor" ? (
                              sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-ink-500 opacity-50" />
                            )}
                          </div>
                        </th>

                        {/* Columna 4: Canal de Origen */}
                        <th >Canal</th>

                        {/* Columna 5: Categoría */}
                        <th >Categoría</th>

                        {/* Columna 6: Sentimiento */}
                        <th
                          onClick={() => handleSort("sentimiento")}
                          className="py-3 px-3 cursor-pointer hover:bg-ink-100 transition"
                          title="Ordenar por polaridad de sentimiento"
                        >
                          <div className="flex items-center gap-1">
                            <span>Sentimiento</span>
                            {sortColumn === "sentimiento" ? (
                              sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-ink-500 opacity-50" />
                            )}
                          </div>
                        </th>

                        {/* Columna 7: Relevancia */}
                        <th
                          onClick={() => handleSort("relevancia")}
                          className="py-3 px-3 text-center cursor-pointer hover:bg-ink-100 transition"
                          title="Ordenar por score de relevancia editorial"
                        >
                          <div className="inline-flex items-center gap-1">
                            <span>Relevancia</span>
                            {sortColumn === "relevancia" ? (
                              sortDirection === "asc" ? <ArrowUp className="w-3 h-3 text-brand-600" /> : <ArrowDown className="w-3 h-3 text-brand-600" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-ink-500 opacity-50" />
                            )}
                          </div>
                        </th>

                        {/* Columna 8: Activos Generados */}
                        <th >Activos</th>

                        {/* Columna 9: Detalle */}
                        <th className="text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {pagedCases.map((caso, idx) => {
                        const globalIndex = (currentPage - 1) * pageSize + idx + 1;
                        const score = caso.oportunidad?.relevance_score ?? 0;
                        const sent = caso.analisis?.sentimiento || "neutral";
                        const candidatos = caso.activos_candidatos || [];

                        return (
                          <tr
                            key={`${caso.interaccion.id}-${idx}`}
                            onClick={() => openCaseModal(caso)}
                            data-selected={inspectCase === caso}
                            className="cursor-pointer"
                          >
                            {/* # Índice Correlativo */}
                            <td className="text-center whitespace-nowrap">
                              <span className="font-mono text-[11px] font-bold text-ink-500 bg-ink-100 px-2 py-0.5 rounded-md">
                                #{globalIndex}
                              </span>
                            </td>

                            {/* Fecha */}
                            <td className="whitespace-nowrap">
                              <div className="font-medium text-ink-800">
                                {caso.interaccion.timestamp
                                  ? formatFechaLegible(caso.interaccion.timestamp)
                                  : caso.paqueteFecha || "--"}
                              </div>
                            </td>

                            {/* Autor */}
                            <td className="font-semibold text-ink-900 whitespace-nowrap">
                              {caso.interaccion.autor}
                            </td>

                            {/* Canal */}
                            <td className="whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-ink-100 font-mono text-[11px] text-ink-700">
                                {caso.interaccion.canal}
                              </span>
                            </td>

                            {/* Categoría */}
                            <td className="whitespace-nowrap font-medium text-ink-700">
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-ink-100 text-ink-700 border border-ink-200">
                                {CATEGORY_LABELS[caso.oportunidad?.categoria as keyof typeof CATEGORY_LABELS] ||
                                  caso.oportunidad?.categoria ||
                                  "--"}
                              </span>
                            </td>

                            {/* Sentimiento */}
                            <td className="whitespace-nowrap">
                              <span
                                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                                  sent.includes("pos")
                                    ? "bg-success-100 text-success-800"
                                    : sent.includes("neg")
                                    ? "bg-danger-100 text-danger-800"
                                    : "bg-ink-100 text-ink-700"
                                }`}
                              >
                                {sent}
                              </span>
                            </td>

                            {/* Relevancia */}
                            <td className="text-center whitespace-nowrap">
                              <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                  score >= 70
                                    ? "bg-brand-100 text-brand-800"
                                    : score >= 40
                                    ? "bg-warning-100 text-warning-800"
                                    : "bg-ink-100 text-ink-600"
                                }`}
                              >
                                {score.toFixed(0)}
                              </span>
                            </td>

                            {/* Activos */}
                            <td>
                              <div className="flex flex-wrap gap-1">
                                {candidatos.length > 0 ? (
                                  candidatos.map((c) => (
                                    <span
                                      key={c.candidato_id}
                                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                                        c.estado_aprobacion === "aprobado"
                                          ? "bg-success-50 text-success-700 border-success-200"
                                          : c.estado_aprobacion === "rechazado"
                                          ? "bg-danger-50 text-danger-700 border-danger-200"
                                          : "bg-warning-50 text-warning-700 border-warning-200"
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
                                  <span className="text-ink-500 text-[11px] italic">Sin activos</span>
                                )}
                              </div>
                            </td>

                            {/* Acción */}
                            <td className="text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => openCaseModal(caso)}
                                className="table-action text-xs font-medium px-2.5!"
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

                {/* 3. PAGINADOR EN EL PIE DE LA TABLA */}
                <div className="bg-surface border-t border-ink-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-600 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span>
                      Mostrando{" "}
                      <strong className="text-ink-900">
                        {sortedCases.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                      </strong>{" "}
                      a{" "}
                      <strong className="text-ink-900">
                        {Math.min(currentPage * pageSize, sortedCases.length)}
                      </strong>{" "}
                      de <strong className="text-ink-900">{sortedCases.length}</strong> casos
                    </span>
                    {sortedCases.length !== allCases.length && (
                      <span className="text-[11px] text-ink-500">
                        (filtrados de {allCases.length} totales)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Primera página"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Página anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <span className="px-3 py-1 font-semibold text-ink-800 bg-ink-50 border border-ink-200 rounded-lg">
                      Página {currentPage} de {totalPages}
                    </span>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Página siguiente"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      title="Última página"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="h-4 w-px bg-ink-200 mx-1" />

                    <div className="flex items-center gap-1">
                      <span className="text-ink-500">Filas:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="border border-ink-200 rounded-lg px-2 py-1 bg-surface text-ink-700 font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={9999}>Todos</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. VISTA: DASHBOARD DE COMUNIDAD — gráficos basados en Smart Charts Kit */}
      {activeView === "dashboard" && (
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 pb-8 pt-2 space-y-5 bg-surface">
          {/* Selector de alcance temporal dentro del dashboard */}
          <div className="chart-card px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                <label htmlFor="dash-date-select" className="text-xs font-bold text-ink-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-600" />
                  Período analizado:
                </label>
                <select
                  id="dash-date-select"
                  value={dateRange}
                  onChange={(e) => {
                    const val = e.target.value as DateRangeOption;
                    setDateRange(val);
                    if (val === "personalizado" && !customStartDate && !customEndDate) {
                      const today = formatLocalYMD(new Date());
                      setCustomStartDate(today);
                      setCustomEndDate(today);
                    }
                  }}
                  className="w-full sm:w-auto max-w-full text-sm border border-hairline rounded-full px-3.5 py-2 bg-surface text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="todas">Todas las fechas (Consolidado completo)</option>
                  <option value="hoy">Hoy</option>
                  <option value="7dias">Últimos 7 días</option>
                  <option value="30dias">Últimos 30 días</option>
                  <option value="personalizado">Personalizado...</option>
                </select>

                {dateRange === "personalizado" && (
                  <div className="flex items-center gap-1.5 text-xs ml-1 bg-ink-100 px-2 py-0.5 rounded-lg border border-ink-200">
                    <span className="text-[11px] font-semibold text-ink-600">Desde:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="border border-ink-300 rounded px-1.5 py-0.5 text-xs text-ink-800 bg-surface font-medium focus:ring-1 focus:ring-brand-500"
                      title="Fecha desde"
                    />
                    <span className="text-[11px] font-semibold text-ink-600 ml-1">Hasta:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="border border-ink-300 rounded px-1.5 py-0.5 text-xs text-ink-800 bg-surface font-medium focus:ring-1 focus:ring-brand-500"
                      title="Fecha hasta"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-ink-500">
              Métricas calculadas sobre <strong>{dashboardStats.totalCasos}</strong> casos de la comunidad.
            </div>
          </div>

          {/* Métricas principales: total de interacciones (destacado) y estado de los activos */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <section
              className="lg:col-span-4 rounded-2xl p-6 text-white flex flex-col justify-between gap-6 shadow-(--shadow-card)"
              style={{ backgroundImage: "var(--gradient-secondary)" }}
            >
              <div>
                <h2 className="text-sm text-white/80 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Total de interacciones
                </h2>
                <p className="text-6xl font-semibold leading-none mt-3 tabular-nums">{dashboardStats.totalCasos}</p>
                <p className="text-sm text-white/80 mt-2">{packages.length} paquete(s) registrados</p>
              </div>
              <dl className="grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
                <div>
                  <dt className="text-xs text-white/80 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Sentimiento predominante
                  </dt>
                  <dd className="text-lg font-semibold capitalize mt-1">{dashboardStats.sentimientoPredominante}</dd>
                  <dd className="text-xs text-white/80">Score medio: {dashboardStats.avgSentiment}</dd>
                </div>
                <div>
                  <dt className="text-xs text-white/80 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Relevancia media
                  </dt>
                  <dd className="text-lg font-semibold mt-1 tabular-nums">
                    {dashboardStats.avgRelevance}
                    <span className="text-sm font-normal text-white/80"> / 100</span>
                  </dd>
                  <dd className="text-xs text-white/80">Potencial editorial</dd>
                </div>
              </dl>
            </section>

            <ChartCard
              className="lg:col-span-4"
              title="Estado de los activos"
              subtitle="Revisión de los contenidos generados"
              badge={`${dashboardStats.totalCandidatos} activos`}
            >
              <RingChart
                center={`${dashboardStats.tasaAprobacion}%`}
                caption="aprobados"
                segments={[
                  { label: "Aprobados", value: dashboardStats.totalAprobados, color: "green" },
                  { label: "Rechazados", value: dashboardStats.totalRechazados, color: "red" },
                ]}
              />
            </ChartCard>

            <ChartCard className="lg:col-span-4" title="Activos por canal" subtitle="Estado por formato editorial">
              <StackedColumns
                columns={(
                  [
                    ["LinkedIn", dashboardStats.channelStats.post_linkedin],
                    ["Newsletter", dashboardStats.channelStats.destaque_newsletter_semanal],
                    ["FAQ", dashboardStats.channelStats.sugerencia_contenido_faq],
                  ] as const
                ).map(([label, st]) => ({
                  label,
                  segments: [
                    { label: "Aprobados", value: st.aprobados, color: "green" as const },
                    { label: "Rechazados", value: st.rechazados, color: "red" as const },
                  ],
                }))}
                legend={[
                  { label: "Aprobados", color: "green" },
                  { label: "Rechazados", color: "red" },
                ]}
              />
            </ChartCard>
          </div>

          {/* Distribuciones */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ChartCard
              title="Distribución de sentimiento"
              subtitle="Tono emocional de las consultas de la comunidad"
              badge={`${dashboardStats.totalCasos} casos`}
            >
              <BarList
                total={dashboardStats.totalCasos}
                items={[
                  { label: "Positivo", value: dashboardStats.sentimientoCounts.positivo, color: "green" },
                  { label: "Neutral", value: dashboardStats.sentimientoCounts.neutral, color: "yellow" },
                  { label: "Negativo", value: dashboardStats.sentimientoCounts.negativo, color: "red" },
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Niveles de relevancia"
              subtitle="Valor editorial de las interacciones"
              badge={`Score medio: ${dashboardStats.avgRelevance}/100`}
            >
              <BarList
                total={dashboardStats.totalCasos}
                items={[
                  {
                    label: "Alta (70 - 100)",
                    hint: "Casos con alto valor para publicación",
                    value: dashboardStats.relevanceBuckets.alta,
                    color: "violet",
                  },
                  {
                    label: "Media (40 - 69)",
                    hint: "Casos para boletines o resúmenes",
                    value: dashboardStats.relevanceBuckets.media,
                    color: "blue",
                  },
                  {
                    label: "Baja (0 - 39)",
                    hint: "Soporte rápido o interacciones menores",
                    value: dashboardStats.relevanceBuckets.baja,
                    color: "orange",
                  },
                ]}
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Temas y conceptos de la comunidad"
            subtitle="Términos con mayor frecuencia en las consultas"
            badge={`${wordCloudData.list.length} temas`}
          >
              {wordCloudData.list.length === 0 ? (
              <p className="text-xs text-ink-500 italic py-6 text-center">
                No hay temas registrados en el período actual.
              </p>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="flex flex-wrap items-center justify-center gap-2 p-3 bg-ink-50/70 rounded-xl border border-ink-100 min-h-[160px]">
                  {wordCloudData.list.map(([term, freq]) => {
                    const ratio = wordCloudData.maxWeight > 1 ? freq / wordCloudData.maxWeight : 1;
                    const isSelected = selectedCloudWord === term;
                    let badgeStyle = "text-xs font-medium text-ink-700 bg-surface border-ink-200 hover:border-ink-300";
                    if (ratio >= 0.75) {
                      badgeStyle = "text-sm sm:text-base font-bold text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100 shadow-2xs";
                    } else if (ratio >= 0.45) {
                      badgeStyle = "text-xs sm:text-sm font-semibold text-brand-700 bg-brand-50 border-brand-200 hover:bg-brand-100";
                    } else if (ratio >= 0.25) {
                      badgeStyle = "text-xs font-medium text-info-700 bg-info-50 border-info-200 hover:bg-info-100";
                    }

                    return (
                      <button
                        key={term}
                        onClick={() => setSelectedCloudWord(isSelected ? null : term)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? "ring-2 ring-brand-500 bg-brand-600 text-white border-brand-600 shadow-sm scale-105"
                            : badgeStyle
                        }`}
                        title={`#${term}: ${freq} mención(es)`}
                      >
                        <span>#{term}</span>
                        <span className={`text-[10px] font-mono ${isSelected ? "text-white/80" : "opacity-60"}`}>
                          ({freq})
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Detalle interactivo del tema seleccionado sin salir del dashboard */}
                {selectedCloudWord && (
                  <div className="p-2.5 rounded-lg bg-brand-50/80 border border-brand-100 flex items-center justify-between text-xs text-brand-900 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      <span>
                        <strong>#{selectedCloudWord}</strong> tiene{" "}
                        <strong>
                          {wordCloudData.list.find(([t]) => t === selectedCloudWord)?.[1] || 1}
                        </strong>{" "}
                        menciones en este período.
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSearchQuery(selectedCloudWord);
                          setActiveView("tabla");
                        }}
                        className="text-[11px] font-bold text-brand-700 hover:text-brand-900 underline cursor-pointer"
                      >
                        Ver en tabla →
                      </button>
                      <button
                        onClick={() => setSelectedCloudWord(null)}
                        className="text-ink-500 hover:text-ink-600 p-0.5 cursor-pointer"
                        title="Cerrar detalle"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ChartCard>
        </div>
      )}

      {/* 4. PANEL DE DETALLE (mismo componente que la bandeja de revisión) */}
      {inspectCase && (
        <DetailPanel
          icon={<Eye className="w-5 h-5" />}
          autor={inspectCase.interaccion.autor}
          canal={inspectCase.interaccion.canal}
          subtitle={inspectCase.paqueteFecha ? `Fecha de registro: ${inspectCase.paqueteFecha}` : "Interacción de la comunidad"}
          onRequestClose={() => setInspectCase(null)}
          headerActions={
            <div className="flex items-center gap-1 bg-ink-200/70 p-1 rounded-lg" role="tablist">
              {(
                [
                  ["detalle", "Detalle", null],
                  ["json", "Ver JSON", <FileCode key="i" className="w-3.5 h-3.5" />],
                ] as const
              ).map(([key, label, icon]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={inspectTab === key}
                  onClick={() => setInspectTab(key)}
                  className={`text-xs px-3 py-1 rounded-md font-semibold transition cursor-pointer flex items-center gap-1 ${
                    inspectTab === key ? "bg-surface text-brand-700 shadow-2xs" : "text-ink-600 hover:text-ink-900"
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          }
          footer={
            <>
              <span className="text-xs text-ink-500">Registro consolidado · Modo solo lectura</span>
              <button onClick={() => setInspectCase(null)} className="btn-ghost ml-auto">
                Cerrar
              </button>
            </>
          }
        >
          {inspectTab === "detalle" ? (
            <DetailColumns
              left={
                <InteractionSummary
                  texto={inspectCase.interaccion.texto}
                  tipoNote={`Tipo declarado: ${inspectCase.interaccion.tipo || "consulta"}`}
                  fecha={inspectCase.paqueteFecha}
                  alerts={inspectCase.degradado ? ["Análisis degradado: la IA no respondió y se usó un resultado neutral."] : []}
                  analisis={inspectCase.analisis}
                  categoria={
                    CATEGORY_LABELS[inspectCase.oportunidad?.categoria as keyof typeof CATEGORY_LABELS] ||
                    inspectCase.oportunidad?.categoria ||
                    "Sin categoría"
                  }
                  relevancia={`${inspectCase.oportunidad?.relevance_score ?? 0} / 100`}
                  motivo={inspectCase.enrutamiento?.motivo}
                />
              }
              right={
                <div className="space-y-3">
                  <PanelTitle>Contenido generado</PanelTitle>
                  <ChannelTabs
                    tabs={(inspectCase.activos_candidatos || []).map((cand) => ({
                      id: cand.tipo_activo,
                      label:
                        cand.tipo_activo === "post_linkedin"
                          ? "LinkedIn"
                          : cand.tipo_activo === "destaque_newsletter_semanal"
                          ? "Newsletter"
                          : "FAQ",
                      estado: cand.estado_aprobacion,
                    }))}
                    activeId={inspectActiveChannel}
                    onSelect={setInspectActiveChannel}
                  />

            {/* Contenido del canal activo */}
            {(() => {
              const currentCand =
                (inspectCase.activos_candidatos || []).find(
                  (c) => c.tipo_activo === inspectActiveChannel
                ) || (inspectCase.activos_candidatos || [])[0];

              if (!currentCand) {
                return (
                  <div className="p-8 text-center text-ink-500 text-xs italic">
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
                    <span className="text-xs text-ink-500 font-medium">Estado del activo:</span>
                    <EstadoPill estado={estado} />
                  </div>

                  {/* Formatos específicos */}
                  {tipo === "post_linkedin" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-ink-500 border-b border-ink-100 pb-2">
                        <span>Canal: <strong>{content.canal_recomendado || "LinkedIn Oficial"}</strong></span>
                        {content.potencial_engagement && (
                          <span>Engagement: <strong className="text-brand-600">{content.potencial_engagement}</strong></span>
                        )}
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Título
                        </label>
                        <div className="text-xs font-bold text-ink-900 bg-ink-50 p-2.5 rounded-lg border border-ink-200">
                          {content.titulo}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Copy
                        </label>
                        <div className="p-3.5 bg-ink-50 border border-ink-200 rounded-lg text-xs text-ink-800 leading-relaxed whitespace-pre-wrap font-sans">
                          {content.copy}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          onClick={() => copyModalContent(`${content.titulo ? content.titulo + "\n\n" : ""}${content.copy || ""}`)}
                          className="btn-primary"
                        >
                          {copiedModalText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copiedModalText ? "¡Copiado!" : "Copiar contenido"}
                        </button>
                        <button
                          onClick={async () => {
                            const text = `${content.titulo ? content.titulo + "\n\n" : ""}${content.copy || ""}`;
                            await copyToClipboard(text);
                            window.open(
                              `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`,
                              "_blank",
                              "noopener,noreferrer"
                            );
                          }}
                          className="btn-soft"
                        >
                          <Send className="w-4 h-4" />
                          Publicar en LinkedIn
                        </button>
                      </div>
                    </div>
                  )}

                  {tipo === "destaque_newsletter_semanal" && (
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-bold text-brand-800 bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded-full">
                          Sección: {content.seccion || "Historia de la Semana"}
                        </span>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Titular
                        </label>
                        <div className="text-xs font-bold text-ink-900 bg-ink-50 p-2.5 rounded-lg border border-ink-200">
                          {content.titular}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Resumen
                        </label>
                        <div className="p-3.5 bg-ink-50 border border-ink-200 rounded-lg text-xs text-ink-800 leading-relaxed whitespace-pre-wrap font-sans">
                          {content.resumen}
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => copyModalContent(`${content.titular}\n\n${content.resumen}`)}
                          className="btn-primary"
                        >
                          {copiedModalText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copiedModalText ? "¡Copiado!" : "Copiar contenido"}
                        </button>
                      </div>
                    </div>
                  )}

                  {tipo === "sugerencia_contenido_faq" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Tema / Pregunta
                        </label>
                        <div className="text-xs font-bold text-ink-900 bg-ink-50 p-2.5 rounded-lg border border-ink-200">
                          {content.tema}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-ink-500 block mb-1">
                          Origen / Contexto
                        </label>
                        <div className="p-3.5 bg-ink-50 border border-ink-200 rounded-lg text-xs text-ink-800 leading-relaxed whitespace-pre-wrap font-sans">
                          {content.origen}
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => copyModalContent(`${content.tema}\n\n${content.origen}`)}
                          className="btn-primary"
                        >
                          {copiedModalText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copiedModalText ? "¡Copiado!" : "Copiar contenido"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
                </div>
              }
            />
          ) : (
              /* VISTA: JSON DEL CASO */
              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between text-xs text-ink-500">
                  <span>Estructura JSON completa del caso persistido:</span>
                  <button
                    onClick={copyCaseJsonContent}
                    className="inline-flex items-center gap-1 text-[11px] text-brand-600 hover:text-brand-800 font-semibold cursor-pointer"
                  >
                    {copiedCaseJson ? <Check className="w-3.5 h-3.5 text-success-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCaseJson ? "¡Copiado!" : "Copiar JSON"}
                  </button>
                </div>
                <pre className="p-4 bg-chrome text-chrome-text rounded-xl text-xs font-mono overflow-x-auto max-h-[480px] leading-relaxed">
                  {JSON.stringify(inspectCase, null, 2)}
                </pre>
              </div>
          )}
        </DetailPanel>
      )}
    </div>
  );
}
