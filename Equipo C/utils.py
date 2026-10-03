"""
Módulo de utilidades de archivo, validaciones y persistencia atómica.
"""

import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from enums import AssetCategory, EstadoAprobacion, TipoActivoOficial

BASE_DIR = Path(__file__).resolve().parent
INPUT_FILE = BASE_DIR / "testimonios.json"
OUTPUT_FILE = BASE_DIR / "activos_generados.json"

TIPOS_ACTIVO_OFICIALES = {t.value for t in TipoActivoOficial}


def obtener_texto_testimonio(testimonio: dict) -> str:
    """Extrae la clave de texto ('copy' o 'respuesta') de la entrada."""
    contenido = testimonio.get("contenido", {})
    texto = contenido.get("copy") or contenido.get("respuesta")
    if not texto:
        raise ValueError(
            f"El testimonio '{testimonio.get('interaccion_id')}' no contiene 'copy' ni 'respuesta'."
        )
    return texto.strip()


def validar_activo(candidato: dict) -> None:
    """Valida la presencia de campos obligatorios e integridad del enum de tipo de activo."""
    campos = {
        "interaccion_id",
        "categoria",
        "tipo_activo",
        "contenido",
        "estado_aprobacion",
        "candidato_id",
    }
    faltantes = campos - candidato.keys()
    if faltantes:
        raise ValueError(f"Activo inválido. Faltan campos: {sorted(faltantes)}")

    if candidato["tipo_activo"] not in TIPOS_ACTIVO_OFICIALES:
        raise ValueError(f"Tipo de activo no permitido: {candidato['tipo_activo']}")


def crear_objeto_activo(
    interaccion_id: str,
    categoria: str,
    tipo_activo: TipoActivoOficial,
    contenido: dict,
    uso_fallback: bool = False,
) -> dict:
    """Genera la estructura de candidato oficial con estado inicial 'pendiente'."""
    candidato = {
        "interaccion_id": interaccion_id,
        "categoria": categoria,
        "tipo_activo": tipo_activo.value,
        "contenido": contenido,
        "estado_aprobacion": EstadoAprobacion.pendiente.value,
        "candidato_id": str(uuid.uuid4()),
        "uso_fallback_llm": uso_fallback,
        "creado_en": datetime.now(timezone.utc).isoformat(),
    }
    validar_activo(candidato)
    return candidato


def cargar_json(ruta: Path) -> list[dict] | dict:
    """Lee archivos JSON con manejo de rutas inexistentes."""
    if not ruta.exists():
        return [] if ruta == INPUT_FILE else {"activos_candidatos": []}
    with ruta.open("r", encoding="utf-8") as f:
        return json.load(f)


def guardar_json_atomico(ruta: Path, datos: dict) -> None:
    """Guarda un JSON usando un archivo temporal para prevenir corrupción de archivos."""
    ruta.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f"{ruta.stem}_", suffix=".tmp", dir=ruta.parent, text=True)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(datos, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp_name, ruta)
    except Exception:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
        raise


def actualizar_activo_persistido(
    candidato_id: str,
    decision: EstadoAprobacion,
    nuevo_contenido: Optional[dict] = None,
    revisado_por: str = "usuario",
    ruta: Path = OUTPUT_FILE,
) -> None:
    """Actualiza la decisión del revisor o las ediciones directamente sobre la persistencia."""
    datos = cargar_json(ruta)
    activos = datos.get("activos_candidatos", [])

    for activo in activos:
        if activo["candidato_id"] == candidato_id:
            if nuevo_contenido is not None:
                activo["contenido"] = nuevo_contenido
            activo["estado_aprobacion"] = decision.value
            activo["revisado_por"] = revisado_por
            activo["revisado_en"] = datetime.now(timezone.utc).isoformat()
            validar_activo(activo)
            break

    guardar_json_atomico(ruta, datos)