from unittest.mock import patch

from app.ai.analyzer import analyze_interaction
from app.schemas.internal import InteraccionInterna


def test_analyzer_parses_structured_llm_output():
    interaction = InteraccionInterna(
        autor="Mariana",
        canal="Discord",
        tipo="pregunta",
        texto="¿Cómo puedo usar FastAPI?",
    )
    structured_result = {
        "sentimiento": "neutral",
        "sentimiento_score": 0.0,
        "temas": ["FastAPI"],
        "entidades": ["FastAPI"],
        "resumen": "Consulta sobre el uso de FastAPI.",
        "intencion": "solicitar_ayuda",
    }

    with patch("app.ai.analyzer.structured_chain.invoke", return_value=structured_result) as invoke:
        result = analyze_interaction(interaction)

    assert result.resumen == "Consulta sobre el uso de FastAPI."
    assert result.temas == ["FastAPI"]
    invoke.assert_called_once()


def test_analyzer_retries_llm_call_before_propagating_failure():
    interaction = InteraccionInterna(
        autor="Mariana",
        canal="Discord",
        tipo="pregunta",
        texto="Necesito ayuda.",
    )

    with patch(
        "app.ai.analyzer.structured_chain.invoke",
        side_effect=RuntimeError("provider unavailable"),
    ) as invoke:
        try:
            analyze_interaction(interaction)
        except RuntimeError:
            pass
        else:
            raise AssertionError("The analyzer should propagate after its retry limit")

    assert invoke.call_count == 2
