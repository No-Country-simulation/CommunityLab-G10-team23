from pathlib import Path

from dotenv import load_dotenv

from app.contracts.models import AnalisisInterno
from app.intelligence.llm_classifier import create_llm_classifier
from app.workflow.classification_graph import build_classification_graph


load_dotenv(Path(__file__).resolve().parents[1] / ".env")


analysis = AnalisisInterno(
    sentimiento="positivo",
    sentimiento_score=0.92,
    temas=["contratacion", "LangChain", "OCI"],
    entidades=["LangChain", "OCI"],
    resumen="La estudiante consiguio empleo gracias a su proyecto.",
    intencion="compartir_logro",
)

classifier = create_llm_classifier()
graph = build_classification_graph(classifier)

result = graph.invoke(
    {
        "interaccion_id": "int_marianasouza",
        "analisis": analysis,
    }
)

print(result["resultado"].model_dump(mode="json"))