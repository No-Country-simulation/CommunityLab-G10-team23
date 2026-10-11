import threading
import time
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.contracts.models import AnalisisInterno, InteraccionInterna
from app.main import app
from app.schemas.internal import ResultadoPipelineItem


client = TestClient(app)

REQUEST = {
    "origen_comunidad": "Discord",
    "periodo_referencia": "Semana_04",
    "interacciones": [
        {"autor": "Mariana", "canal": "#logros", "tipo": "testimonio", "texto": "Consegui empleo."},
        {"autor": "Lucas", "canal": "#dudas", "tipo": "pregunta", "texto": "Tengo una duda."},
    ],
}


def item_for(incoming) -> ResultadoPipelineItem:
    return ResultadoPipelineItem(
        interaccion=InteraccionInterna(
            autor=incoming.autor, canal=incoming.canal, tipo=incoming.tipo, texto=incoming.texto
        ),
        analisis=AnalisisInterno(
            sentimiento="neutral",
            sentimiento_score=0.0,
            temas=[],
            entidades=[],
            resumen=incoming.texto,
            intencion="test",
        ),
    )


def wait_for(job_id: str, estado: str, *, desde: int = 0) -> dict:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        body = client.get(f"/api/v1/pipeline/jobs/{job_id}", params={"desde": desde}).json()
        if body["estado"] == estado:
            return body
        time.sleep(0.01)
    raise AssertionError(f"El trabajo no llegó a {estado}: {body}")


def test_job_exposes_each_interaction_as_soon_as_it_is_processed():
    release_second = threading.Event()

    def fake_iter_batch(request):
        yield item_for(request.interacciones[0])
        release_second.wait(timeout=5)
        yield item_for(request.interacciones[1])

    with patch("app.workflow.pipeline.iter_batch", fake_iter_batch):
        created = client.post("/api/v1/pipeline/jobs", json=REQUEST)
        assert created.status_code == 202
        job_id = created.json()["job_id"]
        assert created.json()["total"] == 2

        deadline = time.monotonic() + 5
        partial = client.get(f"/api/v1/pipeline/jobs/{job_id}").json()
        while partial["procesadas"] < 1 and time.monotonic() < deadline:
            time.sleep(0.01)
            partial = client.get(f"/api/v1/pipeline/jobs/{job_id}").json()
        assert partial["estado"] == "en_proceso"
        assert [i["interaccion"]["autor"] for i in partial["interacciones_procesadas"]] == ["Mariana"]

        release_second.set()
        done = wait_for(job_id, "completado", desde=1)

    assert done["procesadas"] == 2
    assert done["desde"] == 1
    assert [i["interaccion"]["autor"] for i in done["interacciones_procesadas"]] == ["Lucas"]


def test_failed_job_reports_error_and_keeps_processed_items():
    def failing_iter_batch(request):
        yield item_for(request.interacciones[0])
        raise RuntimeError("LLM no disponible")

    with patch("app.workflow.pipeline.iter_batch", failing_iter_batch):
        job_id = client.post("/api/v1/pipeline/jobs", json=REQUEST).json()["job_id"]
        failed = wait_for(job_id, "fallido")

    assert failed["error"] == "LLM no disponible"
    assert failed["procesadas"] == 1


def test_unknown_job_returns_404():
    response = client.get("/api/v1/pipeline/jobs/job_inexistente")

    assert response.status_code == 404


def test_invalid_batch_is_rejected_with_422():
    response = client.post("/api/v1/pipeline/jobs", json={"origen_comunidad": "Discord"})

    assert response.status_code == 422
