from app.contracts.enums import AssetCategory

from .classifier import classify_analysis
from .models import AnalisisInterno


_INTENTION_POINTS = {
    "compartir_logro": 30.0,
    "celebrar_logro": 30.0,
    "solicitar_ejemplo": 24.0,
    "aprender": 24.0,
    "solicitar_ayuda": 20.0,
    "reportar_problema": 20.0,
    "pedir_soporte": 20.0,
}


def calculate_relevance_score(
    analysis: AnalisisInterno,
    category: AssetCategory | None = None,
) -> float:
    """Calcula un score reproducible entre 0 y 100.

    Formula: intencion (30) + temas (25) + entidades (20) + resumen (15)
    + sentimiento (10). El score de IGNORE queda limitado a 20.
    """
    category = category or classify_analysis(analysis)
    intention_points = _INTENTION_POINTS.get(analysis.intencion.lower().strip(), 0.0)
    topic_points = min(len(analysis.temas), 2) / 2 * 25
    entity_points = min(len(analysis.entidades), 2) / 2 * 20
    summary_points = 15.0 if len(analysis.resumen.strip()) >= 20 else 0.0

    if category in {AssetCategory.success_story, AssetCategory.community_highlight}:
        sentiment_points = max(0.0, analysis.sentimiento_score) * 10
    elif category == AssetCategory.support_alert:
        sentiment_points = min(1.0, abs(analysis.sentimiento_score)) * 10
    else:
        sentiment_points = (1.0 - abs(analysis.sentimiento_score)) * 5

    score = intention_points + topic_points + entity_points + summary_points + sentiment_points
    score = min(score, 20.0) if category == AssetCategory.ignore else score
    return round(min(max(score, 0.0), 100.0), 2)


__all__ = ["calculate_relevance_score"]
