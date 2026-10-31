"""Revisión humana (HITL) en equipo: cualquier revisor decide y cada decisión queda firmada."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.auth.dependencies import autor_actual
from app.content.repository import ConflictoVersion, LotePublicadoError, historial, list_assets, update_asset
from app.contracts.enums import EstadoAprobacion
from app.contracts.models import Autoria, EventoRevision


class AssetReviewUpdate(BaseModel):
    estado_aprobacion: EstadoAprobacion
    contenido: dict[str, Any] | None = None
    # Versión que vio el revisor; si otra persona cambió el activo después, responde 409.
    version: int | None = None


router = APIRouter()


@router.get("/assets")
def get_review_assets(lote_id: str | None = Query(None)) -> list[dict[str, Any]]:
    return list_assets(lote_id=lote_id)


@router.patch("/assets/{candidate_id}")
def review_asset(
    candidate_id: str,
    update: AssetReviewUpdate,
    autor: Autoria = Depends(autor_actual),
) -> dict[str, Any]:
    try:
        return update_asset(
            candidate_id,
            status=update.estado_aprobacion,
            content=update.contenido,
            version=update.version,
            autor=autor,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except LotePublicadoError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ConflictoVersion as error:
        raise HTTPException(
            status_code=409,
            detail={"mensaje": "Otra persona cambió este activo mientras lo revisabas", "actual": error.actual},
        ) from error


@router.get("/assets/{candidate_id}/historial", response_model=list[EventoRevision])
def review_history(candidate_id: str) -> list[EventoRevision]:
    try:
        return historial(candidate_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


__all__ = ["router", "AssetReviewUpdate"]
