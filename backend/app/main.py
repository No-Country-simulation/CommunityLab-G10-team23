from fastapi import FastAPI

from app.api.v1.ingestion import router as ingestion_router
from app.api.v1.pipeline import router as pipeline_router
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

@app.get("/health")
def health_check():
    return {"status": "ok", "environment": settings.ENVIRONMENT}