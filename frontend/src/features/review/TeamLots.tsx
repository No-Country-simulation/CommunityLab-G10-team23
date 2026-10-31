import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import type { ResumenLote } from "@/types/backend";
import { apiFetch } from "@/lib/client/api";
import { errorDetail } from "@/features/review/batch";
import { SPOT_TONES, SpotlightCard, SpotlightGallery } from "@/components/ui/Spotlight";

const fecha = (iso: string) =>
  new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function descripcion(lote: ResumenLote): string {
  const generados = lote.activos_pendientes + lote.activos_aprobados + lote.activos_rechazados;
  if (lote.estado === "en_cola" || lote.estado === "en_proceso") {
    return `La IA está analizando el lote: ${lote.procesadas} de ${lote.total} mensajes listos. Puedes abrirlo y revisar lo que ya está.`;
  }
  const corte = lote.estado === "fallido" ? " El análisis se interrumpió; lo ya analizado se conserva." : "";
  if (lote.activos_pendientes > 0) {
    return `Quedan ${plural(lote.activos_pendientes, "contenido", "contenidos")} por aprobar o rechazar de ${generados} generados. Cualquiera del equipo puede continuar.${corte}`;
  }
  if (generados === 0) return `Ningún mensaje generó contenido para revisar.${corte}`;
  return `Todo el contenido está revisado. Falta que un admin guarde el lote en el historial.${corte}`;
}

/** Lotes que alguien del equipo subió y todavía no se guardaron en la nube, como las tarjetas de la portada. */
export function TeamLots({ usuarioId, onOpen }: { usuarioId?: string; onOpen: (id: string) => void }) {
  const [lotes, setLotes] = useState<ResumenLote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) return <p className="text-xs text-danger-700">No se pudieron cargar los lotes del equipo: {error}</p>;
  if (!lotes || lotes.length === 0) return null;

  return (
    <section className="w-full max-w-4xl" aria-labelledby="lotes-equipo">
      <h3 id="lotes-equipo" className="text-lg font-medium text-ink-900 mb-4">
        Lotes del equipo por revisar
      </h3>
      <SpotlightGallery>
        {lotes.map((lote, index) => {
          const autor = lote.creado_por.usuario_id === usuarioId ? "ti" : lote.creado_por.nombre;
          return (
            <SpotlightCard
              key={lote.job_id}
              tone={SPOT_TONES[index % SPOT_TONES.length]}
              icon={<FolderOpen className="w-8 h-8" strokeWidth={1.75} />}
            >
              <button
                onClick={() => onOpen(lote.job_id)}
                aria-label={`Abrir el lote ${lote.origen_comunidad} ${lote.periodo_referencia}, subido por ${autor}`}
                className="flex h-full w-full flex-col justify-between gap-8 text-left text-ink-900 cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"
              >
                <div>
                  <h4 className="mb-4 text-lg font-medium">
                    {lote.origen_comunidad} · {lote.periodo_referencia}
                  </h4>
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
            </SpotlightCard>
          );
        })}
      </SpotlightGallery>
    </section>
  );
}
