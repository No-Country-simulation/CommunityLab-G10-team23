"""Endpoint that orchestrates Team A analysis and Team B classification."""

from fastapi import APIRouter

from app.contracts.models import SolicitudProcesamiento
from app.schemas.internal import ResultadoPipeline
from app.workflow.pipeline import process_batch


router = APIRouter()


@router.post("/process", response_model=ResultadoPipeline)
def process_pipeline(request: SolicitudProcesamiento) -> ResultadoPipeline:
    return process_batch(request)


__all__ = ["router", "process_pipeline"]