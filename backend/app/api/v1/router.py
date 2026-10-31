"""Registro de las rutas de la API v1.

Cada módulo de este paquete define un ``APIRouter`` sin prefijo; aquí se decide en un solo
sitio su prefijo, su etiqueta en la documentación y el rol mínimo que exige. Una versión
nueva de la API (v2) tendría su propio ``router.py`` y se monta en ``app/main.py``.

Todo exige sesión salvo los endpoints públicos de /auth (login, registro, restablecer).
Storage asigna el rol en cada endpoint: consultar es de lector, publicar es de admin.
"""

from fastapi import APIRouter, Depends

from app.api.v1 import auth, ingestion, pipeline, review, storage, usuarios
from app.auth.dependencies import requiere_admin, requiere_revisor

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(
    usuarios.router,
    prefix="/usuarios",
    tags=["Usuarios"],
    dependencies=[Depends(requiere_admin)],
)
api_router.include_router(
    ingestion.router,
    prefix="/ingest",
    tags=["Ingestion"],
    dependencies=[Depends(requiere_revisor)],
)
api_router.include_router(
    pipeline.router,
    prefix="/pipeline",
    tags=["Pipeline"],
    dependencies=[Depends(requiere_revisor)],
)
api_router.include_router(
    review.router,
    prefix="/review",
    tags=["HITL Review"],
    dependencies=[Depends(requiere_revisor)],
)
api_router.include_router(storage.router, prefix="/storage", tags=["OCI Storage (Equipo D)"])
