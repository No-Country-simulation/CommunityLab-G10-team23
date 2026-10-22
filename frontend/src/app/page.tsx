"use client";

import React, { useEffect, useRef, useState } from "react";
import { Upload, Loader2, Search, Ban, Inbox, FileJson } from "lucide-react";
import { Header } from "@/components/Header";
import { ReviewTable, TableMode } from "@/components/ReviewTable";
import { InteractionDetailModal } from "@/components/InteractionDetailModal";
import { HistoryView } from "@/components/HistoryView";
import {
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
  ReviewRow,
  STATUSES,
  STATUS_PLURAL,
  TABS,
  discardedRows,
  matchesSearch,
  rowStatuses,
  rowsForTab,
} from "@/lib/review";
import { SAMPLES } from "@/lib/samples";

type ToastType = "success" | "error" | "info";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_FAILURES = 5;

function errorDetail(json: any, fallback: string): string {
  const detail = json?.detail ?? json?.error;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return "el lote no cumple el contrato SolicitudProcesamiento";
  return fallback;
}

// Valida y normaliza flexiblemente el archivo para cumplir el contrato SolicitudProcesamiento.
function parseBatch(text: string): SolicitudProcesamiento {
  let parsed: any;
  try {
    const cleanText = text.replace(/^\uFEFF/, "").trim();
    parsed = JSON.parse(cleanText);
  } catch (err: any) {
    throw new Error(`El archivo no es un JSON válido: ${err.message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("El archivo no contiene un JSON válido.");
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
    throw new Error("El archivo JSON no contiene ninguna lista de interacciones.");
  }
  if (rawInteractions.length > 500) {
    throw new Error("El lote supera el máximo de 500 interacciones.");
  }

  const invalid = rawInteractions.findIndex(
    (i: any) => !i || !["autor", "canal", "tipo", "texto"].every((k) => typeof i[k] === "string")
  );
  if (invalid !== -1) {
    throw new Error(`La interacción ${invalid + 1} debe tener autor, canal, tipo y texto.`);
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

export default function Home() {
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
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const [viewMode, setViewMode] = useState<"revision" | "historial">("revision");

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
      const response = await fetch("/api/pipeline/jobs", {
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
          ? `Procesando ${data.total} ${data.total === 1 ? "interacción" : "interacciones"} una por una…`
          : "Lote procesado en modo demostración (backend no disponible)",
        "info"
      );
    } catch (err: any) {
      notify(`Error procesando el lote: ${err.message}`, "error");
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
        const res = await fetch(`/api/pipeline/jobs/${job.id}?desde=${receivedRef.current}`);
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
          notify(`Lote procesado: ${data.procesadas} ${data.procesadas === 1 ? "interacción" : "interacciones"}`, "success");
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
    setIsPublishingOCI(true);
    notify("Guardando cambios en OCI Object Storage…", "info");

    try {
      const payload = {
        ...solicitud,
        items: result?.interacciones_procesadas ?? [],
      };
      const response = await fetch("/api/storage/publish", {
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
      setViewMode("historial");
    } catch (err: any) {
      notify(`Error al guardar cambios en OCI: ${err.message}`, "error");
    } finally {
      setIsPublishingOCI(false);
    }
  };

  const handleClearBatch = () => {
    setSolicitud(null);
    setResult(null);
    setJob(null);
    setDetail(null);
    receivedRef.current = 0;
    notify("Bandeja limpiada. Puedes cargar un nuevo lote.", "info");
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
      const res = await fetch(`/api/review/assets/${candidato.candidato_id}`, {
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

  const publish = (candidato: ActivoCandidato) => {
    notify(
      `Publicación en ${FORMATS[candidato.tipo_activo].channel} simulada: la integración con el canal aún no está disponible`,
      "info"
    );
  };

  const items = result?.interacciones_procesadas ?? [];
  const inDiscarded = tab === "todos" && showDiscarded;
  const usesStatus = tab !== "alertas" && !inDiscarded;
  const baseRows = inDiscarded ? discardedRows(items) : rowsForTab(items, tab);
  const statusCount = (s: EstadoAprobacion) => baseRows.filter((r) => rowStatuses(r).includes(s)).length;
  const visibleRows = baseRows.filter(
    (r) => (!usesStatus || rowStatuses(r).includes(status)) && matchesSearch(r, search)
  );

  const mode: TableMode = inDiscarded || tab === "alertas" ? "motivo" : tab === "todos" ? "todos" : "formato";
  const detailItem = detail && items.find((it) => it.interaccion.id === detail.itemId);

  const openDetail = (row: ReviewRow) =>
    setDetail({ itemId: row.item.interaccion.id, candidateId: row.candidato?.candidato_id });

  return (
    <div className="h-dvh flex flex-col bg-slate-50">
      <Header
        batch={
          solicitud && { origen: solicitud.origen_comunidad, periodo: solicitud.periodo_referencia, total: solicitud.interacciones.length }
        }
        isLoading={isProcessing}
        progress={job && isProcessing ? { procesadas: job.procesadas, total: job.total } : null}
        onPickFile={() => fileInputRef.current?.click()}
        onReprocess={() => solicitud && cargarLote(solicitud)}
        onLoadSample={(key) => {
          const sample = SAMPLES.find((s) => s.key === key);
          if (sample) cargarLote(sample.data);
        }}
        onPublishOCI={handlePublishOCI}
        onClearBatch={handleClearBatch}
        isPublishing={isPublishingOCI}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
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

      {viewMode === "historial" ? (
        <main className="flex-1 overflow-hidden bg-slate-50">
          <HistoryView />
        </main>
      ) : !result ? (
        <main className="flex-1 flex items-center justify-center p-6">
          {isSubmitting ? (
            <LoadingState label="Enviando el lote al backend…" />
          ) : (
            <div className="text-center max-w-md flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <FileJson className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Esperando un lote de interacciones</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Carga un archivo JSON con el contrato <code className="text-xs">SolicitudProcesamiento</code> o
                  arrástralo a cualquier parte de la página. Se procesará automáticamente.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Cargar JSON
              </button>
            </div>
          )}
        </main>
      ) : (
        <>
          <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 flex gap-1 overflow-x-auto" role="tablist">
            {TABS.map((t) => {
              const count = rowsForTab(items, t.key).length;
              const selected = tab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setTab(t.key);
                    setShowDiscarded(false);
                  }}
                  className={`px-3 py-3 text-xs font-semibold border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                    selected ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                      selected ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {usesStatus && (
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group">
                  {STATUSES.map((s) => {
                    const count = statusCount(s);
                    const active = status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setStatus(s)}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                          active ? "bg-white text-slate-900 shadow-xs font-semibold" : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {STATUS_PLURAL[s]}
                        <span className="text-[11px] text-slate-400 font-normal">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {tab === "todos" && (
                <button
                  onClick={() => setShowDiscarded((v) => !v)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    showDiscarded
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  Descartadas ({discardedRows(items).length})
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por autor, texto o motivo…"
                className="text-xs pl-8 pr-3 py-1.5 w-64 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
            </div>
          </div>

          <main
            className="flex-1 overflow-auto bg-white relative"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            {isDragging && (
              <div className="absolute inset-0 z-20 bg-indigo-500/10 border-2 border-dashed border-indigo-500 backdrop-blur-xs flex items-center justify-center">
                <div className="bg-white px-6 py-4 rounded-xl shadow-lg text-sm font-semibold text-indigo-700 flex items-center gap-2">
                  <Upload className="w-4 h-4 animate-bounce" />
                  Suelta el archivo JSON aquí
                </div>
              </div>
            )}

            {visibleRows.length > 0 ? (
              <ReviewTable
                rows={visibleRows}
                mode={mode}
                savingId={savingId}
                onOpen={openDetail}
                onSetStatus={(item, c, s) => saveCandidate(item, c, s, c.contenido)}
              />
            ) : (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 text-center">
                <Inbox className="w-8 h-8 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No hay elementos para mostrar</p>
                <p className="text-xs">
                  {search ? "Prueba con otra búsqueda o limpia el filtro." : "No hay candidatos con los filtros actuales."}
                </p>
              </div>
            )}
          </main>
        </>
      )}

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

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-70 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm"
        >
          <span
            className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs ${
              toast.type === "success" ? "bg-emerald-500" : toast.type === "error" ? "bg-rose-500" : "bg-indigo-500"
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
    <div className="flex flex-col items-center gap-3 text-center text-slate-600">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-slate-400 max-w-xs">{hint}</p>}
    </div>
  );
}
