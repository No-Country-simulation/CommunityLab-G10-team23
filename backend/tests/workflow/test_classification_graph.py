from app.contracts.enums import AssetCategory
from app.contracts.models import AnalisisInterno
from app.intelligence.llm_classifier import PropuestaClasificacion
from app.workflow.classification_graph import build_classification_graph


def sample_analysis() -> AnalisisInterno:
    return AnalisisInterno(
        sentimiento="positivo",
        sentimiento_score=0.92,
        temas=["contratacion", "LangChain"],
        entidades=["LangChain"],
        resumen="Egresada consigue empleo gracias a un proyecto.",
        intencion="compartir_logro",
    )


class FakeClassifier:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = 0

    def invoke(self, _input):
        self.calls += 1
        response = next(self.responses)
        if isinstance(response, Exception):
            raise response
        return response


def test_graph_accepts_valid_llm_category():
    classifier = FakeClassifier(
        [
            {
                "categoria": "SUCCESS_STORY",
                "confianza": 0.94,
                "justificacion": "Logro profesional concreto.",
            }
        ]
    )

    result = build_classification_graph(classifier).invoke(
        {"interaccion_id": "int_1", "analisis": sample_analysis()}
    )

    assert classifier.calls == 1
    assert result["resultado"].oportunidad.categoria == AssetCategory.success_story
    assert result["resultado"].enrutamiento.ruta == "equipo_c.generar_activos"


def test_graph_uses_deterministic_fallback_after_retry():
    classifier = FakeClassifier([RuntimeError("LLM no disponible"), RuntimeError("timeout")])

    result = build_classification_graph(classifier).invoke(
        {"interaccion_id": "int_2", "analisis": sample_analysis()}
    )

    assert classifier.calls == 2
    assert result["resultado"].oportunidad.categoria == AssetCategory.success_story
    assert result["resultado"].oportunidad.relevance_score > 0


def test_graph_falls_back_when_confidence_is_low():
    classifier = FakeClassifier(
        [
            PropuestaClasificacion(
                categoria=AssetCategory.ignore,
                confianza=0.30,
                justificacion="Mensaje ambiguo.",
            )
        ]
    )

    result = build_classification_graph(classifier).invoke(
        {"interaccion_id": "int_3", "analisis": sample_analysis()}
    )

    assert result["resultado"].oportunidad.categoria == AssetCategory.success_story
