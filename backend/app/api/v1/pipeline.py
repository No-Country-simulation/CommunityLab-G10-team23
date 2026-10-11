"""Endpoints that orchestrate Team A analysis, Team B classification and Team C generation."""

from fastapi import APIRouter, HTTPException, Query

from app.contracts.models import SolicitudProcesamiento
from app.schemas.internal import ResultadoPipeline, TrabajoPipeline
from app.workflow.jobs import get_job, start_job
from app.workflow.pipeline import process_batch


router = APIRouter()


@router.post("/process", response_model=ResultadoPipeline)
def process_pipeline(request: SolicitudProcesamiento) -> ResultadoPipeline:
    return process_batch(request)


@router.post("/jobs", response_model=TrabajoPipeline, status_code=202)
def create_pipeline_job(request: SolicitudProcesamiento) -> TrabajoPipeline:
    """Encola el lote y responde de inmediato; el avance se consulta con GET /jobs/{job_id}."""
    return start_job(request)


@router.get("/jobs/{job_id}", response_model=TrabajoPipeline)
def read_pipeline_job(job_id: str, desde: int = Query(0, ge=0)) -> TrabajoPipeline:
    """Devuelve el estado del trabajo y las interacciones procesadas a partir de `desde`."""
    job = get_job(job_id, desde=desde)
    if job is None:
        raise HTTPException(status_code=404, detail=f"No existe el trabajo {job_id}")
    return job


__all__ = ["router", "process_pipeline", "create_pipeline_job", "read_pipeline_job"]
