from fastapi import Depends, FastAPI
from fastapi.responses import RedirectResponse

from app.api.v1.auth import router as auth_router
from app.api.v1.ingestion import router as ingestion_router
from app.api.v1.pipeline import router as pipeline_router
from app.api.v1.review import router as review_router
from app.api.v1.storage import router as storage_router
from app.api.v1.usuarios import router as usuarios_router
from app.auth.dependencies import requiere_admin, requiere_revisor
from app.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

# Todo exige sesión salvo /health y los endpoints públicos de /auth (login, registro, restablecer).
# Storage asigna el rol en cada endpoint: consultar es de lector, publicar es de revisor.
app.include_router(
    auth_router,
    prefix=f"{settings.API_V1_STR}/auth",
    tags=["Autenticación"],
)
app.include_router(
    usuarios_router,
    prefix=f"{settings.API_V1_STR}/usuarios",
    tags=["Usuarios"],
    dependencies=[Depends(requiere_admin)],
)
app.include_router(
    ingestion_router,
    prefix=f"{settings.API_V1_STR}/ingest",
    tags=["Ingestion"],
    dependencies=[Depends(requiere_revisor)],
)
app.include_router(
    pipeline_router,
    prefix=f"{settings.API_V1_STR}/pipeline",
    tags=["Pipeline"],
    dependencies=[Depends(requiere_revisor)],
)
app.include_router(
    review_router,
    prefix=f"{settings.API_V1_STR}/review",
    tags=["HITL Review"],
    dependencies=[Depends(requiere_revisor)],
)
app.include_router(
    storage_router,
    prefix=f"{settings.API_V1_STR}/storage",
    tags=["OCI Storage (Equipo D)"],
)


@app.get("/", include_in_schema=False)
def root():
    """Redirige automáticamente la raíz a la documentación interactiva Swagger UI."""
    return RedirectResponse(url="/docs")


@app.get("/health")
def health_check():
    return {"status": "ok", "environment": settings.ENVIRONMENT}
