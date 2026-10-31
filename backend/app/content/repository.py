import json
import os
import tempfile
from pathlib import Path
from typing import Any

from app.contracts.enums import EstadoAprobacion
from app.contracts.models import ResultadoGeneracionInterno


_STORAGE_FILE = Path(__file__).resolve().parents[2] / "data" / "activos_candidatos.json"


def _read() -> list[dict[str, Any]]:
    if not _STORAGE_FILE.exists():
        return []
    with _STORAGE_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def _write(assets: list[dict[str, Any]]) -> None:
    _STORAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix="activos_",
        suffix=".tmp",
        dir=_STORAGE_FILE.parent,
        text=True,
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as file:
            json.dump(assets, file, ensure_ascii=False, indent=2)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary_name, _STORAGE_FILE)
    except Exception:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)
        raise


def list_assets() -> list[dict[str, Any]]:
    return _read()


def upsert_generation_result(result: ResultadoGeneracionInterno) -> None:
    assets = _read()
    by_id = {asset["candidato_id"]: asset for asset in assets}
    for candidate in result.activos_candidatos:
        by_id[candidate.candidato_id] = candidate.model_dump(mode="json")
    _write(list(by_id.values()))


def update_asset(
    candidate_id: str,
    *,
    status: EstadoAprobacion,
    content: dict[str, Any] | None = None,
) -> dict[str, Any]:
    assets = _read()
    for asset in assets:
        if asset["candidato_id"] == candidate_id:
            if content is not None:
                asset["contenido"] = content
            asset["estado_aprobacion"] = status.value
            _write(assets)
            return asset
    raise KeyError(f"No existe el candidato {candidate_id}")


__all__ = ["list_assets", "upsert_generation_result", "update_asset"]
