from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from .enums import (
    AssetCategory,
    EstadoAlmacenamientoOCI,
    EstadoAprobacion,
    EstadoRespuesta,
    TipoActivoOficial,
)


# Contrato externo: entrada oficial del endpoint /process.


class InteraccionEntrada(BaseModel):
    autor: str
    canal: str
    tipo: str
    texto: str


class SolicitudProcesamiento(BaseModel):
    origen_comunidad: str
    periodo_referencia: str
    interacciones: list[InteraccionEntrada] = Field(max_length=500)


# Contrato externo: respuesta oficial del endpoint /process.


class ResumenComunidad(BaseModel):
    total_interacciones_procesadas: int
    sentimiento_predominante: str
    temas_principales: list[str]


class PostLinkedIn(BaseModel):
    titulo: str
    copy: str
    canal_recomendado: str = "LinkedIn Oficial"
    potencial_engagement: str


class DestaqueNewsletter(BaseModel):
    seccion: str
    titular: str
    resumen: str


class SugerenciaFAQ(BaseModel):
    tema: str
    origen: str
    status: str = "derivado_a_mentoria"


class ActivosDistribucion(BaseModel):
    post_linkedin: PostLinkedIn | None = None
    destaque_newsletter_semanal: DestaqueNewsletter | None = None
    sugerencia_contenido_faq: SugerenciaFAQ | None = None


class AlmacenamientoOCI(BaseModel):
    bucket: str
    ruta_objeto: str
    status: EstadoAlmacenamientoOCI


class RespuestaProcesamiento(BaseModel):
    status: EstadoRespuesta
    resumen_comunidad: ResumenComunidad
    activos_distribucion_generados: ActivosDistribucion
    almacenamiento_oci: AlmacenamientoOCI


# Contrato interno: comunicación entre los cuatro equipos.


class InteraccionInterna(BaseModel):
    id: str
    autor: str
    canal: str
    tipo: str
    texto: str
    timestamp: datetime


class AnalisisInterno(BaseModel):
    sentimiento: str
    sentimiento_score: float = Field(ge=-1.0, le=1.0)
    temas: list[str]
    entidades: list[str]
    resumen: str
    intencion: str


class OportunidadInterna(BaseModel):
    categoria: AssetCategory
    relevance_score: float = Field(ge=0.0, le=100.0)


class EnrutamientoInterno(BaseModel):
    ruta: str
    motivo: str


class ResultadoAnalisisInterno(BaseModel):
    interaccion_id: str
    analisis: AnalisisInterno
    oportunidad: OportunidadInterna
    enrutamiento: EnrutamientoInterno


class ActivoCandidato(BaseModel):
    tipo_activo: TipoActivoOficial
    contenido: dict[str, Any]
    estado_aprobacion: EstadoAprobacion = EstadoAprobacion.pendiente


class ResultadoGeneracionInterno(BaseModel):
    interaccion_id: str
    activos_candidatos: list[ActivoCandidato]


def armar_respuesta_externa(
    resultados_analisis: list[ResultadoAnalisisInterno],
    resultados_generacion: list[ResultadoGeneracionInterno],
) -> ActivosDistribucion:
    """Elige el candidato aprobado de mayor score para cada clave oficial."""
    scores = {
        resultado.interaccion_id: resultado.oportunidad.relevance_score
        for resultado in resultados_analisis
    }
    candidatos_por_tipo: dict[TipoActivoOficial, list[tuple[float, ActivoCandidato]]] = {}

    for resultado in resultados_generacion:
        score = scores.get(resultado.interaccion_id, 0.0)
        for candidato in resultado.activos_candidatos:
            if candidato.estado_aprobacion != EstadoAprobacion.aprobado:
                continue
            candidatos_por_tipo.setdefault(candidato.tipo_activo, []).append(
                (score, candidato)
            )

    def ganador(tipo: TipoActivoOficial) -> dict[str, Any] | None:
        opciones = candidatos_por_tipo.get(tipo, [])
        if not opciones:
            return None
        return max(opciones, key=lambda opcion: opcion[0])[1].contenido

    return ActivosDistribucion(
        post_linkedin=ganador(TipoActivoOficial.post_linkedin),
        destaque_newsletter_semanal=ganador(
            TipoActivoOficial.destaque_newsletter_semanal
        ),
        sugerencia_contenido_faq=ganador(
            TipoActivoOficial.sugerencia_contenido_faq
        ),
    )


__all__ = [
    "InteraccionEntrada",
    "SolicitudProcesamiento",
    "ResumenComunidad",
    "PostLinkedIn",
    "DestaqueNewsletter",
    "SugerenciaFAQ",
    "ActivosDistribucion",
    "AlmacenamientoOCI",
    "RespuestaProcesamiento",
    "InteraccionInterna",
    "AnalisisInterno",
    "OportunidadInterna",
    "EnrutamientoInterno",
    "ResultadoAnalisisInterno",
    "ActivoCandidato",
    "ResultadoGeneracionInterno",
    "armar_respuesta_externa",
]
