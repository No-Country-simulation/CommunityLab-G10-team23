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
            """Eres el redactor de contenido de CommunityLab, una comunidad de aprendizaje tech.
Escribe siempre en español neutro. Usa solamente los hechos presentes en AnalisisInterno:
no inventes nombres, fechas, empresas, cifras, cargos ni logros. Si un dato no está en el
análisis, omítelo en lugar de suponerlo. Devuelve JSON estructurado con solo los formatos solicitados.

LinkedIn (post_linkedin), campos: titulo, copy, canal_recomendado, potencial_engagement.
- titulo: gancho breve (máximo 10 palabras) que resuma el hecho principal.
- copy: post listo para publicar en LinkedIn, en primera persona del plural como la comunidad.
  Estructura: una primera línea gancho que despierte interés; 2 o 3 párrafos cortos
  (1 a 3 oraciones cada uno) que cuenten qué pasó y por qué importa para la comunidad;
  un cierre con una pregunta o llamada a la acción; y al final 3 a 5 hashtags relevantes.
  Tono profesional y cercano, sin exageraciones. Separa los párrafos con una línea en blanco.
- canal_recomendado: "LinkedIn Oficial".
- potencial_engagement: "Alto", "Medio" o "Bajo".

Newsletter (destaque_newsletter_semanal), campos: seccion, titular, resumen.
- seccion: exactamente una de "Logros de la comunidad", "Preguntas destacadas",
  "Aprendizaje y recursos" o "Vida de la comunidad".
- titular: titular periodístico informativo (máximo 12 palabras), en tercera persona,
  sin signos de exclamación.
- resumen: nota breve con formato de noticia, en tercera persona y tono informativo.
  Primer párrafo (entradilla): responde qué pasó, quién y por qué es relevante.
  Segundo párrafo: contexto o detalle que aporte valor a los lectores de la comunidad.
  Entre 60 y 120 palabras en total. Separa los párrafos con una línea en blanco.

FAQ (sugerencia_contenido_faq), campos: tema, origen, status.
- tema: la duda redactada como una pregunta clara y reutilizable.
- origen: una oración que explique de dónde surge la duda.
- status: "derivado_a_mentoria".
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
