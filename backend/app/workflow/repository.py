"""Lotes del equipo en SQLite (app.db): quién los subió, su avance y si ya se publicaron.

Un lote es un trabajo del pipeline (`job_id`). Sus interacciones procesadas se guardan
a medida que salen, así que sobreviven a un reinicio del backend y cualquier revisor puede
abrirlas. El estado de revisión de los candidatos vive en app/content/repository.py y se
superpone al leer, para que todos vean la última decisión.
"""

from app.content.repository import candidatos_del_lote, guardar_candidatos
from app.contracts.enums import EstadoAprobacion, EstadoTrabajo
from app.contracts.models import Autoria, SolicitudProcesamiento
from app.persistence.db import connect
from app.schemas.internal import ResultadoPipelineItem, ResumenLote, TrabajoPipeline

_EN_CURSO = (EstadoTrabajo.en_cola.value, EstadoTrabajo.en_proceso.value)


def _autoria(usuario_id: str | None, nombre: str | None, en: str | None) -> Autoria | None:
    if not usuario_id or not nombre or not en:
        return None
    return Autoria(usuario_id=usuario_id, nombre=nombre, en=en)


def crear_lote(lote_id: str, request: SolicitudProcesamiento, autor: Autoria) -> None:
    with connect() as db:
        db.execute(
            """
            INSERT INTO lotes (id, origen_comunidad, periodo_referencia, total, estado,
                               creado_por_id, creado_por_nombre, creado_en)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                lote_id,
                request.origen_comunidad,
                request.periodo_referencia,
                len(request.interacciones),
                EstadoTrabajo.en_cola.value,
                autor.usuario_id,
                autor.nombre,
                autor.en.isoformat(),
            ),
        )


def actualizar_estado(lote_id: str, estado: EstadoTrabajo, *, error: str | None = None) -> None:
    with connect() as db:
        db.execute("UPDATE lotes SET estado = ?, error = ? WHERE id = ?", (estado.value, error, lote_id))


def agregar_item(lote_id: str, posicion: int, item: ResultadoPipelineItem) -> None:
    """Guarda una interacción procesada y registra sus candidatos para revisión."""
    with connect() as db:
        db.execute(
            "INSERT INTO items_lote (lote_id, posicion, interaccion_id, datos) VALUES (?, ?, ?, ?)",
            (lote_id, posicion, item.interaccion.id, item.model_dump_json()),
        )
    guardar_candidatos(lote_id, item.interaccion.id, item.activos_candidatos)


def _items(lote_id: str, desde: int = 0) -> list[ResultadoPipelineItem]:
    with connect() as db:
        rows = db.execute(
            "SELECT datos FROM items_lote WHERE lote_id = ? AND posicion >= ? ORDER BY posicion",
            (lote_id, desde),
        ).fetchall()
    items = [ResultadoPipelineItem.model_validate_json(row["datos"]) for row in rows]
    actuales = candidatos_del_lote(lote_id)
    for item in items:
        item.activos_candidatos = [actuales.get(c.candidato_id, c) for c in item.activos_candidatos]
    return items


def items_del_lote(lote_id: str) -> list[ResultadoPipelineItem]:
    """Todas las interacciones del lote con la última decisión de revisión de cada candidato."""
    return _items(lote_id)


def obtener_lote(lote_id: str, *, desde: int = 0) -> TrabajoPipeline | None:
    with connect() as db:
        row = db.execute("SELECT * FROM lotes WHERE id = ?", (lote_id,)).fetchone()
        if row is None:
            return None
        procesadas = db.execute("SELECT COUNT(*) FROM items_lote WHERE lote_id = ?", (lote_id,)).fetchone()[0]
    return TrabajoPipeline(
        job_id=row["id"],
        estado=row["estado"],
        origen_comunidad=row["origen_comunidad"],
        periodo_referencia=row["periodo_referencia"],
        total=row["total"],
        procesadas=procesadas,
        desde=desde,
        interacciones_procesadas=_items(lote_id, desde),
        error=row["error"],
        creado_por=_autoria(row["creado_por_id"], row["creado_por_nombre"], row["creado_en"]),
        publicado_por=_autoria(row["publicado_por_id"], row["publicado_por_nombre"], row["publicado_en"]),
    )


def listar_lotes(*, sin_publicar: bool = False, limite: int = 50) -> list[ResumenLote]:
    """Lotes del equipo, del más reciente al más antiguo, con el conteo de candidatos por estado."""
    filtro = "WHERE l.publicado_en IS NULL" if sin_publicar else ""
    with connect() as db:
        rows = db.execute(
            f"""
            SELECT l.*,
                (SELECT COUNT(*) FROM items_lote i WHERE i.lote_id = l.id) AS procesadas,
                (SELECT COUNT(*) FROM candidatos c WHERE c.lote_id = l.id AND c.estado_aprobacion = ?) AS pendientes,
                (SELECT COUNT(*) FROM candidatos c WHERE c.lote_id = l.id AND c.estado_aprobacion = ?) AS aprobados,
                (SELECT COUNT(*) FROM candidatos c WHERE c.lote_id = l.id AND c.estado_aprobacion = ?) AS rechazados
            FROM lotes l {filtro}
            ORDER BY l.creado_en DESC
            LIMIT ?
            """,
            (
                EstadoAprobacion.pendiente.value,
                EstadoAprobacion.aprobado.value,
                EstadoAprobacion.rechazado.value,
                limite,
            ),
        ).fetchall()
    return [
        ResumenLote(
            job_id=row["id"],
            estado=row["estado"],
            origen_comunidad=row["origen_comunidad"],
            periodo_referencia=row["periodo_referencia"],
            total=row["total"],
            procesadas=row["procesadas"],
            creado_por=_autoria(row["creado_por_id"], row["creado_por_nombre"], row["creado_en"]),
            publicado_por=_autoria(row["publicado_por_id"], row["publicado_por_nombre"], row["publicado_en"]),
            activos_pendientes=row["pendientes"],
            activos_aprobados=row["aprobados"],
            activos_rechazados=row["rechazados"],
        )
        for row in rows
    ]


def marcar_publicado(lote_id: str, autor: Autoria, ruta_objeto: str) -> bool:
    """Cierra el lote. Devuelve False si otra petición ya lo había publicado."""
    with connect() as db:
        cambio = db.execute(
            """
            UPDATE lotes SET publicado_por_id = ?, publicado_por_nombre = ?, publicado_en = ?, ruta_objeto = ?
            WHERE id = ? AND publicado_en IS NULL
            """,
            (autor.usuario_id, autor.nombre, autor.en.isoformat(), ruta_objeto, lote_id),
        )
    return cambio.rowcount == 1


def interrumpir_lotes_en_curso() -> int:
    """Al arrancar, ningún lote puede seguir procesándose: los hilos murieron con el proceso."""
    with connect() as db:
        cambio = db.execute(
            f"UPDATE lotes SET estado = ?, error = ? WHERE estado IN ({', '.join('?' for _ in _EN_CURSO)})",
            (
                EstadoTrabajo.fallido.value,
                "El servidor se reinició antes de terminar; las interacciones ya analizadas se conservan.",
                *_EN_CURSO,
            ),
        )
    return cambio.rowcount


__all__ = [
    "actualizar_estado",
    "agregar_item",
    "crear_lote",
    "interrumpir_lotes_en_curso",
    "items_del_lote",
    "listar_lotes",
    "marcar_publicado",
    "obtener_lote",
]
