"""Hash de contraseñas, tokens opacos y límite de intentos de inicio de sesión."""

import hashlib
import secrets
import threading
import time

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# Argon2id con los parámetros mínimos de OWASP (19 MiB, 2 iteraciones, 1 hilo):
# las VM Always Free tienen 1 GB de RAM y cada login concurrente reserva esa memoria.
_hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)

# Hash de referencia para que un correo inexistente tarde lo mismo que uno real.
_DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))

MAX_INTENTOS = 5
VENTANA_BLOQUEO_SEGUNDOS = 15 * 60


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Los tokens son aleatorios de 256 bits: basta SHA-256 (no hace falta un hash lento)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class LimiteIntentos:
    """Cuenta fallos por correo (exista o no la cuenta) en memoria del proceso.

    Igual que los trabajos del pipeline, asume un único worker de Uvicorn y se
    reinicia con el backend. El límite por IP del cliente corresponde al BFF,
    que es quien conoce la IP real.
    """

    def __init__(self, maximo: int = MAX_INTENTOS, ventana: int = VENTANA_BLOQUEO_SEGUNDOS) -> None:
        self.maximo = maximo
        self.ventana = ventana
        self._fallos: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _recientes(self, clave: str, ahora: float) -> list[float]:
        recientes = [t for t in self._fallos.get(clave, []) if ahora - t < self.ventana]
        if recientes:
            self._fallos[clave] = recientes
        else:
            self._fallos.pop(clave, None)
        return recientes

    def bloqueado(self, clave: str) -> bool:
        with self._lock:
            return len(self._recientes(clave.lower(), time.monotonic())) >= self.maximo

    def registrar_fallo(self, clave: str) -> None:
        with self._lock:
            ahora = time.monotonic()
            self._fallos[clave.lower()] = [*self._recientes(clave.lower(), ahora), ahora]

    def limpiar(self, clave: str | None = None) -> None:
        with self._lock:
            if clave is None:
                self._fallos.clear()
            else:
                self._fallos.pop(clave.lower(), None)


limite_login = LimiteIntentos()


__all__ = [
    "MAX_INTENTOS",
    "VENTANA_BLOQUEO_SEGUNDOS",
    "hash_password",
    "verify_password",
    "new_token",
    "hash_token",
    "LimiteIntentos",
    "limite_login",
]
