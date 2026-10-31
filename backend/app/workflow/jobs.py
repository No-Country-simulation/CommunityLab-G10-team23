"""Procesamiento del pipeline en segundo plano, interacción por interacción.

Cada trabajo es un lote del equipo guardado en app.db (ver repository.py): quien lo sube
queda como autor y cada interacción se guarda en cuanto termina, así que el avance
sobrevive a un reinicio y cualquier revisor puede abrir el lote. El hilo de proceso sí vive
en memoria: asume un único worker de Uvicorn, y al arrancar se marcan como fallidos los
lotes que quedaron a medias.
"""

import threading
from uuid import uuid4

from app.contracts.enums import EstadoTrabajo
from app.contracts.models import Autoria, SolicitudProcesamiento
from app.schemas.internal import ResultadoPipeline, ResumenLote, TrabajoPipeline

from . import pipeline, repository

# Un lote a la vez, y dentro de él una interacción a la vez.
_run_lock = threading.Lock()


def start_job(request: SolicitudProcesamiento, autor: Autoria) -> TrabajoPipeline:
    job_id = f"job_{uuid4().hex}"
    repository.crear_lote(job_id, request, autor)
    threading.Thread(target=_run, args=(job_id, request), daemon=True).start()
    return repository.obtener_lote(job_id)


def process_now(request: SolicitudProcesamiento, autor: Autoria) -> ResultadoPipeline:
    """Variante síncrona (POST /pipeline/process): mismo lote en app.db, sin hilo aparte."""
    job_id = f"job_{uuid4().hex}"
    repository.crear_lote(job_id, request, autor)
    _run(job_id, request)
    lote = repository.obtener_lote(job_id)
    return ResultadoPipeline(
        origen_comunidad=lote.origen_comunidad,
        periodo_referencia=lote.periodo_referencia,
        interacciones_procesadas=lote.interacciones_procesadas,
    )


def get_job(job_id: str, *, desde: int = 0) -> TrabajoPipeline | None:
    return repository.obtener_lote(job_id, desde=desde)


def list_jobs(*, sin_publicar: bool = False) -> list[ResumenLote]:
    return repository.listar_lotes(sin_publicar=sin_publicar)


def _run(job_id: str, request: SolicitudProcesamiento) -> None:
    with _run_lock:
        repository.actualizar_estado(job_id, EstadoTrabajo.en_proceso)
        try:
            for posicion, item in enumerate(pipeline.iter_batch(request)):
                repository.agregar_item(job_id, posicion, item)
            repository.actualizar_estado(job_id, EstadoTrabajo.completado)
        except Exception as error:
            repository.actualizar_estado(job_id, EstadoTrabajo.fallido, error=str(error))


__all__ = ["start_job", "process_now", "get_job", "list_jobs"]
