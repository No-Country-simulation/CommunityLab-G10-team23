"""Structured LLM analysis for incoming community interactions."""

import os
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from tenacity import retry, stop_after_attempt, wait_fixed

from app.contracts.models import AnalisisInterno, InteraccionInterna


_ANALYSIS_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """Eres el analista de CommunityLab. Analiza una sola interacción de una
comunidad de aprendizaje y responde exclusivamente con el esquema estructurado indicado.

Extrae:
- sentimiento: etiqueta breve en español (positivo, neutral o negativo).
- sentimiento_score: intensidad entre -1.0 (muy negativo) y 1.0 (muy positivo).
- temas: conceptos principales, sin duplicados.
- entidades: personas, organizaciones, tecnologías o productos mencionados.
- resumen: resumen factual en una oración, sin agregar información.
- intencion: propósito principal en snake_case en español.

Si el texto es ambiguo, conserva una interpretación neutral y no inventes datos.""",
        ),
        (
            "human",
            "Comunidad: {origen_comunidad}\nPeriodo: {periodo_referencia}\n"
            "Interacción: {interaccion}",
        ),
    ]
)


class _LazyStructuredChain:
    """Build the provider chain only when invoked, allowing startup without API keys."""

    def __init__(self) -> None:
        self._chain: Any | None = None

    def _build(self) -> Any:
        from langchain_google_genai import ChatGoogleGenerativeAI

        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("Falta GEMINI_API_KEY en las variables de entorno")

        llm = ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            temperature=0,
            google_api_key=api_key,
        )
        return _ANALYSIS_PROMPT | llm.with_structured_output(AnalisisInterno)

    def invoke(self, values: dict[str, Any]) -> Any:
        if self._chain is None:
            self._chain = self._build()
        return self._chain.invoke(values)


structured_chain = _LazyStructuredChain()


@retry(stop=stop_after_attempt(2), wait=wait_fixed(0), reraise=True)
def analyze_interaction(
    interaction: InteraccionInterna,
    *,
    origen_comunidad: str = "",
    periodo_referencia: str = "",
) -> AnalisisInterno:
    """Analyze an interaction with one immediate retry; return validated Pydantic data."""
    result = structured_chain.invoke(
        {
            "origen_comunidad": origen_comunidad,
            "periodo_referencia": periodo_referencia,
            "interaccion": interaction.model_dump(mode="json"),
        }
    )
    return AnalisisInterno.model_validate(result)


__all__ = ["analyze_interaction", "structured_chain"]
