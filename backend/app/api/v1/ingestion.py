"""Team A endpoint for ingestion and per-interaction analysis."""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter

from app.ai.analyzer import analyze_interaction
from app.contracts.models import AnalisisInterno, InteraccionInterna
from app.schemas.external import SolicitudProcesamiento
from app.schemas.internal import InteraccionProcesada, RespuestaIngesta


router = APIRouter()


def _fallback_analysis() -> AnalisisInterno:
    """Return a valid neutral analysis when the LLM is unavailable for an item."""
    return AnalisisInterno(
        sentimiento="neutral",
        sentimiento_score=0.0,
        temas=[],
        entidades=[],
        resumen="Análisis no disponible; la interacción quedó pendiente de revisión.",
        intencion="sin_clasificar",
    )


@router.post("/process", response_model=RespuestaIngesta)
def process_interactions(request: SolicitudProcesamiento) -> RespuestaIngesta:
    processed: list[InteraccionProcesada] = []

    for incoming in request.interacciones:
        interaction = InteraccionInterna(
            id=f"int_{uuid4().hex}",
            autor=incoming.autor,
            canal=incoming.canal,
            tipo=incoming.tipo,
            texto=incoming.texto,
            timestamp=datetime.now(timezone.utc),
        )
        try:
            analysis = analyze_interaction(
                interaction,
                origen_comunidad=request.origen_comunidad,
                periodo_referencia=request.periodo_referencia,
            )
            degraded = False
        except Exception:
            # One failed interaction must not prevent the rest of the batch from running.
            analysis = _fallback_analysis()
            degraded = True

        processed.append(
            InteraccionProcesada(
                interaccion=interaction,
                analisis=analysis,
                degradado=degraded,
            )
        )

    return RespuestaIngesta(
        origen_comunidad=request.origen_comunidad,
        periodo_referencia=request.periodo_referencia,
        interacciones_procesadas=processed,
    )


__all__ = ["router", "process_interactions"]
