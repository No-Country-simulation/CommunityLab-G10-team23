"""Endpoints that orchestrate Team A analysis, Team B classification and Team C generation."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.dependencies import autor_actual
from app.contracts.models import Autoria, SolicitudProcesamiento
from app.schemas.internal import ResultadoPipeline, ResumenLote, TrabajoPipeline
from app.workflow.jobs import get_job, list_jobs, process_now, start_job


router = APIRouter()


@router.post("/process", response_model=ResultadoPipeline)
def process_pipeline(request: SolicitudProcesamiento, autor: Autoria = Depends(autor_actual)) -> ResultadoPipeline:
    """Procesa el lote de forma síncrona y lo deja en la bandeja del equipo como un lote más."""
    return process_now(request, autor)


@router.post("/jobs", response_model=TrabajoPipeline, status_code=202)
def create_pipeline_job(request: SolicitudProcesamiento, autor: Autoria = Depends(autor_actual)) -> TrabajoPipeline:
    """Encola el lote y responde de inmediato; el avance se consulta con GET /jobs/{job_id}."""
    return start_job(request, autor)


@router.get("/jobs", response_model=list[ResumenLote])
def list_pipeline_jobs(
    sin_publicar: bool = Query(False, description="Solo los lotes que todavía no se guardaron en la nube"),
) -> list[ResumenLote]:
    """Lotes del equipo, del más reciente al más antiguo. Cualquier revisor puede abrirlos y revisarlos."""
    return list_jobs(sin_publicar=sin_publicar)


@router.get("/jobs/{job_id}", response_model=TrabajoPipeline)
def read_pipeline_job(job_id: str, desde: int = Query(0, ge=0)) -> TrabajoPipeline:
    """Devuelve el estado del trabajo y las interacciones procesadas a partir de `desde`."""
    job = get_job(job_id, desde=desde)
    if job is None:
        raise HTTPException(status_code=404, detail=f"No existe el trabajo {job_id}")
    return job


__all__ = ["router", "process_pipeline", "create_pipeline_job", "list_pipeline_jobs", "read_pipeline_job"]
