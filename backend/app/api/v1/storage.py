"""Endpoints de persistencia en OCI Object Storage y contrato oficial externo (Equipo D)."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import autor_actual, requiere_admin, requiere_lector
from app.contracts.models import Autoria, RespuestaProcesamiento
from app.storage.oci_storage import (
    build_object_path,
    download_package,
    get_bucket_name,
    get_namespace,
    list_published_packages,
)
from app.storage.service import LoteNoPublicable, publicar_lote

router = APIRouter()


class SolicitudPublicacion(BaseModel):
    lote_id: str


@router.post("/publish", response_model=RespuestaProcesamiento, dependencies=[Depends(requiere_admin)])
def publish_to_oci(request: SolicitudPublicacion, autor: Autoria = Depends(autor_actual)) -> RespuestaProcesamiento:
    """Publica un lote revisado por el equipo (solo admin).

    Toma las decisiones de revisión guardadas en el servidor (nunca las que envía el cliente),
    selecciona los activos aprobados de mayor relevancia, persiste el paquete en OCI Object
    Storage con su auditoría y devuelve la salida oficial `RespuestaProcesamiento`. Después de
    publicar, los activos del lote ya no se pueden cambiar.
    """
    try:
        return publicar_lote(request.lote_id, autor)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error).strip("'")) from error
    except LoteNoPublicable as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
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
