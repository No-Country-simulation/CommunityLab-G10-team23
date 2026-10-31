import pytest

from app.contracts.enums import AssetCategory
from app.intelligence.classifier import classify_analysis
from app.intelligence.models import AnalisisInterno
from app.intelligence.scorer import calculate_relevance_score


def analysis(**overrides) -> AnalisisInterno:
    values = {
        "sentimiento": "neutral",
        "sentimiento_score": 0.05,
        "temas": ["LangGraph", "reintentos"],
        "entidades": ["LangGraph"],
        "resumen": "Pregunta tecnica sobre routers y reintentos en LangGraph.",
        "intencion": "solicitar_ejemplo",
    }
    values.update(overrides)
    return AnalisisInterno(**values)


def test_success_story():
    result = analysis(
        sentimiento="positivo",
        sentimiento_score=0.92,
        temas=["contratacion", "LangChain", "OCI", "portfolio"],
        entidades=["LangChain", "OCI"],
        resumen="Egresada consigue empleo como Dev Jr. gracias a un proyecto.",
        intencion="compartir_logro",
    )

    assert classify_analysis(result) == AssetCategory.success_story
    assert calculate_relevance_score(result) >= 85


def test_technical_question_is_educational():
    result = analysis(intencion="aprender")

    assert classify_analysis(result) == AssetCategory.educational_content


def test_frequent_question_is_faq():
    result = analysis(resumen="Pregunta frecuente sobre nodos condicionales en LangGraph.")

    assert classify_analysis(result) == AssetCategory.faq


def test_support_alert_has_priority_over_positive_label():
    result = analysis(
        sentimiento="negativo",
        sentimiento_score=-0.8,
        temas=["soporte"],
        entidades=[],
        resumen="La persona lleva tres dias bloqueada.",
        intencion="solicitar_ayuda",
    )

    assert classify_analysis(result) == AssetCategory.support_alert


def test_irrelevant_message_is_ignored():
    result = analysis(
        sentimiento_score=0.0,
        temas=[],
        entidades=[],
        resumen="Comentario sobre el clima.",
        intencion="conversar",
    )

    assert classify_analysis(result) == AssetCategory.ignore
    assert calculate_relevance_score(result) <= 20


def test_score_is_reproducible_and_bounded():
    result = analysis()

    first = calculate_relevance_score(result)
    second = calculate_relevance_score(result)

    assert first == second
    assert 0 <= first <= 100


def test_type_is_not_used_by_classifier():
    result = analysis(
        resumen="Egresada consigue empleo gracias a un proyecto.",
        intencion="compartir_logro",
    )

    assert classify_analysis(result) == AssetCategory.success_story


@pytest.mark.parametrize("category", list(AssetCategory))
def test_all_enum_values_are_valid(category):
    assert category.value.isupper()
