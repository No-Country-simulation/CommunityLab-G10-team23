import { useMemo, useState } from "react";
import { Calendar, MessageSquare, Sparkles, TrendingUp, X } from "lucide-react";
import { BarList, ChartCard, RingChart, StackedColumns } from "@/features/history/DashboardCharts";
import {
  computeDashboardStats,
  computeWordCloud,
  formatLocalYMD,
  type DateRangeOption,
  type FlatCase,
} from "@/features/history/model";

export interface DateRangeControls {
  dateRange: DateRangeOption;
  setDateRange: (value: DateRangeOption) => void;
  customStartDate: string;
  setCustomStartDate: (value: string) => void;
  customEndDate: string;
  setCustomEndDate: (value: string) => void;
}

interface DashboardViewProps extends DateRangeControls {
  /** Casos del período elegido (el filtro de fechas es compartido con la tabla). */
  cases: FlatCase[];
  packagesCount: number;
  /** Abre la tabla filtrada por un término de la nube de palabras. */
  onSearchTerm: (term: string) => void;
}

// Dashboard de comunidad [figma:charts]: métricas y distribuciones de los casos guardados.
export function DashboardView({
  cases,
  packagesCount,
  onSearchTerm,
  dateRange,
  setDateRange,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
}: DashboardViewProps) {
  const [selectedCloudWord, setSelectedCloudWord] = useState<string | null>(null);
  const wordCloudData = useMemo(() => computeWordCloud(cases), [cases]);
  const dashboardStats = useMemo(() => computeDashboardStats(cases), [cases]);

  return (
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
                <p className="text-sm text-white/80 mt-2">{packagesCount} paquete(s) registrados</p>
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
                        onClick={() => onSearchTerm(selectedCloudWord)}
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
  );
}
