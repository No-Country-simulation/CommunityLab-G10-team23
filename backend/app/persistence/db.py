"""Base SQLite de lotes, activos candidatos e historial de revisión (app.db).

Separada de auth.db para poder respaldar o vaciar los datos editoriales sin tocar las
cuentas; por eso guarda `usuario_id` y una copia del nombre, sin clave foránea a usuarios.
Vive en backend/data/ (en Docker, el volumen backend-data). Cada operación abre su propia
conexión, igual que app/auth/db.py. Asume un único proceso de backend; si un día hay varios,
este módulo y los repositorios que lo usan son lo único que cambia de motor.

Migraciones: cada entrada de _MIGRACIONES se aplica una vez, en orden, y PRAGMA
user_version guarda cuántas van. Para cambiar el esquema se agrega una entrada; nunca se
edita una que ya se aplicó.
"""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

_DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "app.db"
_initialized: set[str] = set()

_MIGRACIONES: list[str] = [
    # 1: lotes del equipo, sus interacciones procesadas, candidatos e historial de revisión.
    """
    CREATE TABLE lotes (
        id TEXT PRIMARY KEY,
        origen_comunidad TEXT NOT NULL,
        periodo_referencia TEXT NOT NULL,
        total INTEGER NOT NULL,
        estado TEXT NOT NULL,
        error TEXT,
        creado_por_id TEXT NOT NULL,
        creado_por_nombre TEXT NOT NULL,
        creado_en TEXT NOT NULL,
        publicado_por_id TEXT,
        publicado_por_nombre TEXT,
        publicado_en TEXT,
        ruta_objeto TEXT
    );
    CREATE INDEX idx_lotes_creado_en ON lotes(creado_en);

    CREATE TABLE items_lote (
        lote_id TEXT NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
        posicion INTEGER NOT NULL,
        interaccion_id TEXT NOT NULL,
        datos TEXT NOT NULL,
        PRIMARY KEY (lote_id, posicion)
    );

    CREATE TABLE candidatos (
        candidato_id TEXT PRIMARY KEY,
        lote_id TEXT REFERENCES lotes(id) ON DELETE CASCADE,
        interaccion_id TEXT,
        tipo_activo TEXT NOT NULL,
        contenido TEXT NOT NULL,
        estado_aprobacion TEXT NOT NULL,
        revisado_por_id TEXT,
        revisado_por_nombre TEXT,
        revisado_en TEXT,
        version INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX idx_candidatos_lote ON candidatos(lote_id);

    CREATE TABLE eventos_revision (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        candidato_id TEXT NOT NULL REFERENCES candidatos(candidato_id) ON DELETE CASCADE,
        accion TEXT NOT NULL,
        estado_anterior TEXT NOT NULL,
        estado_nuevo TEXT NOT NULL,
        usuario_id TEXT NOT NULL,
        nombre_usuario TEXT NOT NULL,
        en TEXT NOT NULL,
        contenido_anterior TEXT
    );
    CREATE INDEX idx_eventos_candidato ON eventos_revision(candidato_id);
    """,
]


def db_path() -> Path:
    """Se lee en cada llamada para que los tests puedan apuntar a una base temporal."""
    return Path(os.getenv("APP_DB_PATH") or _DEFAULT_PATH)


def _migrar(connection: sqlite3.Connection) -> None:
    # WAL: quien lee no bloquea a quien escribe (varias personas revisando a la vez).
    connection.execute("PRAGMA journal_mode = WAL")
    aplicadas = connection.execute("PRAGMA user_version").fetchone()[0]
    for numero, script in enumerate(_MIGRACIONES[aplicadas:], start=aplicadas + 1):
        connection.executescript(f"BEGIN;\n{script}\nPRAGMA user_version = {numero};\nCOMMIT;")


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """Conexión con transacción: confirma al salir sin errores y deshace si hay excepción."""
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        if str(path) not in _initialized:
            _migrar(connection)
            _initialized.add(str(path))
        with connection:
            yield connection
    finally:
        connection.close()


__all__ = ["connect", "db_path"]
