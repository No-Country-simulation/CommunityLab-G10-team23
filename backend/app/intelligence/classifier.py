from app.contracts.enums import AssetCategory

from .models import AnalisisInterno


_SUPPORT_INTENTS = {
    "solicitar_ayuda",
    "reportar_problema",
    "pedir_soporte",
}
_SUCCESS_INTENTS = {
    "compartir_logro",
    "celebrar_logro",
}
_HELP_INTENTS = {
    "solicitar_ejemplo",
    "aprender",
    "solicitar_ayuda",
}


def _text(analysis: AnalisisInterno) -> str:
    values = [
        analysis.intencion,
        analysis.resumen,
        *analysis.temas,
    ]
    return " ".join(values).lower()


def classify_analysis(analysis: AnalisisInterno) -> AssetCategory:
    """Clasifica un AnalisisInterno sin consultar el campo tipo ni un LLM."""
    text = _text(analysis)
    intention = analysis.intencion.lower().strip()

    if intention in _SUPPORT_INTENTS or any(
        phrase in text for phrase in ("bloqueado", "llevo tres dias", "no logro entender")
    ):
        return AssetCategory.support_alert

    if intention in _SUCCESS_INTENTS or any(
        phrase in text
        for phrase in ("consigue empleo", "consiguio empleo", "contratacion", "termino su proyecto")
    ):
        return AssetCategory.success_story

    if "faq" in text or "pregunta frecuente" in text:
        return AssetCategory.faq

    if intention in _HELP_INTENTS and analysis.temas:
        return AssetCategory.educational_content

    if analysis.sentimiento_score >= 0.7 and any(
        word in text for word in ("agradecimiento", "agradecida", "ayudo muchisimo", "testimonio")
    ):
        return AssetCategory.community_highlight

    if analysis.sentimiento_score >= 0.6 and analysis.resumen.strip():
        return AssetCategory.social_post

    return AssetCategory.ignore


try:
    from langchain_core.runnables import RunnableLambda

    classification_chain = RunnableLambda(classify_analysis)
except ImportError:  # LangChain es opcional mientras se instala el backend.
    classification_chain = None


__all__ = ["classify_analysis", "classification_chain"]
