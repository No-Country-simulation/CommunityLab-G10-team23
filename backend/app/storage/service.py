"""Servicio de ensamblado y publicación del paquete final para OCI (Equipo D)."""

import threading
from collections import Counter
from typing import Any

from app.content.repository import revisores_del_lote
from app.contracts.enums import EstadoRespuesta, EstadoTrabajo
from app.contracts.models import (
    ActivosDistribucion,
    AlmacenamientoOCI,
    Autoria,
    RespuestaProcesamiento,
    ResultadoAnalisisInterno,
    ResultadoGeneracionInterno,
    ResumenComunidad,
    armar_respuesta_externa,
)
from app.schemas.internal import ResultadoPipelineItem
from app.storage.oci_storage import list_published_packages, upload_package
from app.workflow import repository as lotes


def calcular_resumen_comunidad(items: list[ResultadoPipelineItem]) -> ResumenComunidad:
    """Calcula el sentimiento predominante y los temas principales de un lote."""
    total = len(items)
    if total == 0:
        return ResumenComunidad(
            total_interacciones_procesadas=0,
            sentimiento_predominante="Neutral",
            temas_principales=[],
        )

    # Cálculo del sentimiento promedio
    scores = [item.analisis.sentimiento_score for item in items]
    avg_score = sum(scores) / total

    if avg_score >= 0.5:
        sentimiento_predominante = "Altamente Positivo"
    elif avg_score >= 0.15:
        sentimiento_predominante = "Positivo"
    elif avg_score <= -0.5:
        sentimiento_predominante = "Altamente Negativo"
    elif avg_score <= -0.15:
        sentimiento_predominante = "Negativo"
    else:
        sentimiento_predominante = "Neutral"

    # Frecuencia de temas
    temas_todos = []
    for item in items:
        temas_todos.extend(item.analisis.temas)

    conteo = Counter(temas_todos)
    # Seleccionar hasta los 5 temas más recurrentes
    temas_principales = [tema for tema, _ in conteo.most_common(5)]
    if not temas_principales and temas_todos:
        temas_principales = list(dict.fromkeys(temas_todos))[:5]

    return ResumenComunidad(
        total_interacciones_procesadas=total,
        sentimiento_predominante=sentimiento_predominante,
        temas_principales=temas_principales,
    )


class LoteNoPublicable(Exception):
    """El lote no se puede publicar todavía (sigue en proceso) o ya se publicó."""


# Una publicación a la vez: el número del paquete sale de contar los ya guardados
# (mismo supuesto de un único worker que app/workflow/jobs.py).
_publicacion_lock = threading.Lock()


def armar_paquete(
    items: list[ResultadoPipelineItem],
) -> tuple[ActivosDistribucion, ResumenComunidad]:
    """Aplica la regla oficial de selección sobre las decisiones de revisión ya guardadas.

    Solo cuentan los candidatos aprobados por una persona; los pendientes y rechazados
    no pasan a distribución.
    """
    analisis_internos: list[ResultadoAnalisisInterno] = []
    generacion_internos: list[ResultadoGeneracionInterno] = []
    for item in items:
        if item.oportunidad and item.enrutamiento:
            analisis_internos.append(
                ResultadoAnalisisInterno(
                    interaccion_id=item.interaccion.id,
                    analisis=item.analisis,
                    oportunidad=item.oportunidad,
                    enrutamiento=item.enrutamiento,
                )
            )
        generacion_internos.append(
            ResultadoGeneracionInterno(
                interaccion_id=item.interaccion.id,
                activos_candidatos=list(item.activos_candidatos),
            )
        )
    return armar_respuesta_externa(analisis_internos, generacion_internos), calcular_resumen_comunidad(items)


def publicar_lote(lote_id: str, autor: Autoria, *, client: Any | None = None) -> RespuestaProcesamiento:
    """Guarda en OCI el paquete final de un lote revisado y lo cierra para nuevas decisiones.

    Las decisiones se leen de app.db, nunca del cliente. El paquete lleva un bloque
    `auditoria` (interno) con quién procesó, quién revisó y quién publicó; la respuesta
    sigue siendo el contrato externo oficial `RespuestaProcesamiento`.
    """
    with _publicacion_lock:
        lote = lotes.obtener_lote(lote_id)
        if lote is None:
            raise KeyError(f"No existe el lote {lote_id}")
        if lote.publicado_por is not None:
            raise LoteNoPublicable(
                f"El lote ya lo publicó {lote.publicado_por.nombre} el {lote.publicado_por.en:%d/%m/%Y}"
            )
        if lote.estado in (EstadoTrabajo.en_cola, EstadoTrabajo.en_proceso):
            raise LoteNoPublicable("El lote todavía se está procesando; espera a que termine para publicarlo")

        items = lote.interacciones_procesadas
        activos_oficiales, resumen = armar_paquete(items)

        try:
            siguiente_numero = len(list_published_packages(client=client)) + 1
        except Exception:
            siguiente_numero = 1

        paquete = {
            "status": EstadoRespuesta.exito.value,
            "nombre_paquete": f"Paquete {siguiente_numero}",
            "periodo_referencia": lote.periodo_referencia,
            "origen_comunidad": lote.origen_comunidad,
            "fecha_guardado": autor.en.isoformat(),
            "auditoria": {
                "lote_id": lote_id,
                "procesado_por": lote.creado_por.model_dump(mode="json") if lote.creado_por else None,
                "publicado_por": autor.model_dump(mode="json"),
                "revisores": [r.model_dump(mode="json") for r in revisores_del_lote(lote_id)],
            },
            "resumen_comunidad": resumen.model_dump(mode="json"),
            "activos_distribucion_generados": activos_oficiales.model_dump(mode="json", exclude_none=True),
            "casos": [item.model_dump(mode="json") for item in items],
        }

        # activos/paquete_{N}/paquete-distribucion.json, igual que los paquetes anteriores.
        almacenamiento: AlmacenamientoOCI = upload_package(
            paquete,
            periodo_referencia=f"paquete_{siguiente_numero}",
            client=client,
        )
        lotes.marcar_publicado(lote_id, autor, almacenamiento.ruta_objeto)

    return RespuestaProcesamiento(
        status=EstadoRespuesta.exito,
        resumen_comunidad=resumen,
        activos_distribucion_generados=activos_oficiales,
        almacenamiento_oci=almacenamiento,
    )


__all__ = [
    "LoteNoPublicable",
    "armar_paquete",
    "calcular_resumen_comunidad",
    "publicar_lote",
]
