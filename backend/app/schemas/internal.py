"""Internal Team A–D contracts and the Team A batch response envelope."""

from app.contracts.models import (
    ActivoCandidato,
    AnalisisInterno,
    EnrutamientoInterno,
    InteraccionInterna,
    OportunidadInterna,
)
from pydantic import BaseModel, Field


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
    activos_candidatos: list[ActivoCandidato] = Field(default_factory=list)
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
