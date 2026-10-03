from fastapi import FastAPI
from app.config import settings
# from app.api.v1.ingestion import router as ingestion_router

app = FastAPI(title=settings.PROJECT_NAME)

@app.get("/health")
def health_check():
    return {"status": "ok", "environment": settings.ENVIRONMENT}