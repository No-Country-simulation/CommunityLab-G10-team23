from typing import Any, Callable, TypedDict

from langgraph.graph import END, START, StateGraph

from app.contracts.enums import AssetCategory
from app.contracts.models import (
    AnalisisInterno,
    EnrutamientoInterno,
    OportunidadInterna,
    ResultadoAnalisisInterno,
)
from app.intelligence.classifier import classify_analysis
from app.intelligence.llm_classifier import PropuestaClasificacion, classify_with_llm
from app.intelligence.scorer import calculate_relevance_score


CONFIDENCE_THRESHOLD = 0.75
MAX_LLM_ATTEMPTS = 2


class ClassificationState(TypedDict, total=False):
    interaccion_id: str
    analisis: AnalisisInterno
    propuesta: PropuestaClasificacion
    oportunidad: OportunidadInterna
    enrutamiento: EnrutamientoInterno
    resultado: ResultadoAnalisisInterno
    intentos: int
    error: str


def _classify_node(state: ClassificationState, classifier: Any) -> dict:
    attempts = state.get("intentos", 0) + 1
    try:
        proposal = classify_with_llm(classifier, state["analisis"])
        return {"propuesta": proposal, "intentos": attempts, "error": ""}
    except Exception as error:
        return {"intentos": attempts, "error": str(error)}


def _fallback_node(state: ClassificationState) -> dict:
    category = classify_analysis(state["analisis"])
    return {
        "propuesta": PropuestaClasificacion(
            categoria=category,
            confianza=0.0,
            justificacion="Fallback determinista porque el clasificador LLM no estuvo disponible.",
        ),
        "error": state.get("error", ""),
    }


def _score_node(state: ClassificationState) -> dict:
    proposal = state["propuesta"]
    category = proposal.categoria
    if proposal.confianza < CONFIDENCE_THRESHOLD:
        category = classify_analysis(state["analisis"])

    return {
        "oportunidad": OportunidadInterna(
            categoria=category,
            relevance_score=calculate_relevance_score(state["analisis"], category),
        )
    }


def _route_node(state: ClassificationState) -> dict:
    category = state["oportunidad"].categoria
    routes = {
        AssetCategory.support_alert: (
            "equipo_c.revision_prioritaria",
            "La interacción requiere atención antes de generar contenido.",
        ),
        AssetCategory.ignore: (
            "flujo.descartar",
            "No se detectó una oportunidad relevante.",
        ),
    }
    route, reason = routes.get(
        category,
        ("equipo_c.generar_activos", "La interacción tiene potencial de contenido."),
    )
    result = ResultadoAnalisisInterno(
        interaccion_id=state["interaccion_id"],
        analisis=state["analisis"],
        oportunidad=state["oportunidad"],
        enrutamiento=EnrutamientoInterno(ruta=route, motivo=reason),
    )
    return {"enrutamiento": result.enrutamiento, "resultado": result}


def _after_classification(state: ClassificationState) -> str:
    if state.get("propuesta") is not None:
        return "score"
    if state.get("intentos", 0) < MAX_LLM_ATTEMPTS:
        return "retry"
    return "fallback"


def build_classification_graph(classifier: Callable) :
    """Construye el grafo C: LLM, reintento, fallback, score y ruta."""
    graph = StateGraph(ClassificationState)
    graph.add_node("classify", lambda state: _classify_node(state, classifier))
    graph.add_node("fallback", _fallback_node)
    graph.add_node("score", _score_node)
    graph.add_node("route", _route_node)
    graph.add_edge(START, "classify")
    graph.add_conditional_edges(
        "classify",
        _after_classification,
        {"retry": "classify", "fallback": "fallback", "score": "score"},
    )
    graph.add_edge("fallback", "score")
    graph.add_edge("score", "route")
    graph.add_edge("route", END)
    return graph.compile()


__all__ = [
    "CONFIDENCE_THRESHOLD",
    "MAX_LLM_ATTEMPTS",
    "ClassificationState",
    "build_classification_graph",
]
