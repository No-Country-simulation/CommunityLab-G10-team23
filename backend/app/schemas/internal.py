"""Internal Team A–D contracts and the Team A batch response envelope."""

from app.contracts.enums import EstadoTrabajo
from app.contracts.models import (
    ActivoCandidato,
    Autoria,
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


class TrabajoPipeline(BaseModel):
    """Estado de un lote procesado en segundo plano, interacción por interacción."""

    job_id: str
    estado: EstadoTrabajo
    origen_comunidad: str
    periodo_referencia: str
    total: int
    procesadas: int
    # Índice de la primera interacción incluida (para pedir solo las nuevas).
    desde: int = 0
    interacciones_procesadas: list[ResultadoPipelineItem] = Field(default_factory=list)
    error: str | None = None
    # Lotes del equipo: quién subió el lote y, si ya se guardó en la nube, quién lo publicó.
    creado_por: Autoria | None = None
    publicado_por: Autoria | None = None


class ResumenLote(BaseModel):
    """Fila del listado de lotes del equipo (sin las interacciones)."""

    job_id: str
    estado: EstadoTrabajo
    origen_comunidad: str
    periodo_referencia: str
    total: int
    procesadas: int
    creado_por: Autoria
    publicado_por: Autoria | None = None
    activos_pendientes: int = 0
    activos_aprobados: int = 0
    activos_rechazados: int = 0


__all__ = [
    "AnalisisInterno",
    "InteraccionInterna",
    "InteraccionProcesada",
    "RespuestaIngesta",
    "ResultadoPipelineItem",
    "ResultadoPipeline",
    "TrabajoPipeline",
    "ResumenLote",
]
