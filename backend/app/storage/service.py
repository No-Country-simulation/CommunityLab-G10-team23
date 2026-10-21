"""Servicio de ensamblado y publicación del paquete final para OCI (Equipo D)."""

from collections import Counter
from typing import Any

from app.contracts.enums import EstadoAprobacion, EstadoRespuesta
from app.contracts.models import (
    ActivosDistribucion,
    AlmacenamientoOCI,
    RespuestaProcesamiento,
    ResultadoAnalisisInterno,
    ResultadoGeneracionInterno,
    ResumenComunidad,
    SolicitudProcesamiento,
    armar_respuesta_externa,
)
from app.schemas.internal import ResultadoPipelineItem
from app.storage.oci_storage import upload_package
from app.workflow.pipeline import process_batch


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


def publicar_lote_a_oci(
    request: SolicitudProcesamiento,
    *,
    auto_aprobar_para_demo: bool = True,
    client: Any | None = None,
) -> RespuestaProcesamiento:
    """Ejecuta el pipeline completo, ensambla los mejores activos y persiste el
    paquete final en OCI Object Storage cumpliendo el contrato oficial del hackathon.
    """
    # 1. Ejecutar pipeline A -> B -> C
    resultado_pipeline = process_batch(request)
    items = resultado_pipeline.interacciones_procesadas

    # 2. Extraer análisis y generación interna para la regla de desempate
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

        candidatos = list(item.activos_candidatos)
        # En modo demo directa del endpoint oficial, se auto-aprueban los candidatos generados
        # para que lleguen a la selección final según el relevance_score
        if auto_aprobar_para_demo:
            for c in candidatos:
                c.estado_aprobacion = EstadoAprobacion.aprobado

        generacion_internos.append(
            ResultadoGeneracionInterno(
                interaccion_id=item.interaccion.id,
                activos_candidatos=candidatos,
            )
        )

    # 3. Aplicar regla de selección oficial (Equipo D): gana el mayor relevance_score
    activos_oficiales: ActivosDistribucion = armar_respuesta_externa(
        analisis_internos, generacion_internos
    )

    # 4. Calcular el resumen de la comunidad
    resumen = calcular_resumen_comunidad(items)

    # 5. Armar el paquete previo a persistencia
    paquete_previo = {
        "status": EstadoRespuesta.exito.value,
        "resumen_comunidad": resumen.model_dump(mode="json"),
        "activos_distribucion_generados": activos_oficiales.model_dump(mode="json", exclude_none=True),
    }

    # 6. Persistir en OCI Object Storage
    almacenamiento: AlmacenamientoOCI = upload_package(
        paquete_previo,
        periodo_referencia=request.periodo_referencia,
        client=client,
    )

    # 7. Respuesta consolidada final oficial
    return RespuestaProcesamiento(
        status=EstadoRespuesta.exito,
        resumen_comunidad=resumen,
        activos_distribucion_generados=activos_oficiales,
        almacenamiento_oci=almacenamiento,
    )


__all__ = [
    "calcular_resumen_comunidad",
    "publicar_lote_a_oci",
]
