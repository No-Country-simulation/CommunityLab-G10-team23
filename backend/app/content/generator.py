import os
from typing import Any

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel

from app.contracts.enums import AssetCategory, EstadoAprobacion, TipoActivoOficial
from app.contracts.models import (
    ActivoCandidato,
    AnalisisInterno,
    ResultadoAnalisisInterno,
    ResultadoGeneracionInterno,
)


class GeneratedContent(BaseModel):
    post_linkedin: dict[str, Any] | None = None
    destaque_newsletter_semanal: dict[str, Any] | None = None
    sugerencia_contenido_faq: dict[str, Any] | None = None


_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """Eres el generador de contenido de CommunityLab.
Usa solamente los hechos presentes en AnalisisInterno. No inventes nombres, fechas,
empresas, cifras ni logros. Devuelve JSON estructurado con solo los formatos solicitados.

LinkedIn debe tener: titulo, copy, canal_recomendado, potencial_engagement.
Newsletter debe tener: seccion, titular, resumen.
FAQ debe tener: tema, origen, status.
""",
        ),
        (
            "human",
            "Formatos solicitados: {formats}\nAnalisisInterno: {analysis}",
        ),
    ]
)


def _formats_for(result: ResultadoAnalisisInterno) -> list[TipoActivoOficial]:
    category = result.oportunidad.categoria
    if category == AssetCategory.success_story:
        return [
            TipoActivoOficial.post_linkedin,
            TipoActivoOficial.destaque_newsletter_semanal,
        ]
    if category in {
        AssetCategory.faq,
        AssetCategory.educational_content,
    }:
        return [
            TipoActivoOficial.sugerencia_contenido_faq,
            TipoActivoOficial.post_linkedin,
        ]
    if category in {
        AssetCategory.community_highlight,
        AssetCategory.social_post,
    }:
        return [
            TipoActivoOficial.post_linkedin,
            TipoActivoOficial.destaque_newsletter_semanal,
        ]
    return []


def _fallback_content(analysis: AnalisisInterno, asset_type: TipoActivoOficial) -> dict[str, Any]:
    summary = analysis.resumen
    if asset_type == TipoActivoOficial.post_linkedin:
        return {
            "titulo": "Historia de la comunidad",
            "copy": summary,
            "canal_recomendado": "LinkedIn Oficial",
            "potencial_engagement": "Por revisar",
        }
    if asset_type == TipoActivoOficial.destaque_newsletter_semanal:
        return {
            "seccion": "Historia de la Semana",
            "titular": summary,
            "resumen": summary,
        }
    return {
        "tema": analysis.temas[0] if analysis.temas else "Pregunta de la comunidad",
        "origen": summary,
        "status": "derivado_a_mentoria",
    }


def _content_for(
    generated: GeneratedContent,
    asset_type: TipoActivoOficial,
) -> dict[str, Any] | None:
    return {
        TipoActivoOficial.post_linkedin: generated.post_linkedin,
        TipoActivoOficial.destaque_newsletter_semanal: generated.destaque_newsletter_semanal,
        TipoActivoOficial.sugerencia_contenido_faq: generated.sugerencia_contenido_faq,
    }[asset_type]


def generate_assets(
    result: ResultadoAnalisisInterno,
    *,
    llm: Any | None = None,
) -> ResultadoGeneracionInterno:
    """Genera candidatos solo cuando B enruta la interacción a contenido."""
    if result.enrutamiento.ruta != "equipo_c.generar_activos":
        return ResultadoGeneracionInterno(
            interaccion_id=result.interaccion_id,
            activos_candidatos=[],
        )

    asset_types = _formats_for(result)
    generated: GeneratedContent | None = None
    if llm is None:
        load_dotenv()
        from langchain_google_genai import ChatGoogleGenerativeAI

        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            llm = ChatGoogleGenerativeAI(
                model=os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
                temperature=0,
                google_api_key=api_key,
            )

    try:
        chain = _PROMPT | llm.with_structured_output(GeneratedContent)
        formats = ", ".join(asset_type.value for asset_type in asset_types)
        generated = GeneratedContent.model_validate(
            chain.invoke(
                {
                    "formats": formats,
                    "analysis": result.analisis.model_dump(mode="json"),
                }
            )
        )
    except Exception:
        generated = None

    candidates = []
    for asset_type in asset_types:
        content = _content_for(generated, asset_type) if generated else None
        candidates.append(
            ActivoCandidato(
                tipo_activo=asset_type,
                contenido=content or _fallback_content(result.analisis, asset_type),
                estado_aprobacion=EstadoAprobacion.pendiente,
            )
        )

    return ResultadoGeneracionInterno(
        interaccion_id=result.interaccion_id,
        activos_candidatos=candidates,
    )


__all__ = ["GeneratedContent", "generate_assets"]
