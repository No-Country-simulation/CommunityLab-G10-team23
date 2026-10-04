from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.contracts.enums import EstadoAprobacion
from app.content.repository import list_assets, update_asset


class AssetReviewUpdate(BaseModel):
    estado_aprobacion: EstadoAprobacion
    contenido: dict[str, Any] | None = None


router = APIRouter()


@router.get("/assets")
def get_review_assets() -> list[dict[str, Any]]:
    return list_assets()


@router.patch("/assets/{candidate_id}")
def review_asset(candidate_id: str, update: AssetReviewUpdate) -> dict[str, Any]:
    try:
        return update_asset(
            candidate_id,
            status=update.estado_aprobacion,
            content=update.contenido,
        )
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


__all__ = ["router", "AssetReviewUpdate"]
