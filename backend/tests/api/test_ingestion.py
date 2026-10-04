from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app


client = TestClient(app)


def test_process_returns_422_when_required_request_field_is_missing():
    response = client.post(
        "/api/v1/ingest/process",
        json={
            "origen_comunidad": "Discord",
            "periodo_referencia": "2026-W40",
            "interacciones": [{"autor": "Mariana", "canal": "Discord", "tipo": "pregunta"}],
        },
    )

    assert response.status_code == 422


def test_process_continues_batch_when_one_interaction_fails_analysis():
    response_analysis = {
        "sentimiento": "positivo",
        "sentimiento_score": 0.8,
        "temas": ["FastAPI"],
        "entidades": ["FastAPI"],
        "resumen": "La persona comparte un avance con FastAPI.",
        "intencion": "compartir_logro",
    }
    with patch(
        "app.ai.analyzer.structured_chain.invoke",
        side_effect=[RuntimeError("provider unavailable"), RuntimeError("provider unavailable"), response_analysis],
    ) as invoke:
        response = client.post(
            "/api/v1/ingest/process",
            json={
                "origen_comunidad": "Discord",
                "periodo_referencia": "2026-W40",
                "interacciones": [
                    {"autor": "Persona 1", "canal": "Discord", "tipo": "pregunta", "texto": "Ayuda"},
                    {"autor": "Persona 2", "canal": "Discord", "tipo": "logro", "texto": "Avancé"},
                ],
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["interacciones_procesadas"]) == 2
    assert payload["interacciones_procesadas"][0]["degradado"] is True
    assert payload["interacciones_procesadas"][0]["analisis"]["sentimiento"] == "neutral"
    assert payload["interacciones_procesadas"][1]["degradado"] is False
    assert payload["interacciones_procesadas"][1]["analisis"]["temas"] == ["FastAPI"]
    assert payload["interacciones_procesadas"][0]["interaccion"]["id"]
    timestamp = payload["interacciones_procesadas"][0]["interaccion"]["timestamp"]
    assert timestamp.endswith(("Z", "+00:00"))
    assert invoke.call_count == 3
