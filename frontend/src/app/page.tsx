"use client";

import React, { useEffect, useRef, useState } from "react";
import { Upload, Loader2, Search, Ban, Inbox, FileJson } from "lucide-react";
import { Header } from "@/components/Header";
import { ReviewTable, TableMode } from "@/components/ReviewTable";
import { InteractionDetailModal } from "@/components/InteractionDetailModal";
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

// Valida que el archivo cumpla el contrato SolicitudProcesamiento.
function parseBatch(text: string): SolicitudProcesamiento {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (err: any) {
    throw new Error(`El archivo no es un JSON válido: ${err.message}`);
  }
  if (!parsed || typeof parsed.origen_comunidad !== "string" || typeof parsed.periodo_referencia !== "string") {
    throw new Error("Faltan los campos origen_comunidad o periodo_referencia.");
  }
  if (!Array.isArray(parsed.interacciones) || parsed.interacciones.length === 0) {
    throw new Error("El lote no tiene interacciones.");
  }
  if (parsed.interacciones.length > 500) {
    throw new Error("El lote supera el máximo de 500 interacciones.");
  }
  const invalid = parsed.interacciones.findIndex(
    (i: any) => !i || !["autor", "canal", "tipo", "texto"].every((k) => typeof i[k] === "string")
  );
  if (invalid !== -1) {
    throw new Error(`La interacción ${invalid + 1} debe tener autor, canal, tipo y texto.`);
  }
  return parsed;
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
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Cantidad de interacciones ya recibidas del trabajo actual (parámetro `desde`).
  const receivedRef = useRef(0);

  const notify = (msg: string, type: ToastType) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  // Punto único de entrada de un lote: hoy desde archivo o demo, en el futuro desde la nube.
  // El backend lo procesa en segundo plano, una interacción a la vez.
  const cargarLote = async (lote: SolicitudProcesamiento) => {
    if (isProcessing) return;
    setIsSubmitting(true);
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

  // Consulta el avance del trabajo y agrega las filas nuevas a medida que el backend las termina.
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

  const handleFile = async (file: File) => {
    try {
      cargarLote(parseBatch(await file.text()));
    } catch (err: any) {
      notify(err.message, "error");
    }
  };

  // Arrastrar un .json sobre cualquier parte de la página.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setIsDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) handleFile(file);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  });

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

      {!result ? (
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
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 text-sm px-3 py-3 border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
                    selected
                      ? "border-indigo-600 text-indigo-700 font-semibold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                  <span
                    className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-full ${
                      t.key === "alertas" && count > 0
                        ? "bg-orange-100 text-orange-800"
                        : selected
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-3">
            {usesStatus && (
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg" role="radiogroup" aria-label="Estado de revisión">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={status === s}
                    onClick={() => setStatus(s)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer ${
                      status === s ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {STATUS_PLURAL[s]}
                    <span className="tabular-nums text-slate-400">{statusCount(s)}</span>
                  </button>
                ))}
              </div>
            )}
            {tab === "alertas" && (
              <p className="text-xs text-slate-500">
                Interacciones que requieren atención del equipo. No generan contenido para revisar.
              </p>
            )}
            {inDiscarded && (
              <p className="text-xs text-slate-500">Interacciones que la IA descartó por no tener potencial de contenido.</p>
            )}

            <div className="ml-auto flex items-center gap-2">
              {tab === "todos" && (
                <button
                  onClick={() => setShowDiscarded((v) => !v)}
                  aria-pressed={showDiscarded}
                  className={`text-xs font-medium px-3 py-2 rounded-lg border flex items-center gap-1.5 cursor-pointer ${
                    showDiscarded
                      ? "bg-slate-800 border-slate-800 text-white"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  Ver descartadas
                  <span className="tabular-nums opacity-70">{discardedRows(items).length}</span>
                </button>
              )}
              <label className="relative">
                <span className="sr-only">Buscar por autor</span>
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar autor…"
                  className="text-sm pl-8 pr-3 py-1.5 w-48 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>

          <main className="flex-1 overflow-auto relative bg-white">
            {visibleRows.length > 0 ? (
              <ReviewTable
                rows={visibleRows}
                mode={mode}
                savingId={savingId}
                onOpen={openDetail}
                onSetStatus={(item, c, s) => saveCandidate(item, c, s, c.contenido)}
              />
            ) : isProcessing && job && !search ? (
              <div className="h-full flex items-center justify-center p-6">
                <LoadingState
                  label={`Procesando interacción ${Math.min(job.procesadas + 1, job.total)} de ${job.total}…`}
                  hint="Las filas aparecerán aquí a medida que la IA termine cada interacción."
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-6 text-slate-500">
                <Inbox className="w-8 h-8 text-slate-300" />
                <p className="text-sm">
                  {search
                    ? `Ningún autor coincide con "${search}".`
                    : inDiscarded
                    ? "No hay interacciones descartadas en este lote."
                    : tab === "alertas"
                    ? "No hay alertas de soporte en este lote."
                    : `No hay contenidos ${STATUS_PLURAL[status].toLowerCase()} en esta pestaña.`}
                </p>
              </div>
            )}
            {isSubmitting && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                <LoadingState label="Enviando el lote al backend…" />
              </div>
            )}
          </main>
        </>
      )}

      {detailItem && (
        <InteractionDetailModal
          key={detailItem.interaccion.id}
          item={detailItem}
          initialCandidateId={detail?.candidateId}
          savingId={savingId}
          onClose={() => setDetail(null)}
          onSave={saveCandidate}
          onPublish={publish}
          onCopied={() => notify("Contenido copiado al portapapeles", "info")}
        />
      )}

      {isDragging && (
        <div className="fixed inset-0 z-60 bg-indigo-600/15 backdrop-blur-[1px] p-4 pointer-events-none">
          <div className="h-full rounded-2xl border-2 border-dashed border-indigo-500 flex flex-col items-center justify-center gap-2 text-indigo-700">
            <Upload className="w-10 h-10" />
            <p className="text-lg font-semibold">Suelta el archivo JSON para procesarlo</p>
          </div>
        </div>
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
