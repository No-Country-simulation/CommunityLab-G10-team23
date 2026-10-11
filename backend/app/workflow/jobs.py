"""Procesamiento del pipeline en segundo plano, interacción por interacción.

Los trabajos viven en memoria del proceso: se pierden al reiniciar el backend y
asumen un único worker de Uvicorn. Es un paso intermedio hasta tener persistencia real.
"""

import threading
from dataclasses import dataclass, field
from uuid import uuid4

from app.contracts.enums import EstadoTrabajo
from app.contracts.models import SolicitudProcesamiento
from app.schemas.internal import ResultadoPipelineItem, TrabajoPipeline

from . import pipeline

# Se conservan los trabajos más recientes; los terminados más antiguos se descartan.
MAX_JOBS = 20

_jobs: dict[str, "_Job"] = {}
_jobs_lock = threading.Lock()
# Un lote a la vez, y dentro de él una interacción a la vez.
_run_lock = threading.Lock()


@dataclass
class _Job:
    id: str
    request: SolicitudProcesamiento
    estado: EstadoTrabajo = EstadoTrabajo.en_cola
    items: list[ResultadoPipelineItem] = field(default_factory=list)
    error: str | None = None


def start_job(request: SolicitudProcesamiento) -> TrabajoPipeline:
    job = _Job(id=f"job_{uuid4().hex}", request=request)
    with _jobs_lock:
        _jobs[job.id] = job
        _evict_finished()
    threading.Thread(target=_run, args=(job,), daemon=True).start()
    return _snapshot(job, desde=0)


def get_job(job_id: str, *, desde: int = 0) -> TrabajoPipeline | None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        return _snapshot(job, desde=desde) if job else None


def _run(job: _Job) -> None:
    with _run_lock:
        job.estado = EstadoTrabajo.en_proceso
        try:
            for item in pipeline.iter_batch(job.request):
                with _jobs_lock:
                    job.items.append(item)
            job.estado = EstadoTrabajo.completado
        except Exception as error:
            job.error = str(error)
            job.estado = EstadoTrabajo.fallido


def _snapshot(job: _Job, *, desde: int) -> TrabajoPipeline:
    return TrabajoPipeline(
        job_id=job.id,
        estado=job.estado,
        origen_comunidad=job.request.origen_comunidad,
        periodo_referencia=job.request.periodo_referencia,
        total=len(job.request.interacciones),
        procesadas=len(job.items),
        desde=desde,
        interacciones_procesadas=job.items[desde:],
        error=job.error,
    )


def _evict_finished() -> None:
    finished = {EstadoTrabajo.completado, EstadoTrabajo.fallido}
    for job_id in list(_jobs):
        if len(_jobs) <= MAX_JOBS:
            break
        if _jobs[job_id].estado in finished:
            del _jobs[job_id]


__all__ = ["start_job", "get_job", "MAX_JOBS"]
