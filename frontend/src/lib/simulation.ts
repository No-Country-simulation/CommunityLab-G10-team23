import { SolicitudProcesamiento, ResultadoPipeline } from "@/types/backend";

// Resultado simulado para el modo demostración cuando el backend no está disponible.
export function generateSimulatedPipeline(request: SolicitudProcesamiento): ResultadoPipeline {
  const items = request.interacciones || [];
  
  const processed = items.map((item, idx) => {
    const text = item.texto || "";
    const isSuccess = text.toLowerCase().includes("empleo") || text.toLowerCase().includes("seleccionada") || text.toLowerCase().includes("logro") || text.toLowerCase().includes("felicitaciones");
    const isQuestion = text.includes("?") || text.toLowerCase().includes("cómo") || text.toLowerCase().includes("duda");
    const isJunk = text.length < 15 || text.toLowerCase().includes("spam") || text.toLowerCase().includes("ok ok");
    const isSupport = text.toLowerCase().includes("no puedo acceder") || text.toLowerCase().includes("error");

    if (isSupport && !isJunk) {
      return {
        interaccion: {
          id: `int_${idx}_sim`,
          autor: item.autor,
          canal: item.canal,
          tipo: item.tipo,
          texto: item.texto,
          timestamp: new Date().toISOString(),
        },
        analisis: {
          sentimiento: "negativo",
          sentimiento_score: -0.6,
          temas: ["acceso", "plataforma"],
          entidades: [],
          resumen: `${item.autor} reporta un problema de acceso que bloquea su avance.`,
          intencion: "reportar_problema",
        },
        oportunidad: {
          categoria: "SUPPORT_ALERT" as const,
          relevance_score: 70.0,
        },
        enrutamiento: {
          ruta: "equipo_c.revision_prioritaria",
          motivo: "La interacción requiere atención antes de generar contenido.",
        },
        activos_candidatos: [],
      };
    }

    if (isJunk) {
      return {
        interaccion: {
          id: `int_${idx}_sim`,
          autor: item.autor,
          canal: item.canal,
          tipo: item.tipo,
          texto: item.texto,
          timestamp: new Date().toISOString(),
        },
        analisis: {
          sentimiento: "neutral",
          sentimiento_score: 0.0,
          temas: ["otros"],
          entidades: [],
          resumen: "Texto breve o no categorizable.",
          intencion: "descarte",
        },
        oportunidad: {
          categoria: "IGNORE" as const,
          relevance_score: 10.0,
        },
        enrutamiento: {
          ruta: "flujo.descartar",
          motivo: "Baja relevancia semántica",
        },
        activos_candidatos: [],
      };
    }

    if (isSuccess) {
      return {
        interaccion: {
          id: `int_${idx}_sim`,
          autor: item.autor,
          canal: item.canal,
          tipo: item.tipo,
          texto: item.texto,
          timestamp: new Date().toISOString(),
        },
        analisis: {
          sentimiento: "positivo",
          sentimiento_score: 0.95,
          temas: ["empleabilidad", "hackathon", "comunidad"],
          entidades: ["CommunityLab", "OCI"],
          resumen: `Logro compartido por ${item.autor} sobre éxito profesional.`,
          intencion: "compartir_logro",
        },
        oportunidad: {
          categoria: "SUCCESS_STORY" as const,
          relevance_score: 95.0,
        },
        enrutamiento: {
          ruta: "equipo_c.generar_activos",
          motivo: "Alta relevancia para historia de éxito",
        },
        activos_candidatos: [
          {
            candidato_id: `cand_ln_${idx}`,
            tipo_activo: "post_linkedin" as const,
            contenido: {
              titulo: `De la comunidad al empleo tech: Caso ${item.autor}`,
              copy: `🎉 ¡Felicitaciones a ${item.autor}!\n\n"${item.texto}"\n\nHistorias como esta demuestran el poder de aprender y construir proyectos reales en comunidad. ¡Vamos por más!\n\n#CommunityLab #TechCareers #LogroTech`,
              canal_recomendado: "LinkedIn Oficial",
              potencial_engagement: "Alto",
            },
            estado_aprobacion: "pendiente" as const,
          },
          {
            candidato_id: `cand_news_${idx}`,
            tipo_activo: "destaque_newsletter_semanal" as const,
            contenido: {
              seccion: "Historias de la Comunidad",
              titular: `${item.autor} comparte su primer empleo tech`,
              resumen: item.texto,
            },
            estado_aprobacion: "pendiente" as const,
          },
        ],
      };
    }

    if (isQuestion) {
      return {
        interaccion: {
          id: `int_${idx}_sim`,
          autor: item.autor,
          canal: item.canal,
          tipo: item.tipo,
          texto: item.texto,
          timestamp: new Date().toISOString(),
        },
        analisis: {
          sentimiento: "neutral",
          sentimiento_score: 0.1,
          temas: ["despliegue", "FastAPI", "OCI"],
          entidades: ["FastAPI", "LangGraph"],
          resumen: `Consulta técnica planteada por ${item.autor} sobre arquitectura.`,
          intencion: "solicitar_ayuda",
        },
        oportunidad: {
          categoria: "FAQ" as const,
          relevance_score: 82.0,
        },
        enrutamiento: {
          ruta: "equipo_c.generar_activos",
          motivo: "Duda recurrente con potencial de FAQ técnica",
        },
        activos_candidatos: [
          {
            candidato_id: `cand_faq_${idx}`,
            tipo_activo: "sugerencia_contenido_faq" as const,
            contenido: {
              tema: "Despliegue de FastAPI y LangGraph",
              origen: item.canal,
              status: "derivado_a_mentoria",
            },
            estado_aprobacion: "pendiente" as const,
          },
        ],
      };
    }

    // Default: social post
    return {
      interaccion: {
        id: `int_${idx}_sim`,
        autor: item.autor,
        canal: item.canal,
        tipo: item.tipo,
        texto: item.texto,
        timestamp: new Date().toISOString(),
      },
      analisis: {
        sentimiento: "positivo",
        sentimiento_score: 0.8,
        temas: ["comunidad", "innovación"],
        entidades: ["CommunityLab"],
        resumen: item.texto,
        intencion: "comunicado",
      },
      oportunidad: {
        categoria: "COMMUNITY_HIGHLIGHT" as const,
        relevance_score: 88.0,
      },
      enrutamiento: {
        ruta: "equipo_c.generar_activos",
        motivo: "Destaque de comunidad para difusión en redes",
      },
      activos_candidatos: [
        {
          candidato_id: `cand_comm_${idx}`,
          tipo_activo: "post_linkedin" as const,
          contenido: {
            titulo: "Actualización y Hitos de la Comunidad",
            copy: `🚀 Novedades en Community Lab:\n\n${item.texto}\n\n¡Gracias a todos los que hacen posible este espacio colaborativo!\n\n#CommunityLab #Innovacion`,
            canal_recomendado: "LinkedIn Oficial",
            potencial_engagement: "Medio-Alto",
          },
          estado_aprobacion: "pendiente" as const,
        },
      ],
    };
  });

  return {
    origen_comunidad: request.origen_comunidad || "CommunityLab",
    periodo_referencia: request.periodo_referencia || "Semana_04",
    interacciones_procesadas: processed,
  };
}
