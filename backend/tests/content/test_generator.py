from app.contracts.enums import AssetCategory, EstadoAprobacion, TipoActivoOficial
from app.contracts.models import (
    AnalisisInterno,
    EnrutamientoInterno,
    OportunidadInterna,
    ResultadoAnalisisInterno,
)
from app.content.generator import generate_assets


class FakeStructuredLLM:
    def with_structured_output(self, _schema):
        return self

    def invoke(self, _messages):
        return {
            "post_linkedin": {
                "titulo": "Historia de la comunidad",
                "copy": "Una persona comparte un logro profesional.",
                "canal_recomendado": "LinkedIn Oficial",
                "potencial_engagement": "Alto",
            },
            "destaque_newsletter_semanal": {
                "seccion": "Logro de la Semana",
                "titular": "Un logro profesional de la comunidad",
                "resumen": "La comunidad comparte una historia positiva.",
            },
        }


def result_for(category, route="equipo_c.generar_activos"):
    analysis = AnalisisInterno(
        sentimiento="positivo",
        sentimiento_score=0.9,
        temas=["logro"],
        entidades=[],
        resumen="La persona comparte un logro profesional.",
        intencion="compartir_logro",
    )
    return ResultadoAnalisisInterno(
        interaccion_id="int_1",
        analisis=analysis,
        oportunidad=OportunidadInterna(
            categoria=category,
            relevance_score=90,
        ),
        enrutamiento=EnrutamientoInterno(ruta=route, motivo="Prueba"),
    )


def test_success_story_generates_official_assets():
    generated = generate_assets(result_for(AssetCategory.success_story), llm=FakeStructuredLLM())

    assert [asset.tipo_activo for asset in generated.activos_candidatos] == [
        TipoActivoOficial.post_linkedin,
        TipoActivoOficial.destaque_newsletter_semanal,
    ]
    assert all(
        asset.estado_aprobacion == EstadoAprobacion.pendiente
        for asset in generated.activos_candidatos
    )
    assert "potencial_engagement" in generated.activos_candidatos[0].contenido
    assert "titular" in generated.activos_candidatos[1].contenido


def test_support_alert_does_not_generate_public_assets():
    generated = generate_assets(
        result_for(AssetCategory.support_alert, "equipo_c.revision_prioritaria"),
        llm=FakeStructuredLLM(),
    )

    assert generated.activos_candidatos == []
