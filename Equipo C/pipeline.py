"""
Módulo del pipeline de procesamiento de testimonios a activos de contenido.
"""

from typing import Any, Optional
from enums import AssetCategory, TipoActivoOficial
from llm import embellecer_testimonio_multicanal
from utils import (
    INPUT_FILE,
    OUTPUT_FILE,
    cargar_json,
    crear_objeto_activo,
    guardar_json_atomico,
    obtener_texto_testimonio,
)


def _formatear_contenido_canal(testimonio: dict, tipo: TipoActivoOficial, texto_mejorado: str) -> dict:
    """Adapta los nombres de campos requeridos para el objeto contenido de cada canal."""
    original = testimonio.get("contenido", {})
    
    if tipo == TipoActivoOficial.post_linkedin:
        return {
            "titulo": original.get("titulo") or original.get("seccion") or "Historia destacada",
            "copy": texto_mejorado,
            "canal_recomendado": "LinkedIn Oficial",
        }
    if tipo == TipoActivoOficial.destaque_newsletter_semanal:
        return {
            "seccion": original.get("seccion") or "Logro de la Semana",
            "copy": texto_mejorado,
            "canal_recomendado": "Newsletter",
        }
    if tipo == TipoActivoOficial.sugerencia_contenido_faq:
        return {
            "pregunta": original.get("pregunta") or original.get("titulo") or "Pregunta sugerida",
            "respuesta_sugerida": texto_mejorado,
            "canal_recomendado": "FAQ",
        }
    raise ValueError(f"Tipo de activo no soportado: {tipo}")


def ejecutar_pipeline(
    input_file=INPUT_FILE,
    output_file=OUTPUT_FILE,
    llm_client: Optional[Any] = None,
) -> dict:
    """Transforma testimonios en candidatos y los guarda en disco."""
    testimonios = cargar_json(input_file)
    activos_candidatos = []

    for testimonio in testimonios:
        interaccion_id = testimonio.get("interaccion_id")
        if not interaccion_id:
            continue

        raw_cat = testimonio.get("categoria", AssetCategory.general.value if hasattr(AssetCategory, "general") else "SUCCESS_STORY")
        # Intenta mapear a Enum oficial o mantiene la cadena
        try:
            categoria_val = AssetCategory(raw_cat).value
        except ValueError:
            categoria_val = str(raw_cat)

        texto_original = obtener_texto_testimonio(testimonio)

        versiones, uso_fallback = embellecer_testimonio_multicanal(
            texto=texto_original,
            categoria=categoria_val,
            llm_client=llm_client,
        )

        mapa_canales = [
            (TipoActivoOficial.post_linkedin, "linkedin"),
            (TipoActivoOficial.destaque_newsletter_semanal, "newsletter"),
            (TipoActivoOficial.sugerencia_contenido_faq, "faq"),
        ]

        for tipo_activo, canal_key in mapa_canales:
            contenido = _formatear_contenido_canal(testimonio, tipo_activo, versiones[canal_key])
            activo = crear_objeto_activo(
                interaccion_id=interaccion_id,
                categoria=categoria_val,
                tipo_activo=tipo_activo,
                contenido=contenido,
                uso_fallback=uso_fallback,
            )
            activos_candidatos.append(activo)

    resultado = {"activos_candidatos": activos_candidatos}
    guardar_json_atomico(output_file, resultado)
    return resultado