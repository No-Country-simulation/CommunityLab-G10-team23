"""Internal Team A–D contracts and the Team A batch response envelope."""

from app.contracts.models import (
    AnalisisInterno,
    EnrutamientoInterno,
    InteraccionInterna,
    OportunidadInterna,
)
from pydantic import BaseModel


class InteraccionProcesada(BaseModel):
    interaccion: InteraccionInterna
    analisis: AnalisisInterno
    degradado: bool = False


class RespuestaIngesta(BaseModel):
    origen_comunidad: str
    periodo_referencia: str
    interacciones_procesadas: list[InteraccionProcesada]


class ResultadoPipelineItem(InteraccionProcesada):
    oportunidad: OportunidadInterna | None = None
    enrutamiento: EnrutamientoInterno | None = None
    error: str | None = None


class ResultadoPipeline(BaseModel):
    origen_comunidad: str
    periodo_referencia: str
    interacciones_procesadas: list[ResultadoPipelineItem]


__all__ = [
    "AnalisisInterno",
    "InteraccionInterna",
    "InteraccionProcesada",
    "RespuestaIngesta",
    "ResultadoPipelineItem",
    "ResultadoPipeline",
]
