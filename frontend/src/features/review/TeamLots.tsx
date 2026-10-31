import { useEffect, useState } from "react";
import { FolderOpen, Trash2 } from "lucide-react";
import type { ResumenLote } from "@/types/backend";
import { apiFetch } from "@/lib/client/api";
import { errorDetail } from "@/features/review/batch";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { SPOT_TONES, SpotlightCard, SpotlightGallery } from "@/components/ui/Spotlight";

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const enCurso = (lote: ResumenLote) => lote.estado === "en_cola" || lote.estado === "en_proceso";

const generados = (lote: ResumenLote) => lote.activos_pendientes + lote.activos_aprobados + lote.activos_rechazados;

function descripcion(lote: ResumenLote): string {
  if (enCurso(lote)) {
    return `La IA está analizando el lote: ${lote.procesadas} de ${lote.total} mensajes listos. Puedes abrirlo y revisar lo que ya está.`;
  }
  const corte = lote.estado === "fallido" ? " El análisis se interrumpió; lo ya analizado se conserva." : "";
  if (lote.activos_pendientes > 0) {
    return `${lote.activos_pendientes === 1 ? "Queda" : "Quedan"} ${plural(lote.activos_pendientes, "contenido", "contenidos")} por aprobar o rechazar de ${generados(lote)} generados. Cualquiera del equipo puede continuar.${corte}`;
  }
  if (generados(lote) === 0) return `Ningún mensaje generó contenido para revisar.${corte}`;
  return `Todo el contenido está revisado. Falta que un admin guarde el lote en el historial.${corte}`;
}

/** Lotes que alguien del equipo subió y todavía no se guardaron en la nube, como las tarjetas de la portada. */
export function TeamLots({
  usuarioId,
  isAdmin,
  onOpen,
  notify,
}: {
  usuarioId?: string;
  /** Solo admin puede eliminar lotes (el backend también lo exige). */
  isAdmin: boolean;
  onOpen: (id: string) => void;
  notify: (msg: string, type: "success" | "error" | "info") => void;
}) {
  const [lotes, setLotes] = useState<ResumenLote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [porEliminar, setPorEliminar] = useState<ResumenLote | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/pipeline/jobs")
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(errorDetail(json, `HTTP ${res.status}`));
        if (!cancelled) setLotes(json?.data ?? []);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const eliminar = async () => {
    if (!porEliminar) return;
    setEliminando(true);
    try {
      const res = await apiFetch(`/api/pipeline/jobs/${encodeURIComponent(porEliminar.job_id)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(errorDetail(json, `HTTP ${res.status}`));
      }
      setLotes((prev) => prev && prev.filter((l) => l.job_id !== porEliminar.job_id));
      notify(`Lote ${porEliminar.origen_comunidad} · ${porEliminar.periodo_referencia} eliminado`, "success");
      setPorEliminar(null);
    } catch (err: any) {
      notify(`No se pudo eliminar el lote: ${err.message}`, "error");
    } finally {
      setEliminando(false);
    }
  };

  if (error) return <p className="text-xs text-danger-700">No se pudieron cargar los lotes del equipo: {error}</p>;
  if (!lotes || lotes.length === 0) return null;

  return (
    <section className="w-full max-w-6xl" aria-labelledby="lotes-equipo">
      <h3 id="lotes-equipo" className="text-lg font-medium text-ink-900 mb-4">
        Lotes del equipo por revisar
      </h3>
      <SpotlightGallery columns={3}>
        {lotes.map((lote, index) => {
          const autor = lote.creado_por.usuario_id === usuarioId ? "ti" : lote.creado_por.nombre;
          const nombre = `${lote.origen_comunidad} · ${lote.periodo_referencia}`;
          return (
            <SpotlightCard
              key={lote.job_id}
              tone={SPOT_TONES[index % SPOT_TONES.length]}
              icon={<FolderOpen className="w-8 h-8" strokeWidth={1.75} />}
            >
              <div className="relative h-full">
                <button
                  onClick={() => onOpen(lote.job_id)}
                  aria-label={`Abrir el lote ${nombre}, subido por ${autor}`}
                  className="flex h-full w-full flex-col justify-between gap-8 text-left text-ink-900 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
                >
                  <div>
                    <h4 className={`mb-4 text-lg font-medium ${isAdmin ? "pr-10" : ""}`}>{nombre}</h4>
                    <p className="leading-relaxed opacity-90">{descripcion(lote)}</p>
                  </div>
                  <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
                    <span className="opacity-60">{fecha(lote.creado_por.en)}</span>
                    <span className="flex flex-wrap gap-x-4">
                      <span className="spot-meta">
                        <span>@</span>
                        {autor}
                      </span>
                      <span className="spot-meta">
                        <span>#</span>
                        {plural(lote.activos_pendientes, "pendiente", "pendientes")}
                      </span>
                    </span>
                  </div>
                </button>
                {isAdmin && !enCurso(lote) && (
                  <button
                    onClick={() => setPorEliminar(lote)}
                    aria-label={`Eliminar el lote ${nombre}`}
                    title="Eliminar lote"
                    className="absolute -top-1.5 -right-1.5 p-2 rounded-lg text-ink-500 hover:text-danger-700 hover:bg-danger-50 cursor-pointer transition focus-visible:outline-2 focus-visible:outline-brand-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </SpotlightCard>
          );
        })}
      </SpotlightGallery>

      {porEliminar && (
        <AlertDialog
          icon={<Trash2 className="w-5 h-5" />}
          title="¿Eliminar este lote?"
          onClose={() => !eliminando && setPorEliminar(null)}
          actions={
            <>
              <button onClick={() => setPorEliminar(null)} disabled={eliminando} className="btn-ghost">
                Cancelar
              </button>
              <button onClick={eliminar} disabled={eliminando} className="btn-danger">
                <Trash2 className="w-4 h-4" />
                {eliminando ? "Eliminando…" : "Eliminar lote"}
              </button>
            </>
          }
        >
          <p>
            Se borrarán <strong className="text-ink-900">{porEliminar.origen_comunidad} · {porEliminar.periodo_referencia}</strong>,
            sus {plural(porEliminar.procesadas, "mensaje analizado", "mensajes analizados")}, los{" "}
            {plural(generados(porEliminar), "contenido generado", "contenidos generados")} y el historial de quién aprobó o
            rechazó cada uno
            {porEliminar.activos_aprobados > 0 &&
              ` (incluidas ${plural(porEliminar.activos_aprobados, "aprobación", "aprobaciones")} del equipo)`}
            .
          </p>
          <p className="mt-2 font-medium text-danger-700">Esta acción no se puede deshacer.</p>
        </AlertDialog>
      )}
    </section>
  );
}
