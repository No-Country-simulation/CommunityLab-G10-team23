from unittest.mock import patch

from app.contracts.enums import AssetCategory
from app.contracts.models import AnalisisInterno, SolicitudProcesamiento
from app.workflow.pipeline import process_batch


class FakeClassifier:
    def invoke(self, _input):
        return {
            "categoria": "SUCCESS_STORY",
            "confianza": 0.95,
            "justificacion": "La interacción describe un logro.",
        }


def test_pipeline_passes_each_team_a_analysis_to_team_b():
    request = SolicitudProcesamiento(
        origen_comunidad="Discord",
        periodo_referencia="Semana_04",
        interacciones=[
            {
                "autor": "Mariana",
                "canal": "#logros",
                "tipo": "testimonio",
                "texto": "Consegui empleo.",
            },
            {
                "autor": "Lucas",
                "canal": "#dudas",
                "tipo": "pregunta",
                "texto": "Tengo una duda tecnica.",
            },
        ],
    )
    analyses = [
        AnalisisInterno(
            sentimiento="positivo",
            sentimiento_score=0.9,
            temas=["contratacion"],
            entidades=["OCI"],
            resumen="La persona consiguio empleo gracias a un proyecto.",
            intencion="compartir_logro",
        ),
        AnalisisInterno(
            sentimiento="neutral",
            sentimiento_score=0.0,
            temas=["LangGraph"],
            entidades=["LangGraph"],
            resumen="Pregunta tecnica sobre LangGraph.",
            intencion="solicitar_ejemplo",
        ),
    ]

    with patch(
        "app.workflow.pipeline.analyze_interaction",
        side_effect=analyses,
    ):
        result = process_batch(request, classifier=FakeClassifier())

    assert len(result.interacciones_procesadas) == 2
    assert all(item.degradado is False for item in result.interacciones_procesadas)
    assert all(item.oportunidad is not None for item in result.interacciones_procesadas)
    assert result.interacciones_procesadas[0].oportunidad.categoria == (
        AssetCategory.success_story
    )
    assert result.interacciones_procesadas[0].interaccion.id.startswith("int_")
