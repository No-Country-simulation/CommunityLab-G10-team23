from datetime import datetime, timezone
from typing import Any, Callable, Iterator
from uuid import uuid4

from app.ai.analyzer import analyze_interaction
from app.content.generator import generate_assets
from app.content.repository import upsert_generation_result
from app.contracts.models import (
    AnalisisInterno,
    InteraccionInterna,
    SolicitudProcesamiento,
)
from app.intelligence.llm_classifier import create_llm_classifier
from app.schemas.internal import (
    InteraccionProcesada,
    ResultadoPipeline,
    ResultadoPipelineItem,
)

from .classification_graph import build_classification_graph


def _fallback_analysis() -> AnalisisInterno:
    return AnalisisInterno(
        sentimiento="neutral",
        sentimiento_score=0.0,
        temas=[],
        entidades=[],
        resumen="Analisis no disponible; la interaccion quedo pendiente de revision.",
        intencion="sin_clasificar",
    )


def iter_batch(
    request: SolicitudProcesamiento,
    *,
    classifier: Any | None = None,
    asset_generator: Callable | None = None,
) -> Iterator[ResultadoPipelineItem]:
    """Orquesta Equipos A, B y C interacción por interacción, entregando cada resultado al terminarlo."""
    classifier = classifier or create_llm_classifier()
    graph = build_classification_graph(classifier)

    for incoming in request.interacciones:
        interaction = InteraccionInterna(
            id=f"int_{uuid4().hex}",
            autor=incoming.autor,
            canal=incoming.canal,
            tipo=incoming.tipo,
            texto=incoming.texto,
            timestamp=datetime.now(timezone.utc),
        )
        degraded = False
        error: str | None = None

        try:
            analysis = analyze_interaction(
                interaction,
                origen_comunidad=request.origen_comunidad,
                periodo_referencia=request.periodo_referencia,
            )
        except Exception as analysis_error:
            analysis = _fallback_analysis()
            degraded = True
            error = f"Equipo A: {analysis_error}"

        team_b_result = None
        generated = None
        try:
            graph_result = graph.invoke(
                {
                    "interaccion_id": interaction.id,
                    "analisis": analysis,
                }
            )
            team_b_result = graph_result["resultado"]
        except Exception as classification_error:
            error = _combine_errors(error, f"Equipo B: {classification_error}")

        if team_b_result is not None:
            try:
                generated = (asset_generator or generate_assets)(team_b_result)
                if generated.activos_candidatos:
                    upsert_generation_result(generated)
            except Exception as content_error:
                error = _combine_errors(error, f"Equipo C: {content_error}")

        yield ResultadoPipelineItem(
            interaccion=interaction,
            analisis=analysis,
            degradado=degraded,
            oportunidad=(team_b_result.oportunidad if team_b_result else None),
            enrutamiento=(team_b_result.enrutamiento if team_b_result else None),
            activos_candidatos=(generated.activos_candidatos if generated else []),
            error=error,
        )


def process_batch(
    request: SolicitudProcesamiento,
    *,
    classifier: Any | None = None,
    asset_generator: Callable | None = None,
) -> ResultadoPipeline:
    """Procesa el lote completo de forma síncrona."""
    return ResultadoPipeline(
        origen_comunidad=request.origen_comunidad,
        periodo_referencia=request.periodo_referencia,
        interacciones_procesadas=list(
            iter_batch(request, classifier=classifier, asset_generator=asset_generator)
        ),
    )


def _combine_errors(previous: str | None, current: str) -> str:
    if previous is None:
        return current
    return f"{previous}; {current}"


__all__ = ["iter_batch", "process_batch"]
