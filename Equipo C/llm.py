"""
Módulo del LLM con LangChain y Gemini para generación multicanal.
"""

import json
import os
from typing import Any, Optional
from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

PROMPT_BASE = """
Eres un editor profesional de testimonios para comunicación corporativa.
REGLAS OBLIGATORIAS:
- No inventes información, logros, cifras, nombres ni fechas.
- Conserva exactamente el significado original y la información factual del testimonio.
- Si el texto contiene afirmaciones ambiguas, no las completes con imaginación.
- Devuelve únicamente el texto final sin comentarios ni encabezados extra.
"""

PROMPT_MULTICANAL = ChatPromptTemplate.from_messages([
    (
        "system",
        PROMPT_BASE + """
Genera TRES versiones optimizadas del mismo testimonio en formato JSON:
- "linkedin": Profesional, humano y atractivo sin exagerar.
- "newsletter": Institucional, claro y conciso para boletines.
- "faq": Directo, informativo y claro.

Devuelve EXCLUSIVAMENTE un objeto JSON estructurado así:
{{"linkedin": "texto...", "newsletter": "texto...", "faq": "texto..."}}
No uses bloques de código Markdown (```json) ni explicaciones fuera del JSON.
"""
    ),
    ("user", "Categoría: {categoria}\nTestimonio original:\n{contenido}")
])


def crear_llm() -> ChatGoogleGenerativeAI:
    """Instancia el cliente Gemini con la API Key configurada."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("No se encontró GOOGLE_API_KEY en las variables de entorno.")

    return ChatGoogleGenerativeAI(
        model=os.getenv("GEMINI_MODEL", "gemini-1.5-flash"),
        google_api_key=api_key,
        temperature=0.7,
    )


def _extraer_texto(response: Any) -> str:
    """Extrae el contenido en texto plano del objeto devuelto por el LLM."""
    contenido = getattr(response, "content", response)
    if isinstance(contenido, list):
        partes = [item.get("text", "") if isinstance(item, dict) else str(item) for item in contenido]
        contenido = "".join(partes)
    return str(contenido).strip()


def _limpiar_y_parsear_json(texto: str) -> dict[str, str]:
    """Parseador seguro de JSON con eliminación de bloques Markdown."""
    if texto.startswith("```"):
        lineas = texto.splitlines()
        if lineas[0].startswith("```"):
            lineas = lineas[1:]
        if lineas and lineas[-1].strip() == "```":
            lineas = lineas[:-1]
        texto = "\n".join(lineas).strip()

    datos = json.loads(texto)
    if not isinstance(datos, dict):
        raise ValueError("La respuesta del LLM no es un JSON válido.")

    resultado = {}
    for canal in ("linkedin", "newsletter", "faq"):
        valor = datos.get(canal)
        if not isinstance(valor, str) or not valor.strip():
            raise ValueError(f"Se esperaba una cadena no vacía para el canal '{canal}'.")
        resultado[canal] = valor.strip()

    return resultado


def embellecer_testimonio_multicanal(
    texto: str,
    categoria: str,
    llm_client: Optional[Any] = None,
) -> tuple[dict[str, str], bool]:
    """
    Invocación multicanal de Gemini.
    Retorna (diccionario_de_textos, uso_fallback).
    """
    if not texto or not texto.strip():
        raise ValueError("El texto proporcionado está vacío.")

    try:
        cliente = llm_client or crear_llm()
        mensajes = PROMPT_MULTICANAL.format_messages(
            contenido=texto.strip(),
            categoria=categoria,
        )
        response = cliente.invoke(mensajes)
        raw_text = _extraer_texto(response)
        versiones = _limpiar_y_parsear_json(raw_text)
        return versiones, False

    except Exception as exc:
        print(f"[FALLBACK] Gemini falló: {exc}. Usando el texto original.")
        original = texto.strip()
        return {"linkedin": original, "newsletter": original, "faq": original}, True