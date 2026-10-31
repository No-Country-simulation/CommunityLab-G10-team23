import os

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from app.contracts.enums import AssetCategory
from app.contracts.models import AnalisisInterno


class PropuestaClasificacion(BaseModel):
    categoria: AssetCategory
    confianza: float = Field(ge=0.0, le=1.0)
    justificacion: str


_CATEGORY_VALUES = ", ".join(category.value for category in AssetCategory)

_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """Eres el clasificador de CommunityLab.
Analiza el objeto AnalisisInterno y elige exactamente una categoria de esta lista:
{categories}

Reglas obligatorias:
- Devuelve una categoria exactamente igual a uno de los valores permitidos.
- No inventes categorias ni traduzcas sus nombres.
- SUPPORT_ALERT se usa para bloqueo, frustracion o problema persistente.
- SUCCESS_STORY se usa para logros verificables como empleo o proyecto terminado.
- FAQ se usa para dudas frecuentes o preguntas puntuales.
- EDUCATIONAL_CONTENT se usa cuando una duda tecnica puede convertirse en contenido reutilizable.
- COMMUNITY_HIGHLIGHT se usa para testimonios o agradecimientos positivos.
- SOCIAL_POST se usa para contenido positivo apto para una publicacion.
- IGNORE se usa cuando no hay oportunidad util.
- No uses el campo tipo ni datos que no esten en el analisis.

Responde con categoria, confianza entre 0 y 1 y una justificacion breve.""",
        ),
        (
            "human",
            "AnalisisInterno:\n{analysis}",
        ),
    ]
).partial(categories=_CATEGORY_VALUES)


def create_llm_classifier():
    from langchain_google_genai import ChatGoogleGenerativeAI

    load_dotenv()

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Falta GEMINI_API_KEY en las variables de entorno")

    model = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    llm = ChatGoogleGenerativeAI(
        model=model,
        temperature=0,
        google_api_key=api_key,
    )
    return _PROMPT | llm.with_structured_output(PropuestaClasificacion)


def classify_with_llm(classifier, analysis: AnalisisInterno) -> PropuestaClasificacion:
    """Ejecuta el clasificador sobre un AnalisisInterno validado."""
    result = classifier.invoke({"analysis": analysis.model_dump()})
    return PropuestaClasificacion.model_validate(result)


__all__ = [
    "PropuestaClasificacion",
    "classify_with_llm",
    "create_llm_classifier",
]
