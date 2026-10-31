from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from app.api.v1.router import api_router
from app.config import settings
from app.workflow.repository import interrumpir_lotes_en_curso


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Los hilos de proceso no sobreviven a un reinicio: esos lotes quedan como fallidos,
    # con sus interacciones ya analizadas disponibles para revisión.
    interrumpir_lotes_en_curso()
    yield


def create_app() -> FastAPI:
    """Construye la aplicación: rutas de sistema (/, /health) y la API versionada."""
    application = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

    @application.get("/", include_in_schema=False)
    def root():
        """Redirige automáticamente la raíz a la documentación interactiva Swagger UI."""
        return RedirectResponse(url="/docs")

    @application.get("/health")
    def health_check():
        return {"status": "ok", "environment": settings.ENVIRONMENT}

    application.include_router(api_router, prefix=settings.API_V1_STR)
    return application


app = create_app()
