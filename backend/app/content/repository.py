"""Activos candidatos y su historial de revisión en SQLite (app.db).

La revisión es de equipo: cualquier revisor decide sobre cualquier candidato pendiente, y
cada cambio queda sellado con su autor. Los candidatos de un lote ya publicado en la nube
no se pueden modificar. Reemplaza al antiguo backend/data/activos_candidatos.json.
"""

import json
import sqlite3
from typing import Any

from app.contracts.enums import AccionRevision, EstadoAprobacion
from app.contracts.models import ActivoCandidato, Autoria, EventoRevision
from app.persistence.db import connect


class LotePublicadoError(Exception):
    """El candidato pertenece a un lote que ya se guardó en la nube."""


class ConflictoVersion(Exception):
    """Otra persona cambió el candidato después de que el revisor lo cargó."""

    def __init__(self, actual: dict[str, Any]) -> None:
        super().__init__("El activo cambió mientras lo revisabas")
        self.actual = actual


def _autoria(usuario_id: str | None, nombre: str | None, en: str | None) -> Autoria | None:
    if not usuario_id or not nombre or not en:
        return None
    return Autoria(usuario_id=usuario_id, nombre=nombre, en=en)


def _candidato(row: sqlite3.Row) -> ActivoCandidato:
    return ActivoCandidato(
        candidato_id=row["candidato_id"],
        tipo_activo=row["tipo_activo"],
        contenido=json.loads(row["contenido"]),
        estado_aprobacion=row["estado_aprobacion"],
        revisado_por=_autoria(row["revisado_por_id"], row["revisado_por_nombre"], row["revisado_en"]),
        version=row["version"],
    )


def _serializar(row: sqlite3.Row) -> dict[str, Any]:
    return {
        **_candidato(row).model_dump(mode="json"),
        "lote_id": row["lote_id"],
        "interaccion_id": row["interaccion_id"],
    }


def guardar_candidatos(lote_id: str | None, interaccion_id: str, candidatos: list[ActivoCandidato]) -> None:
    """Registra los candidatos que generó el Equipo C para una interacción."""
    if not candidatos:
        return
    with connect() as db:
        db.executemany(
            """
            INSERT INTO candidatos (candidato_id, lote_id, interaccion_id, tipo_activo, contenido, estado_aprobacion)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(candidato_id) DO NOTHING
            """,
            [
                (
                    c.candidato_id,
                    lote_id,
                    interaccion_id,
                    c.tipo_activo.value,
                    json.dumps(c.contenido, ensure_ascii=False),
                    c.estado_aprobacion.value,
                )
                for c in candidatos
            ],
        )


def list_assets(*, lote_id: str | None = None) -> list[dict[str, Any]]:
    with connect() as db:
        if lote_id is None:
            rows = db.execute("SELECT * FROM candidatos ORDER BY rowid").fetchall()
        else:
            rows = db.execute("SELECT * FROM candidatos WHERE lote_id = ? ORDER BY rowid", (lote_id,)).fetchall()
    return [_serializar(row) for row in rows]


def candidatos_del_lote(lote_id: str) -> dict[str, ActivoCandidato]:
    """Estado actual de los candidatos de un lote, por candidato_id."""
    with connect() as db:
        rows = db.execute("SELECT * FROM candidatos WHERE lote_id = ?", (lote_id,)).fetchall()
    return {row["candidato_id"]: _candidato(row) for row in rows}


def _accion(anterior: EstadoAprobacion, nuevo: EstadoAprobacion) -> AccionRevision:
    if anterior == nuevo:
        return AccionRevision.editar
    return {
        EstadoAprobacion.aprobado: AccionRevision.aprobar,
        EstadoAprobacion.rechazado: AccionRevision.rechazar,
        EstadoAprobacion.pendiente: AccionRevision.reabrir,
    }[nuevo]


def update_asset(
    candidate_id: str,
    *,
    status: EstadoAprobacion,
    autor: Autoria,
    content: dict[str, Any] | None = None,
    version: int | None = None,
) -> dict[str, Any]:
    """Aplica una decisión de revisión y la deja en el historial.

    `version` es la que vio el revisor; si no coincide con la actual, otra persona cambió
    el candidato y se lanza ConflictoVersion con el estado actual.
    """
    with connect() as db:
        row = db.execute(
            """
            SELECT c.*, l.publicado_en AS lote_publicado_en
            FROM candidatos c LEFT JOIN lotes l ON l.id = c.lote_id
            WHERE c.candidato_id = ?
            """,
            (candidate_id,),
        ).fetchone()
        if row is None:
            raise KeyError(f"No existe el candidato {candidate_id}")
        if row["lote_publicado_en"]:
            raise LotePublicadoError("El lote ya se publicó en la nube; sus activos no se pueden cambiar")
        if version is not None and version != row["version"]:
            raise ConflictoVersion(_serializar(row))

        anterior = EstadoAprobacion(row["estado_aprobacion"])
        contenido_anterior = json.loads(row["contenido"])
        contenido_nuevo = contenido_anterior if content is None else content
        if anterior == status and contenido_nuevo == contenido_anterior:
            return _serializar(row)

        en = autor.en.isoformat()
        cambio = db.execute(
            """
            UPDATE candidatos
            SET estado_aprobacion = ?, contenido = ?, revisado_por_id = ?, revisado_por_nombre = ?,
                revisado_en = ?, version = version + 1
            WHERE candidato_id = ? AND version = ?
            """,
            (
                status.value,
                json.dumps(contenido_nuevo, ensure_ascii=False),
                autor.usuario_id,
                autor.nombre,
                en,
                candidate_id,
                row["version"],
            ),
        )
        if cambio.rowcount == 0:
            actual = db.execute("SELECT * FROM candidatos WHERE candidato_id = ?", (candidate_id,)).fetchone()
            raise ConflictoVersion(_serializar(actual))

        db.execute(
            """
            INSERT INTO eventos_revision
                (candidato_id, accion, estado_anterior, estado_nuevo, usuario_id, nombre_usuario, en, contenido_anterior)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                candidate_id,
                _accion(anterior, status).value,
                anterior.value,
                status.value,
                autor.usuario_id,
                autor.nombre,
                en,
                json.dumps(contenido_anterior, ensure_ascii=False) if contenido_nuevo != contenido_anterior else None,
            ),
        )
        actualizado = db.execute("SELECT * FROM candidatos WHERE candidato_id = ?", (candidate_id,)).fetchone()
    return _serializar(actualizado)


def historial(candidate_id: str) -> list[EventoRevision]:
    """Eventos de revisión de un candidato, del más antiguo al más reciente."""
    with connect() as db:
        if db.execute("SELECT 1 FROM candidatos WHERE candidato_id = ?", (candidate_id,)).fetchone() is None:
            raise KeyError(f"No existe el candidato {candidate_id}")
        rows = db.execute(
            "SELECT * FROM eventos_revision WHERE candidato_id = ? ORDER BY id", (candidate_id,)
        ).fetchall()
    return [
        EventoRevision(
            candidato_id=row["candidato_id"],
            accion=row["accion"],
            estado_anterior=row["estado_anterior"],
            estado_nuevo=row["estado_nuevo"],
            autor=Autoria(usuario_id=row["usuario_id"], nombre=row["nombre_usuario"], en=row["en"]),
            contenido_anterior=json.loads(row["contenido_anterior"]) if row["contenido_anterior"] else None,
        )
        for row in rows
    ]


def revisores_del_lote(lote_id: str) -> list[Autoria]:
    """Cada persona que revisó algún candidato del lote, con la fecha de su última acción."""
    with connect() as db:
        rows = db.execute(
            """
            SELECT e.usuario_id, e.nombre_usuario, MAX(e.en) AS en
            FROM eventos_revision e JOIN candidatos c ON c.candidato_id = e.candidato_id
            WHERE c.lote_id = ?
            GROUP BY e.usuario_id
            ORDER BY en
            """,
            (lote_id,),
        ).fetchall()
    return [Autoria(usuario_id=r["usuario_id"], nombre=r["nombre_usuario"], en=r["en"]) for r in rows]


__all__ = [
    "ConflictoVersion",
    "LotePublicadoError",
    "candidatos_del_lote",
    "guardar_candidatos",
    "historial",
    "list_assets",
    "revisores_del_lote",
    "update_asset",
]
