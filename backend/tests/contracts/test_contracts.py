from app.contracts import (
    ActivoCandidato,
    AnalisisInterno,
    AssetCategory,
    EstadoAprobacion,
    EnrutamientoInterno,
    InteraccionEntrada,
    OportunidadInterna,
    ResultadoAnalisisInterno,
    ResultadoGeneracionInterno,
    SolicitudProcesamiento,
    TipoActivoOficial,
    armar_respuesta_externa,
)


def test_external_input_and_internal_analysis_contracts():
    request = SolicitudProcesamiento(
        origen_comunidad="Discord_Grupo_ONE_G10",
        periodo_referencia="Semana_04",
        interacciones=[
            InteraccionEntrada(
                autor="Mariana Souza",
                canal="#logros-y-empleos",
                tipo="testimonio",
                texto="Consegui mi primer empleo.",
            )
        ],
    )
    result = ResultadoAnalisisInterno(
        interaccion_id="int_9f2a",
        analisis=AnalisisInterno(
            sentimiento="positivo",
            sentimiento_score=0.92,
            temas=["contratacion", "portfolio"],
            entidades=["OCI"],
            resumen="Egresada consigue empleo gracias a su proyecto.",
            intencion="compartir_logro",
        ),
        oportunidad=OportunidadInterna(
            categoria=AssetCategory.success_story,
            relevance_score=91.0,
        ),
        enrutamiento=EnrutamientoInterno(
            ruta="equipo_c.generar_activos",
            motivo="Historia de exito con alto potencial.",
        ),
    )

    assert request.interacciones[0].autor == "Mariana Souza"
    assert result.oportunidad.categoria.value == "SUCCESS_STORY"


def test_team_d_selects_highest_score_and_omits_empty_keys():
    analysis = ResultadoAnalisisInterno(
        interaccion_id="int_1",
        analisis=AnalisisInterno(
            sentimiento="positivo",
            sentimiento_score=0.9,
            temas=["logro"],
            entidades=["OCI"],
            resumen="La persona logro su objetivo.",
            intencion="compartir_logro",
        ),
        oportunidad=OportunidadInterna(
            categoria=AssetCategory.success_story,
            relevance_score=91.0,
        ),
        enrutamiento=EnrutamientoInterno(
            ruta="equipo_c.generar_activos",
            motivo="Contenido de exito.",
        ),
    )
    generated = ResultadoGeneracionInterno(
        interaccion_id="int_1",
        activos_candidatos=[
            ActivoCandidato(
                tipo_activo=TipoActivoOficial.post_linkedin,
                contenido={
                    "titulo": "Historia",
                    "copy": "Texto",
                    "canal_recomendado": "LinkedIn Oficial",
                    "potencial_engagement": "Alto",
                },
                estado_aprobacion=EstadoAprobacion.aprobado,
            )
        ],
    )

    assets = armar_respuesta_externa([analysis], [generated])
    serialized = assets.model_dump(mode="json", exclude_none=True)

    assert serialized["post_linkedin"]["titulo"] == "Historia"
    assert "destaque_newsletter_semanal" not in serialized
    assert "sugerencia_contenido_faq" not in serialized
