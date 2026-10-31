import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { AlertTriangle, Upload, Loader2, Search, Inbox, FileJson, LayoutList, RefreshCw } from "lucide-react";
import { Sidebar, viewsFor, type AppView } from "@/components/Sidebar";
import { PageHeader } from "@/components/PageHeader";
import { StatusCards, type ReviewFilter } from "@/components/StatusCards";
import { AlertDialog } from "@/components/AlertDialog";
import { ReviewTable, type TableMode } from "@/components/ReviewTable";
import { InteractionDetailModal } from "@/components/InteractionDetailModal";
import type {
  ActivoCandidato,
  EstadoAprobacion,
  EstadoTrabajo,
  ResultadoPipeline,
  ResultadoPipelineItem,
  ReviewTab,
  SolicitudProcesamiento,
  TrabajoPipeline,
} from "@/types/backend";
import {
  FORMATS,
  type ReviewRow,
  STATUSES,
  TABS,
  copyText,
  discardedRows,
  matchesSearch,
  rowStatuses,
  rowsForTab,
} from "@/lib/review";
import { apiFetch } from "@/lib/api";
import type { Usuario } from "@/types/auth";
import { copyToClipboard } from "@/lib/clipboard";

// El historial es la vista más pesada: se descarga solo cuando el usuario la abre.
const HistoryView = lazy(() => import("@/components/HistoryView").then((m) => ({ default: m.HistoryView })));
const TeamView = lazy(() => import("@/components/TeamView").then((m) => ({ default: m.TeamView })));

type ToastType = "success" | "error" | "info";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_FAILURES = 5;

function errorDetail(json: any, fallback: string): string {
  const detail = json?.detail ?? json?.error;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return "el archivo no tiene el formato esperado";
  return fallback;
}

// Valida y normaliza flexiblemente el archivo para cumplir el contrato SolicitudProcesamiento.
function parseBatch(text: string): SolicitudProcesamiento {
  let parsed: any;
  try {
    const cleanText = text.replace(/^\uFEFF/, "").trim();
    parsed = JSON.parse(cleanText);
  } catch (err: any) {
    throw new Error("No pudimos leer el archivo. Revisa que sea un archivo .json válido.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("No pudimos leer el archivo. Revisa que sea un archivo .json válido.");
  }

  if (parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)) {
    parsed = parsed.data;
  } else if (parsed.solicitud && typeof parsed.solicitud === "object" && !Array.isArray(parsed.solicitud)) {
    parsed = parsed.solicitud;
  }

  let rawInteractions: any[] = [];
  if (Array.isArray(parsed)) {
    rawInteractions = parsed;
  } else if (Array.isArray(parsed.interacciones)) {
    rawInteractions = parsed.interacciones;
  } else if (Array.isArray(parsed.items)) {
    rawInteractions = parsed.items.map((it: any) => it.interaccion || it);
  }

  if (!rawInteractions || rawInteractions.length === 0) {
    throw new Error("El archivo no tiene mensajes para revisar.");
  }
  if (rawInteractions.length > 500) {
    throw new Error("El archivo tiene más de 500 mensajes. Divídelo en partes más pequeñas y súbelas por separado.");
  }

  const invalid = rawInteractions.findIndex(
    (i: any) => !i || !["autor", "canal", "tipo", "texto"].every((k) => typeof i[k] === "string")
  );
  if (invalid !== -1) {
    throw new Error(`Al mensaje ${invalid + 1} le falta información: cada mensaje necesita autor, canal, tipo y texto.`);
  }

  const origen_comunidad =
    typeof parsed.origen_comunidad === "string" && parsed.origen_comunidad.trim()
      ? parsed.origen_comunidad.trim()
      : "Comunidad_General";
  const periodo_referencia =
    typeof parsed.periodo_referencia === "string" && parsed.periodo_referencia.trim()
      ? parsed.periodo_referencia.trim()
      : `Lote_${new Date().toISOString().slice(0, 10)}`;

  return {
    origen_comunidad,
    periodo_referencia,
    interacciones: rawInteractions,
  };
}

export default function ReviewApp({ usuario }: { usuario: Usuario | null }) {
  const [solicitud, setSolicitud] = useState<SolicitudProcesamiento | null>(null);
  const [result, setResult] = useState<ResultadoPipeline | null>(null);
  const [job, setJob] = useState<{ id: string; estado: EstadoTrabajo; total: number; procesadas: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isProcessing = isSubmitting || job?.estado === "en_cola" || job?.estado === "en_proceso";

  const [tab, setTab] = useState<ReviewTab>("todos");
  const [status, setStatus] = useState<EstadoAprobacion>("pendiente");
  const [showDiscarded, setShowDiscarded] = useState(false);
  const [search, setSearch] = useState("");

  const [detail, setDetail] = useState<{ itemId: string; candidateId?: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isPublishingOCI, setIsPublishingOCI] = useState(false);
  const [pendingWarning, setPendingWarning] = useState<{ interacciones: number; activos: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  // Cada rol empieza en la primera vista que puede usar (quien solo lee, en la tabla de casos).
  const allowedViews = viewsFor(usuario);
  const [viewMode, setViewModeState] = useState<AppView>(allowedViews[0] ?? "tabla");
  const setViewMode = (next: AppView) => allowedViews.includes(next) && setViewModeState(next);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const receivedRef = useRef(0);

  const notify = (msg: string, type: ToastType) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const cargarLote = async (lote: SolicitudProcesamiento) => {
    if (isProcessing) return;
    setIsSubmitting(true);
    setViewMode("revision");
    try {
      const response = await apiFetch("/api/pipeline/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lote),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.data) {
        throw new Error(errorDetail(json, `HTTP ${response.status}`));
      }

      const data: TrabajoPipeline = json.data;
      receivedRef.current = data.interacciones_procesadas.length;
      setSolicitud(lote);
      setResult({
        origen_comunidad: data.origen_comunidad,
        periodo_referencia: data.periodo_referencia,
        interacciones_procesadas: data.interacciones_procesadas,
      });
      setJob({ id: data.job_id, estado: data.estado, total: data.total, procesadas: data.procesadas });
      setTab("todos");
      setStatus("pendiente");
      setShowDiscarded(false);
      setSearch("");
      setDetail(null);
      notify(
        json.source === "fastapi"
          ? `Analizando ${data.total} ${data.total === 1 ? "mensaje" : "mensajes"}. Verás cada resultado en cuanto esté listo.`
          : "Modo demostración: te mostramos resultados de ejemplo para que explores la bandeja.",
        "info"
      );
    } catch (err: any) {
      notify(`No se pudo subir el archivo: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!job || (job.estado !== "en_cola" && job.estado !== "en_proceso")) return;
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await apiFetch(`/api/pipeline/jobs/${job.id}?desde=${receivedRef.current}`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.data) throw new Error(errorDetail(json, `HTTP ${res.status}`));
        if (cancelled) return;
        failures = 0;

        const data: TrabajoPipeline = json.data;
        const nuevas = data.interacciones_procesadas;
        if (data.desde === receivedRef.current && nuevas.length > 0) {
          receivedRef.current += nuevas.length;
          setResult((prev) => prev && { ...prev, interacciones_procesadas: [...prev.interacciones_procesadas, ...nuevas] });
        }
        setJob((j) => (j && j.id === data.job_id ? { ...j, estado: data.estado, procesadas: data.procesadas } : j));

        if (data.estado === "completado") {
          notify(`Listo: ${data.procesadas} ${data.procesadas === 1 ? "mensaje analizado" : "mensajes analizados"}`, "success");
          return;
        }
        if (data.estado === "fallido") {
          notify(`El procesamiento se detuvo: ${data.error ?? "error desconocido"}`, "error");
          return;
        }
      } catch (err: any) {
        if (cancelled) return;
        if (++failures >= MAX_POLL_FAILURES) {
          setJob((j) => j && { ...j, estado: "fallido" });
          notify(`Se perdió la conexión con el backend: ${err.message}`, "error");
          return;
        }
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS / 2);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [job?.id, job?.estado]);

  const handlePublishOCI = async () => {
    if (!solicitud || isPublishingOCI) return;

    const itemsToSave = result?.interacciones_procesadas ?? [];
    const pendingItems = itemsToSave.filter((it) =>
      it.activos_candidatos.some((c) => c.estado_aprobacion === "pendiente")
    );
    if (pendingItems.length > 0) {
      setPendingWarning({
        interacciones: pendingItems.length,
        activos: pendingItems.reduce(
          (n, it) => n + it.activos_candidatos.filter((c) => c.estado_aprobacion === "pendiente").length,
          0
        ),
      });
      return;
    }

    setIsPublishingOCI(true);
    notify("Guardando cambios en OCI Object Storage…", "info");

    try {
      const payload = {
        ...solicitud,
        items: result?.interacciones_procesadas ?? [],
      };
      const response = await apiFetch("/api/storage/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok || !json?.data) {
        throw new Error(errorDetail(json, `HTTP ${response.status}`));
      }

      const oci = json.data.almacenamiento_oci;
      notify(
        `✅ Cambios guardados en OCI Bucket '${oci.bucket}': ${oci.ruta_objeto}`,
        "success"
      );
      // Redirigir al historial para visualizar de inmediato el paquete guardado
      setViewMode("tabla");

      // Resetear la bandeja de entrada para que quede completamente limpia y lista para un nuevo lote
      setSolicitud(null);
      setResult(null);
      setJob(null);
      setDetail(null);
      setSearch("");
      setTab("todos");
    } catch (err: any) {
      notify(`Error al guardar cambios en OCI: ${err.message}`, "error");
    } finally {
      setIsPublishingOCI(false);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const lote = parseBatch(text);
      await cargarLote(lote);
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  // Revisión humana: el backend reemplaza `contenido`, por eso siempre se envía completo.
  const saveCandidate = async (
    item: ResultadoPipelineItem,
    candidato: ActivoCandidato,
    newStatus: EstadoAprobacion,
    contenido: Record<string, any>
  ): Promise<boolean> => {
    setSavingId(candidato.candidato_id);
    try {
      const res = await apiFetch(`/api/review/assets/${candidato.candidato_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado_aprobacion: newStatus, contenido }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.detail || json?.error || `HTTP ${res.status}`);

      setResult((prev) =>
        prev && {
          ...prev,
          interacciones_procesadas: prev.interacciones_procesadas.map((it) =>
            it.interaccion.id !== item.interaccion.id
              ? it
              : {
                  ...it,
                  activos_candidatos: it.activos_candidatos.map((c) =>
                    c.candidato_id === candidato.candidato_id ? { ...c, estado_aprobacion: newStatus, contenido } : c
                  ),
                }
          ),
        }
      );

      const label = FORMATS[candidato.tipo_activo].label;
      const what =
        newStatus === candidato.estado_aprobacion
          ? "guardado"
          : { aprobado: "aprobado", rechazado: "rechazado", pendiente: "marcado como pendiente" }[newStatus];
      notify(
        json?.source === "simulation" ? `${label} ${what} (solo en esta sesión)` : `${label} de ${item.interaccion.autor} ${what}`,
        "success"
      );
      return true;
    } catch (err: any) {
      notify(`No se pudo guardar la revisión: ${err.message}`, "error");
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const publish = async (candidato: ActivoCandidato) => {
    const channelName = FORMATS[candidato.tipo_activo].channel;
    if (candidato.tipo_activo === "post_linkedin") {
      const text = copyText(candidato.tipo_activo, candidato.contenido);
      await copyToClipboard(text);
      notify("¡Copiado al portapapeles! Abriendo LinkedIn para publicar...", "success");
      const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    notify(
      `Publicación en ${channelName} simulada: la integración con el canal aún no está disponible`,
      "info"
    );
  };

  const items = result?.interacciones_procesadas ?? [];
  const inDiscarded = tab === "todos" && showDiscarded;
  const tabRows = rowsForTab(items, tab);
  const baseRows = inDiscarded ? discardedRows(items) : tabRows;
  // Los conteos por estado siempre se calculan sobre la pestaña, aunque se vean las descartadas.
  const statusCount = (s: EstadoAprobacion) =>
    tab === "alertas"
      ? (s === "pendiente" ? tabRows.length : 0)
      : tabRows.filter((r) => rowStatuses(r).includes(s)).length;
  const isFilteredByStatus = tab !== "alertas" && !inDiscarded;
  const visibleRows = baseRows.filter(
    (r) => (!isFilteredByStatus || rowStatuses(r).includes(status)) && matchesSearch(r, search)
  );

  // Tarjetas de estado: "Descartados" equivale a la vista de descartadas de la pestaña Todos.
  const activeFilter: ReviewFilter = inDiscarded ? "descartado" : status;
  const selectFilter = (f: ReviewFilter) => {
    if (f === "descartado") {
      setTab("todos");
      setShowDiscarded(true);
    } else {
      setShowDiscarded(false);
      setStatus(f);
    }
  };
  const discardedCount = discardedRows(items).length;
  const statusTotal = STATUSES.reduce((sum, s) => sum + statusCount(s), 0);
  const scopeLabel = TABS.find((t) => t.key === tab)?.label.toLowerCase() ?? "todos";
  const percent = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Conteo de cada pestaña de contenido limitado al estado seleccionado en las tarjetas.
  const countForTab = (key: ReviewTab) => {
    if (inDiscarded) return key === "todos" ? discardedCount : 0;
    const rows = rowsForTab(items, key);
    if (key === "alertas") return status === "pendiente" ? rows.length : 0;
    return rows.filter((r) => rowStatuses(r).includes(status)).length;
  };

  const mode: TableMode = inDiscarded || tab === "alertas" ? "motivo" : tab === "todos" ? "todos" : "formato";
  const detailItem = detail && items.find((it) => it.interaccion.id === detail.itemId);

  // Arrastrar y soltar un .json funciona tanto en la pantalla vacía como sobre la bandeja.
  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    onDragLeave: () => setIsDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
  };

  const openDetail = (row: ReviewRow) =>
    setDetail({ itemId: row.item.interaccion.id, candidateId: row.candidato?.candidato_id });

  return (
    <div className="h-dvh flex flex-col lg:flex-row bg-ink-50">
      <Sidebar view={viewMode} onViewChange={setViewMode} usuario={usuario} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) handleFile(file);
        }}
      />

      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      {viewMode === "equipo" && usuario ? (
        <Suspense fallback={<div className="h-full flex items-center justify-center"><LoadingState label="Cargando el equipo…" /></div>}>
          <TeamView usuario={usuario} notify={notify} />
        </Suspense>
      ) : viewMode === "tabla" || viewMode === "dashboard" ? (
        <main className="flex-1 min-h-0 overflow-hidden bg-ink-50">
          <Suspense fallback={<div className="h-full flex items-center justify-center"><LoadingState label="Cargando historial…" /></div>}>
            <HistoryView view={viewMode} onViewChange={setViewMode} />
          </Suspense>
        </main>
      ) : (
        <>
          <PageHeader
            icon={<LayoutList className="w-[27px] h-[27px]" />}
            title="Bandeja de revisión"
            subtitle="Evalúa, edita y aprueba las propuestas de contenido generadas por la IA antes de guardarlas en el historial."
            actions={
              solicitud ? (
                <>
                  <button onClick={() => cargarLote(solicitud)} disabled={isProcessing || isPublishingOCI} className="btn-ghost">
                    <RefreshCw className={`w-4 h-4 ${isProcessing ? "animate-spin" : ""}`} />
                    Reprocesar
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="btn-soft">
                    <Upload className="w-4 h-4" />
                    Subir archivo
                  </button>
                  <button
                    onClick={handlePublishOCI}
                    disabled={isProcessing || isPublishingOCI}
                    className="btn-primary"
                    title="Guardar cambios en OCI Object Storage (Equipo D)"
                  >
                    <Upload className={`w-4 h-4 ${isPublishingOCI ? "animate-spin" : ""}`} />
                    {isPublishingOCI ? "Guardando cambios…" : "Guardar cambios"}
                  </button>
                </>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="btn-primary">
                  <Upload className="w-4 h-4" />
                  Subir archivo
                </button>
              )
            }
          >
            {(solicitud || (job && isProcessing)) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                {solicitud && (
                  <span className="text-ink-900/80">
                    <span className="font-medium">{solicitud.origen_comunidad}</span>
                    <span className="text-ink-900/60"> · {solicitud.periodo_referencia} · {items.length} de {solicitud.interacciones.length} interacciones</span>
                  </span>
                )}
                {job && isProcessing && (
                  <div className="flex items-center gap-2.5 flex-1 min-w-[200px] max-w-md">
                    <span className="text-brand-700 font-medium whitespace-nowrap">
                      Analizando {job.procesadas} de {job.total} mensajes…
                    </span>
                    <div
                      role="progressbar"
                      aria-label="Avance del lote"
                      aria-valuemin={0}
                      aria-valuemax={job.total}
                      aria-valuenow={job.procesadas}
                      className="flex-1 h-1.5 rounded-full bg-chart-track overflow-hidden"
                    >
                      <div
                        className="progress-bar h-full rounded-full"
                        style={{ width: `${job.total ? Math.max(4, (job.procesadas / job.total) * 100) : 4}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </PageHeader>

          {!result ? (
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6" {...dropHandlers}>
          {isSubmitting ? (
            <LoadingState label="Subiendo tu archivo…" hint="Esto tarda solo unos segundos." />
          ) : (
            <div
              className={`text-center w-full max-w-lg flex flex-col items-center gap-5 px-6 py-12 sm:px-10 rounded-3xl border-2 border-dashed transition-colors ${
                isDragging ? "border-brand-500 bg-brand-100" : "border-ink-300 bg-surface"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center">
                <FileJson className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-ink-900">
                  {isDragging ? "Suelta el archivo para empezar" : "Sube las conversaciones de tu comunidad"}
                </h2>
                <p className="text-sm text-ink-600 mt-2 leading-relaxed max-w-sm mx-auto">
                  Arrastra aquí el archivo con los mensajes que quieres revisar o búscalo en tu equipo. Analizaremos cada
                  mensaje y te sugeriremos publicaciones para LinkedIn, el newsletter y las preguntas frecuentes.
                </p>
                <p className="text-xs text-ink-500 mt-3">Archivo .json · hasta 500 mensajes</p>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="btn-primary">
                <Upload className="w-4 h-4" />
                Subir archivo
              </button>
            </div>
          )}
        </main>
          ) : (
        <>
          {/* Nivel 1: estados de revisión (tarjetas resumen seleccionables) */}
          <div className="bg-surface px-4 sm:px-5 pb-4">
            <StatusCards
              active={activeFilter}
              onSelect={selectFilter}
              cards={[
                ...STATUSES.map((s) => ({
                  key: s,
                  count: statusCount(s),
                  metric: `${percent(statusCount(s), statusTotal)}% de ${scopeLabel}`,
                })),
                {
                  key: "descartado" as const,
                  count: discardedCount,
                  metric: `${percent(discardedCount, items.length)}% del lote`,
                },
              ]}
            />
          </div>

          {/* Nivel 2: filtro por contenido (formato y búsqueda) */}
          <div className="bg-surface border-b border-ink-200 px-4 sm:px-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <nav className="flex gap-1 overflow-x-auto -mb-px max-w-full" role="tablist" aria-label="Filtrar por formato">
              {TABS.map((t) => {
                const count = countForTab(t.key);
                const selected = tab === t.key && !inDiscarded;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setTab(t.key);
                      setShowDiscarded(false);
                    }}
                    className={`px-3.5 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                      selected ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-900"
                    }`}
                  >
                    {t.label}
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        selected ? "bg-brand-100 text-brand-800" : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Buscador */}
            <div className="relative w-full sm:w-auto pb-2">
              <Search className="w-4 h-4 text-ink-500 absolute left-3 top-[calc(50%-4px)] -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por autor…"
                aria-label="Buscar en la bandeja por autor"
                className="text-sm pl-9 pr-3 py-2 w-full sm:w-64 rounded-full bg-ink-900/5 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <main className="flex-1 overflow-auto bg-surface relative" {...dropHandlers}>
            {isDragging && (
              <div className="absolute inset-0 z-20 bg-brand-500/10 border-2 border-dashed border-brand-500 backdrop-blur-xs flex items-center justify-center">
                <div className="bg-surface px-6 py-4 rounded-xl shadow-lg text-sm font-semibold text-brand-700 flex items-center gap-2">
                  <Upload className="w-4 h-4 animate-bounce" />
                  Suelta el archivo para revisarlo
                </div>
              </div>
            )}

            {visibleRows.length > 0 ? (
              <ReviewTable
                rows={visibleRows}
                mode={mode}
                savingId={savingId}
                selectedKey={detail ? detail.candidateId ?? detail.itemId : null}
                onOpen={openDetail}
                onSetStatus={(item, c, s) => saveCandidate(item, c, s, c.contenido)}
              />
            ) : (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-ink-500 text-center">
                <Inbox className="w-8 h-8 text-ink-300" />
                <p className="text-sm font-medium text-ink-600">No hay elementos para mostrar</p>
                <p className="text-xs">
                  {search ? "Prueba con otra búsqueda o limpia el filtro." : "No hay candidatos con los filtros actuales."}
                </p>
              </div>
            )}
          </main>
        </>
          )}
        </>
      )}
      </div>

      {detailItem && (
        <InteractionDetailModal
          key={detailItem.interaccion.id}
          item={detailItem}
          initialCandidateId={detail.candidateId}
          savingId={savingId}
          onClose={() => setDetail(null)}
          onSave={saveCandidate}
          onPublish={publish}
          onCopied={() => notify("Contenido copiado al portapapeles", "info")}
        />
      )}

      {pendingWarning && (
        <AlertDialog
          icon={<AlertTriangle className="w-5 h-5" />}
          title="Hay contenido pendiente de revisar"
          onClose={() => setPendingWarning(null)}
          actions={
            <>
              <button onClick={() => setPendingWarning(null)} className="btn-ghost">
                Cerrar
              </button>
              <button
                onClick={() => {
                  setPendingWarning(null);
                  setViewMode("revision");
                  setTab("todos");
                  setShowDiscarded(false);
                  setStatus("pendiente");
                }}
                className="btn-primary"
              >
                Revisar pendientes
              </button>
            </>
          }
        >
          <p>
            {pendingWarning.interacciones === 1 ? "1 interacción tiene" : `${pendingWarning.interacciones} interacciones tienen`}{" "}
            {pendingWarning.activos === 1 ? "1 contenido" : `${pendingWarning.activos} contenidos`} sin aprobar ni rechazar.
            Revísalos antes de guardar el lote en el historial.
          </p>
        </AlertDialog>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-70 bg-ink-900 text-ink-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm"
        >
          <span
            className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs ${
              toast.type === "success" ? "bg-success-500" : toast.type === "error" ? "bg-danger-500" : "bg-brand-500"
            }`}
          >
            {toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "i"}
          </span>
          <p className="text-xs font-medium">{toast.msg}</p>
        </div>
      )}
    </div>
  );
}

function LoadingState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center text-ink-600">
      <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-ink-500 max-w-xs">{hint}</p>}
    </div>
  );
}
