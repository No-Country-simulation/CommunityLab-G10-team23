"""Internal Team A–D contracts and the Team A batch response envelope."""

from app.contracts.models import AnalisisInterno, InteraccionInterna
from pydantic import BaseModel


class InteraccionProcesada(BaseModel):
    interaccion: InteraccionInterna
    analisis: AnalisisInterno
    degradado: bool = False


class RespuestaIngesta(BaseModel):
    origen_comunidad: str
    periodo_referencia: str
    interacciones_procesadas: list[InteraccionProcesada]


__all__ = [
    "AnalisisInterno",
    "InteraccionInterna",
    "InteraccionProcesada",
    "RespuestaIngesta",
]
