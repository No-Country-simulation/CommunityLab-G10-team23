"""Endpoints de persistencia en OCI Object Storage y contrato oficial externo (Equipo D)."""

from typing import Any

from fastapi import APIRouter, HTTPException

from app.contracts.models import RespuestaProcesamiento, SolicitudProcesamiento
from app.storage.oci_storage import (
    build_object_path,
    download_package,
    get_bucket_name,
    get_namespace,
)
from app.storage.service import publicar_lote_a_oci

router = APIRouter()


@router.post("/publish", response_model=RespuestaProcesamiento)
def publish_to_oci(request: SolicitudProcesamiento) -> RespuestaProcesamiento:
    """Endpoint oficial del Hackathon:
    Recibe el lote de interacciones, realiza el análisis de IA, selecciona los mejores
    activos de distribución, persiste el paquete en OCI Object Storage (capa Always Free)
    y devuelve la salida oficial estructurada exigida por el documento del proyecto.
    """
    try:
        return publicar_lote_a_oci(request)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar y persistir el paquete en OCI: {error}",
        ) from error


@router.get("/packages/{periodo_referencia}")
def get_published_package(periodo_referencia: str) -> dict[str, Any]:
    """Recupera el paquete JSON almacenado en OCI Object Storage para un periodo dado."""
    object_path = build_object_path(periodo_referencia)
    try:
        return download_package(object_path)
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró ningún paquete en OCI para el periodo '{periodo_referencia}' ({object_path})",
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al leer de OCI Object Storage: {error}",
        ) from error


@router.get("/status")
def get_storage_status() -> dict[str, Any]:
    """Informa el estado de la configuración de OCI Object Storage."""
    return {
        "status": "ready",
        "provider": "Oracle Cloud Infrastructure (OCI)",
        "bucket": get_bucket_name(),
        "namespace": get_namespace(),
        "always_free_tier": True,
    }


__all__ = ["router"]
