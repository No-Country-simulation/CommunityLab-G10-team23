"""Base SQLite de usuarios, sesiones e invitaciones.

Vive en backend/data/ (en Docker, el volumen backend-data) junto al resto de datos locales.
Cada operación abre su propia conexión: los endpoints síncronos de FastAPI corren en hilos.
"""

import os
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

_DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "auth.db"
_initialized: set[str] = set()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sesiones (
    token_hash TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creada_en TEXT NOT NULL,
    expira_en TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);

CREATE TABLE IF NOT EXISTS invitaciones (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    tipo TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE,
    rol TEXT NOT NULL,
    usuario_id TEXT REFERENCES usuarios(id) ON DELETE CASCADE,
    creada_por TEXT,
    creada_en TEXT NOT NULL,
    expira_en TEXT NOT NULL,
    usada_en TEXT
);
"""


def db_path() -> Path:
    """Se lee en cada llamada para que los tests puedan apuntar a una base temporal."""
    return Path(os.getenv("AUTH_DB_PATH") or _DEFAULT_PATH)


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
            connection.executescript(_SCHEMA)
            _initialized.add(str(path))
        with connection:
            yield connection
    finally:
        connection.close()


__all__ = ["connect", "db_path"]
