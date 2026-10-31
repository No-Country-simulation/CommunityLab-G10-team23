"""Endpoints de persistencia en OCI Object Storage y contrato oficial externo (Equipo D)."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.auth.dependencies import requiere_lector, requiere_revisor
from app.contracts.models import RespuestaProcesamiento, SolicitudProcesamiento
from app.schemas.internal import ResultadoPipelineItem
from app.storage.oci_storage import (
    build_object_path,
    download_package,
    get_bucket_name,
    get_namespace,
    list_published_packages,
)
from app.storage.service import publicar_lote_a_oci

router = APIRouter()


class SolicitudPublicacion(SolicitudProcesamiento):
    items: list[ResultadoPipelineItem] | None = None


@router.post("/publish", response_model=RespuestaProcesamiento, dependencies=[Depends(requiere_revisor)])
def publish_to_oci(request: SolicitudPublicacion) -> RespuestaProcesamiento:
    """Endpoint oficial del Hackathon:
    Recibe el lote de interacciones, realiza el análisis de IA (o usa los ítems revisados),
    selecciona los mejores activos de distribución, persiste el paquete en OCI Object Storage
    (capa Always Free) y devuelve la salida oficial estructurada exigida por el documento del proyecto.
    """
    try:
        return publicar_lote_a_oci(request, items_procesados=request.items)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar y persistir el paquete en OCI: {error}",
        ) from error


@router.get("/packages", dependencies=[Depends(requiere_lector)])
def get_all_packages() -> dict[str, Any]:
    """Lista todos los paquetes de distribución oficiales persistidos en OCI bajo 'activos/'.
    Incluye por default el contenido JSON completo de cada paquete para consulta inmediata.
    """
    try:
        packages = list_published_packages()

        # Enriquecer cada paquete con nombre secuencial amigable y su JSON completo
        total_count = len(packages)
        for idx, pkg in enumerate(packages):
            ruta = pkg.get("ruta_objeto", "")
            parts = ruta.split("/")
            folder = parts[1] if len(parts) >= 3 else ""

            if folder.startswith("paquete_"):
                num_str = folder.replace("paquete_", "")
                pkg["nombre"] = f"Paquete {num_str}"
            else:
                pkg["nombre"] = f"Paquete {total_count - idx}"

            try:
                pkg_data = download_package(ruta)
                pkg["data"] = pkg_data
                if isinstance(pkg_data, dict):
                    if "nombre_paquete" in pkg_data:
                        pkg["nombre"] = pkg_data["nombre_paquete"]
                    casos = pkg_data.get("casos") or []
                    pkg["total_casos"] = len(casos) if isinstance(casos, list) else 0
            except Exception:
                pkg["data"] = None
                pkg["total_casos"] = 0

        return {
            "status": "ok",
            "bucket": get_bucket_name(),
            "namespace": get_namespace(),
            "total": len(packages),
            "packages": packages,
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al listar paquetes en OCI: {error}",
        ) from error


@router.get("/packages/{periodo_referencia:path}", dependencies=[Depends(requiere_lector)])
def get_published_package(periodo_referencia: str) -> dict[str, Any]:
    """Recupera el paquete JSON almacenado en OCI Object Storage para un periodo o ruta dada."""
    if periodo_referencia.endswith(".json"):
        object_path = periodo_referencia
    else:
        object_path = build_object_path(periodo_referencia)

    try:
        package_content = download_package(object_path)
        return {
            "status": "ok",
            "bucket": get_bucket_name(),
            "ruta_objeto": object_path,
            "data": package_content,
        }
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró ningún paquete en OCI para '{periodo_referencia}' ({object_path})",
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Error al leer de OCI Object Storage: {error}",
        ) from error


@router.get("/status", dependencies=[Depends(requiere_lector)])
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
