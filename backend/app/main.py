from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from app.api.v1.ingestion import router as ingestion_router
from app.api.v1.pipeline import router as pipeline_router
from app.api.v1.review import router as review_router
from app.api.v1.storage import router as storage_router
from app.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.include_router(
    ingestion_router,
    prefix=f"{settings.API_V1_STR}/ingest",
    tags=["Ingestion"],
)
app.include_router(
    pipeline_router,
    prefix=f"{settings.API_V1_STR}/pipeline",
    tags=["Pipeline"],
)
app.include_router(
    review_router,
    prefix=f"{settings.API_V1_STR}/review",
    tags=["HITL Review"],
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