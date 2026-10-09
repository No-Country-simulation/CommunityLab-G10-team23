"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Step1JsonInput } from "@/components/Step1JsonInput";
import { Step2AnalysisType } from "@/components/Step2AnalysisType";
import { Step3ActionBlock } from "@/components/Step3ActionBlock";
import { Step4ResultsList } from "@/components/Step4ResultsList";
import { SocialChannelBar } from "@/components/SocialChannelBar";
import {
  SolicitudProcesamiento,
  ResultadoPipeline,
  PublicationCard,
  AssetCategoryKey,
  EstadoAprobacion,
} from "@/types/backend";

// Ejemplos oficiales acordados con el backend
const sampleOfficial: SolicitudProcesamiento = {
  origen_comunidad: "Discord_Grupo_ONE_G10",
  periodo_referencia: "Semana_04",
  interacciones: [
    {
      autor: "Mariana Souza",
      canal: "#logros-y-empleos",
      tipo: "testimonio",
      texto: "Quedé seleccionada para mi primer empleo de desarrollo gracias al proyecto del hackathon y el apoyo de los mentores.",
    },
    {
      autor: "Lucas Gómez",
      canal: "#dudas-tecnicas",
      tipo: "pregunta",
      texto: "¿Cómo puedo desplegar un contenedor de FastAPI con LangGraph en Oracle Cloud Infrastructure (OCI)?",
    },
    {
      autor: "Comité Organizador",
      canal: "#anuncios",
      tipo: "comunicado",
      texto: "¡Felicitaciones a los más de 20 equipos que lograron conectar el flujo completo de ingesta, clasificación y generación!",
    },
  ],
};

const sampleEmpty: SolicitudProcesamiento = {
  origen_comunidad: "Discord_Test",
  periodo_referencia: "Semana_04",
  interacciones: [
    {
      autor: "UsuarioBot",
      canal: "#spam",
      tipo: "test",
      texto: "ok ok 123",
    },
  ],
};

export default function Home() {
  // Estado Paso 1
  const [jsonString, setJsonString] = useState("");
  const [parsedData, setParsedData] = useState<SolicitudProcesamiento | null>(null);
  const [isValidJson, setIsValidJson] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Estado Paso 2
  const [analysisType, setAnalysisType] = useState<"auto" | "directed" | null>(null);

  // Estado Paso 3
  const [isLoading, setIsLoading] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<ResultadoPipeline | null>(null);
  const [activePlatformFilter, setActivePlatformFilter] = useState<AssetCategoryKey>("linkedin");
  const [platformCounts, setPlatformCounts] = useState({
    linkedin: 0,
    newsletter: 0,
    faq: 0,
    testimonios: 0,
  });

  // Estado Paso 4
  const [hasRunAnalysis, setHasRunAnalysis] = useState(false);
  const [allPublicationsByPlatform, setAllPublicationsByPlatform] = useState<Record<AssetCategoryKey, PublicationCard[]>>({
    linkedin: [],
    newsletter: [],
    faq: [],
    testimonios: [],
  });
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);

  // Notificaciones Toast
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  const showNotification = (msg: string, type: "success" | "error" | "info") => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Validar JSON cada vez que cambie jsonString
  useEffect(() => {
    const trimmed = jsonString.trim();
    if (!trimmed) {
      setParsedData(null);
      setIsValidJson(false);
      setValidationError(null);
      resetDownstreamStates();
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed.origen_comunidad || !parsed.periodo_referencia || !Array.isArray(parsed.interacciones)) {
        setValidationError("Faltan campos del contrato SolicitudProcesamiento (origen_comunidad, periodo_referencia, interacciones)");
        setIsValidJson(false);
        setParsedData(null);
        resetDownstreamStates();
        return;
      }
      setValidationError(null);
      setIsValidJson(true);
      setParsedData(parsed);
    } catch (err: any) {
      setValidationError("Sintaxis JSON inválida: " + err.message);
      setIsValidJson(false);
      setParsedData(null);
      resetDownstreamStates();
    }
  }, [jsonString]);

  const resetDownstreamStates = () => {
    setAnalysisType(null);
    setPipelineResult(null);
    setHasRunAnalysis(false);
    setSelectedCardIndex(null);
    setPlatformCounts({ linkedin: 0, newsletter: 0, faq: 0, testimonios: 0 });
    setAllPublicationsByPlatform({ linkedin: [], newsletter: [], faq: [], testimonios: [] });
  };

  const handleLoadSample = (type: "official" | "empty") => {
    const data = type === "official" ? sampleOfficial : sampleEmpty;
    setJsonString(JSON.stringify(data, null, 2));
    showNotification(
      type === "official" ? "Caso Oficial cargado (3 interacciones)" : "Caso vacío cargado (para probar 0 respuestas)",
      "info"
    );
  };

  // Paso 2: Selección de modo
  const handleSelectAnalysisType = async (type: "auto" | "directed") => {
    setAnalysisType(type);
    setSelectedCardIndex(null);

    if (type === "auto") {
      await runAutomaticPipeline();
    } else {
      // Modo direccionado: desbloquea el paso 3 para selección manual
      setHasRunAnalysis(false);
      setAllPublicationsByPlatform({ linkedin: [], newsletter: [], faq: [], testimonios: [] });
      showNotification("Modo Direccionado activo: elige un formato oficial en el Paso 3", "info");
    }
  };

  // Ejecutar Pipeline Automático (Llamada al backend)
  const runAutomaticPipeline = async () => {
    if (!parsedData || isLoading) return;

    setIsLoading(true);
    setHasRunAnalysis(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 70000);

    try {
      const response = await fetch("/api/pipeline/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedData),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const json = await response.json();
      if (!json || !json.data) {
        throw new Error(json?.error || "Respuesta incompleta del servidor");
      }

      const result: ResultadoPipeline = json.data;
      setPipelineResult(result);

      // Clasificar candidatos y oportunidades según los contratos de Equipo B y C
      const categorized = processPipelineResultIntoCards(result);
      setAllPublicationsByPlatform(categorized);

      const counts = {
        linkedin: categorized.linkedin.length,
        newsletter: categorized.newsletter.length,
        faq: categorized.faq.length,
        testimonios: categorized.testimonios.length,
      };
      setPlatformCounts(counts);

      // Seleccionar automáticamente el primer formato que tenga respuestas
      const defaultPlatform: AssetCategoryKey =
        counts.linkedin > 0 ? "linkedin" : counts.newsletter > 0 ? "newsletter" : counts.faq > 0 ? "faq" : "linkedin";
      setActivePlatformFilter(defaultPlatform);

      if (categorized[defaultPlatform]?.length > 0) {
        setSelectedCardIndex(0);
      } else {
        setSelectedCardIndex(null);
      }

      showNotification(
        json.source === "fastapi" ? "Pipeline procesado por FastAPI backend exitosamente" : "Pipeline procesado (Modo Demostración)",
        "success"
      );
    } catch (err: any) {
      clearTimeout(timeoutId);
      const msg = err.name === "AbortError" ? "El procesamiento con IA tardó más de 70s" : err.message;
      showNotification("Error ejecutando pipeline: " + msg, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Convertir ResultadoPipeline del backend en tarjetas por formato oficial de Equipo C y B
  const processPipelineResultIntoCards = (result: ResultadoPipeline) => {
    const ln: PublicationCard[] = [];
    const nl: PublicationCard[] = [];
    const faq: PublicationCard[] = [];
    const ts: PublicationCard[] = [];

    if (!result || !Array.isArray(result.interacciones_procesadas)) {
      return { linkedin: [], newsletter: [], faq: [], testimonios: [] };
    }

    const items = result.interacciones_procesadas;

    for (const item of items) {
      const cat = item.oportunidad?.categoria;
      const score = item.oportunidad?.relevance_score;

      // Si fue descartado por baja relevancia
      if (cat === "IGNORE" || item.enrutamiento?.ruta === "flujo.descartar") {
        continue;
      }

      // 1. Candidatos generados oficiales de Equipo C (post_linkedin, destaque_newsletter_semanal, sugerencia_contenido_faq)
      for (const cand of item.activos_candidatos || []) {
        if (cand.tipo_activo === "post_linkedin" && ln.length < 5) {
          ln.push({
            id: cand.candidato_id,
            candidato_id: cand.candidato_id,
            tipo_activo: "post_linkedin",
            titulo: cand.contenido.titulo || "Post LinkedIn de Comunidad",
            enfoque: `post_linkedin`,
            contenido: cand.contenido.copy || item.analisis.resumen,
            plataforma: "linkedin",
            estado_aprobacion: cand.estado_aprobacion || "pendiente",
            relevance_score: score,
            autor_origen: item.interaccion.autor,
            detalles: {
              potencial_engagement: cand.contenido.potencial_engagement || "Medio-Alto",
              canal_recomendado: cand.contenido.canal_recomendado || "LinkedIn Oficial",
            },
          });
        }

        if (cand.tipo_activo === "destaque_newsletter_semanal" && nl.length < 5) {
          nl.push({
            id: cand.candidato_id,
            candidato_id: cand.candidato_id,
            tipo_activo: "destaque_newsletter_semanal",
            titulo: cand.contenido.titular || "Destaque Newsletter Semanal",
            enfoque: `destaque_newsletter_semanal`,
            contenido: cand.contenido.resumen || item.analisis.resumen,
            plataforma: "newsletter",
            estado_aprobacion: cand.estado_aprobacion || "pendiente",
            relevance_score: score,
            autor_origen: item.interaccion.autor,
            detalles: {
              seccion_newsletter: cand.contenido.seccion || "Historias de la Comunidad",
            },
          });
        }

        if (cand.tipo_activo === "sugerencia_contenido_faq" && faq.length < 5) {
          faq.push({
            id: cand.candidato_id,
            candidato_id: cand.candidato_id,
            tipo_activo: "sugerencia_contenido_faq",
            titulo: `FAQ: ${cand.contenido.tema || "Consulta Técnica"}`,
            enfoque: `sugerencia_contenido_faq`,
            contenido: `❓ **Pregunta / Tema:** ${cand.contenido.tema}\n📌 **Origen:** Canal ${item.interaccion.canal}\n💡 **Estado:** ${cand.contenido.status || "derivado_a_mentoria"}`,
            plataforma: "faq",
            estado_aprobacion: cand.estado_aprobacion || "pendiente",
            relevance_score: score,
            autor_origen: item.interaccion.autor,
            detalles: {
              tema_faq: cand.contenido.tema,
              status_faq: cand.contenido.status || "derivado_a_mentoria",
            },
          });
        }
      }

      // 2. Si Equipo B clasificó como SUCCESS_STORY o COMMUNITY_HIGHLIGHT, agregamos a Testimonios
      if ((cat === "SUCCESS_STORY" || cat === "COMMUNITY_HIGHLIGHT") && ts.length < 5) {
        ts.push({
          id: `ts_${item.interaccion.id}`,
          candidato_id: item.activos_candidatos?.[0]?.candidato_id,
          tipo_activo: "testimonio_comunidad",
          titulo: `Caso de Éxito: ${item.interaccion.autor}`,
          enfoque: `${cat}`,
          contenido: `💬 "${item.interaccion.texto}"\n\n👤 Autor: ${item.interaccion.autor}\n📍 Canal: ${item.interaccion.canal}\n🎯 Intención: ${item.analisis.intencion}`,
          plataforma: "testimonios",
          estado_aprobacion: "pendiente",
          relevance_score: score,
          autor_origen: item.interaccion.autor,
        });
      }
    }

    return {
      linkedin: ln,
      newsletter: nl,
      faq: faq,
      testimonios: ts,
    };
  };

  // Paso 3: Disparo en modo direccionado
  const handleTriggerDirectedAction = (platform: AssetCategoryKey) => {
    setActivePlatformFilter(platform);
    setIsLoading(true);
    setHasRunAnalysis(true);

    setTimeout(() => {
      setIsLoading(false);
      const items = parsedData?.interacciones || [];
      const hasContent = items.some((i) => i.texto && i.texto.length > 15 && !i.texto.includes("ok ok"));

      if (!hasContent) {
        setAllPublicationsByPlatform((prev) => ({ ...prev, [platform]: [] }));
        setSelectedCardIndex(null);
        showNotification(`0 candidatos encontrados para ${platform.toUpperCase()}`, "info");
        return;
      }

      // Generar candidatos según el formato oficial
      let generated: PublicationCard[] = [];
      const firstItem = items[0];

      if (platform === "linkedin") {
        generated = [
          {
            id: "dir_ln_1",
            candidato_id: "cand_ln_direct",
            tipo_activo: "post_linkedin",
            titulo: "Post Oficial de Empleabilidad",
            enfoque: "post_linkedin",
            contenido: `🎉 ¡Felicitaciones a ${firstItem.autor} por su logro en la comunidad!\n\n"${firstItem.texto}"\n\nHistorias que demuestran el poder de aprender y construir en equipo.\n\n#CommunityLab #TechCareers`,
            plataforma: "linkedin",
            estado_aprobacion: "pendiente",
            relevance_score: 92.0,
            detalles: {
              potencial_engagement: "Alto",
              canal_recomendado: "LinkedIn Oficial",
            },
          },
        ];
      } else if (platform === "newsletter") {
        generated = [
          {
            id: "dir_nl_1",
            candidato_id: "cand_nl_direct",
            tipo_activo: "destaque_newsletter_semanal",
            titulo: "Historias que Inspiran: Nuevo Empleo Tech",
            enfoque: "destaque_newsletter_semanal",
            contenido: `${firstItem.autor} compartió su historia tras culminar el proyecto del hackathon con el acompañamiento de mentores y compañeros.`,
            plataforma: "newsletter",
            estado_aprobacion: "pendiente",
            relevance_score: 88.0,
            detalles: {
              seccion_newsletter: "Historias de la Semana",
            },
          },
        ];
      } else if (platform === "faq") {
        generated = [
          {
            id: "dir_faq_1",
            candidato_id: "cand_faq_direct",
            tipo_activo: "sugerencia_contenido_faq",
            titulo: "FAQ: Despliegue en la Nube y Agentes",
            enfoque: "sugerencia_contenido_faq",
            contenido: `❓ **Pregunta / Tema:** Arquitectura y despliegue del pipeline\n📌 **Origen:** Consulta recurrente en canal de dudas\n💡 **Estado:** derivado_a_mentoria`,
            plataforma: "faq",
            estado_aprobacion: "pendiente",
            relevance_score: 80.0,
            detalles: {
              tema_faq: "Despliegue y Arquitectura",
              status_faq: "derivado_a_mentoria",
            },
          },
        ];
      } else {
        generated = [
          {
            id: "dir_ts_1",
            candidato_id: "cand_ts_direct",
            tipo_activo: "testimonio_comunidad",
            titulo: `Caso de Éxito: ${firstItem.autor}`,
            enfoque: "SUCCESS_STORY",
            contenido: `💬 "${firstItem.texto}" — ${firstItem.autor} (${firstItem.canal})`,
            plataforma: "testimonios",
            estado_aprobacion: "pendiente",
            relevance_score: 95.0,
          },
        ];
      }

      setAllPublicationsByPlatform((prev) => ({ ...prev, [platform]: generated }));
      setSelectedCardIndex(0);
      showNotification(`Candidatos para ${platform.toUpperCase()} listos`, "success");
    }, 600);
  };

  // Actualización HITL (Human-in-the-Loop)
  const handleUpdateApproval = async (index: number, newStatus: EstadoAprobacion) => {
    const cards = allPublicationsByPlatform[activePlatformFilter];
    const card = cards[index];
    if (!card) return;

    // Actualizar estado local inmediatamente
    const updatedCards = [...cards];
    updatedCards[index] = { ...card, estado_aprobacion: newStatus };
    setAllPublicationsByPlatform((prev) => ({
      ...prev,
      [activePlatformFilter]: updatedCards,
    }));

    // Si tiene candidato_id, sincronizar con el backend
    if (card.candidato_id) {
      try {
        await fetch(`/api/review/assets/${card.candidato_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estado_aprobacion: newStatus,
            contenido: {
              titulo: card.titulo,
              texto: card.contenido,
            },
          }),
        });
        showNotification(`Candidato marcado como ${newStatus.toUpperCase()} en HITL`, "success");
      } catch (err: any) {
        showNotification(`Error sincronizando aprobación: ${err.message}`, "error");
      }
    } else {
      showNotification(`Estado actualizado a ${newStatus.toUpperCase()}`, "info");
    }
  };

  // Edición HITL de contenido
  const handleUpdateContent = async (index: number, newContent: string) => {
    const cards = allPublicationsByPlatform[activePlatformFilter];
    const card = cards[index];
    if (!card) return;

    const updatedCards = [...cards];
    updatedCards[index] = { ...card, contenido: newContent };
    setAllPublicationsByPlatform((prev) => ({
      ...prev,
      [activePlatformFilter]: updatedCards,
    }));

    if (card.candidato_id) {
      try {
        await fetch(`/api/review/assets/${card.candidato_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estado_aprobacion: card.estado_aprobacion,
            contenido: {
              titulo: card.titulo,
              copy: newContent,
              resumen: newContent,
              texto: newContent,
            },
          }),
        });
        showNotification("Contenido editado y sincronizado con el backend", "success");
      } catch (err: any) {
        showNotification(`Error sincronizando edición: ${err.message}`, "error");
      }
    } else {
      showNotification("Contenido editado localmente", "info");
    }
  };

  const handleCardApprovedFromDispatch = (candidatoId: string) => {
    // Si se despachó desde la barra inferior, marcar como aprobado
    setAllPublicationsByPlatform((prev) => {
      const current = prev[activePlatformFilter] || [];
      return {
        ...prev,
        [activePlatformFilter]: current.map((c) =>
          c.candidato_id === candidatoId ? { ...c, estado_aprobacion: "aprobado" as EstadoAprobacion } : c
        ),
      };
    });
  };

  const currentCards = allPublicationsByPlatform[activePlatformFilter] || [];
  const currentSelectedCard =
    selectedCardIndex !== null && currentCards[selectedCardIndex]
      ? currentCards[selectedCardIndex]
      : null;

  return (
    <div className="min-h-screen p-3 md:p-6 flex flex-col justify-between">
      {/* Container Principal */}
      <div className="max-w-7xl mx-auto w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col flex-1">
        {/* Header con Logo y Estado */}
        <Header onLoadSample={handleLoadSample} />

        {/* Stepper horizontal */}
        <nav className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 text-xs text-slate-500 flex items-center gap-4 overflow-x-auto">
          <span className="font-semibold text-indigo-600 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white inline-flex items-center justify-center text-[10px]">
              1
            </span>
            Subir Solicitud JSON
          </span>
          <span className="text-slate-300">➔</span>
          <span
            className={`flex items-center gap-1.5 font-medium ${
              analysisType ? "text-indigo-600 font-semibold" : "text-slate-400"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${
                analysisType ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              2
            </span>
            Tipo de Análisis
          </span>
          <span className="text-slate-300">➔</span>
          <span
            className={`flex items-center gap-1.5 font-medium ${
              hasRunAnalysis ? "text-indigo-600 font-semibold" : "text-slate-400"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${
                hasRunAnalysis ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              3
            </span>
            Canales y Formatos
          </span>
          <span className="text-slate-300">➔</span>
          <span
            className={`flex items-center gap-1.5 font-medium ${
              currentCards.length > 0 ? "text-indigo-600 font-semibold" : "text-slate-400"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] ${
                currentCards.length > 0 ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              4
            </span>
            Propuestas & Revisión
          </span>
        </nav>

        {/* Layout Reorganizado en 2 Niveles: Configuración Arriba y Resultados Expansivos Abajo */}
        <main className="p-4 sm:p-6 md:p-8 flex flex-col gap-6 flex-1 bg-slate-50/50">
          {/* NIVEL 1: Carga de Datos y Elección de Canales (2 Columnas Amplias) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna Izquierda: Paso 1 (Conversaciones) (5 de 12) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
              <Step1JsonInput
                jsonString={jsonString}
                setJsonString={setJsonString}
                isValid={isValidJson}
                validationError={validationError}
                onValidDataChange={setParsedData}
              />
            </div>

            {/* Columna Derecha: Paso 2 y Paso 3 (7 de 12) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4">
              <Step2AnalysisType
                isStep1Valid={isValidJson}
                selectedType={analysisType}
                onSelectType={handleSelectAnalysisType}
                isLoading={isLoading}
              />

              <hr className="border-slate-100" />

              <Step3ActionBlock
                selectedType={analysisType}
                isLoading={isLoading}
                platformCounts={platformCounts}
                activePlatformFilter={activePlatformFilter}
                onSelectPlatformFilter={(p) => {
                  setActivePlatformFilter(p);
                  setSelectedCardIndex(allPublicationsByPlatform[p]?.length > 0 ? 0 : null);
                }}
                onTriggerDirectedAction={handleTriggerDirectedAction}
                onCancelLoading={() => {
                  setIsLoading(false);
                  showNotification("Espera cancelada", "info");
                }}
              />
            </div>
          </div>

          {/* NIVEL 2: Paso 4 (Resultados y Revisión Humana - Ancho Completo, Expansión hacia Abajo) */}
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col gap-5 w-full">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                  Paso 4: Propuestas de Publicación & Revisión Humana
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Revisa, edita con el lápiz (✏️) y aprueba las propuestas sugeridas antes de distribuirlas.
                </p>
              </div>
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full ${
                  !hasRunAnalysis
                    ? "bg-slate-100 text-slate-500"
                    : currentCards.length === 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {!hasRunAnalysis
                  ? "Esperando análisis"
                  : `${currentCards.length} ${
                      currentCards.length === 1 ? "propuesta lista" : "propuestas listas"
                    }`}
              </span>
            </div>

            <Step4ResultsList
              cards={currentCards}
              selectedCardIndex={selectedCardIndex}
              onSelectCard={setSelectedCardIndex}
              hasRunAnalysis={hasRunAnalysis}
              onUpdateApproval={handleUpdateApproval}
              onUpdateContent={handleUpdateContent}
            />

            {/* Barra de Publicación Integrada en la parte inferior */}
            {currentCards.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <SocialChannelBar
                  selectedCard={currentSelectedCard}
                  onNotification={showNotification}
                  onCardApproved={handleCardApprovedFromDispatch}
                />
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 transition duration-300 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50">
          <div
            className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs ${
              toast.type === "success"
                ? "bg-emerald-500"
                : toast.type === "error"
                ? "bg-rose-500"
                : "bg-indigo-500"
            }`}
          >
            {toast.type === "success" ? "✓" : toast.type === "error" ? "✕" : "ℹ"}
          </div>
          <p className="text-xs font-medium">{toast.msg}</p>
        </div>
      )}
    </div>
  );
}
