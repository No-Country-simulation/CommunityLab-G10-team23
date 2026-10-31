"""Reglas de negocio de usuarios, sesiones e invitaciones."""

import sqlite3
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.auth.db import connect
from app.auth.security import hash_password, hash_token, limite_login, new_token, verify_password
from app.contracts.auth import (
    ActualizacionUsuario,
    Invitacion,
    InvitacionCreada,
    RolUsuario,
    TipoInvitacion,
    UsuarioPublico,
)

# Sesión deslizante: caduca tras 12 h sin uso y, en cualquier caso, a los 7 días de creada.
SESION_INACTIVIDAD = timedelta(hours=12)
SESION_MAXIMA = timedelta(days=7)
VIGENCIA = {
    TipoInvitacion.registro: timedelta(hours=72),
    TipoInvitacion.recuperacion: timedelta(hours=24),
}


class ErrorAuth(Exception):
    """Error de negocio con el código HTTP que debe devolver la API."""

    status_code = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class CredencialesInvalidas(ErrorAuth):
    status_code = 401


class DemasiadosIntentos(ErrorAuth):
    status_code = 429


class NoEncontrado(ErrorAuth):
    status_code = 404


class Conflicto(ErrorAuth):
    status_code = 409


class TokenInvalido(ErrorAuth):
    status_code = 400


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.isoformat(timespec="microseconds")


def _dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _normalizar_email(email: str) -> str:
    return email.strip().lower()


def _usuario(row: sqlite3.Row) -> UsuarioPublico:
    return UsuarioPublico(
        id=row["id"],
        email=row["email"],
        nombre=row["nombre"],
        rol=RolUsuario(row["rol"]),
        activo=bool(row["activo"]),
        creado_en=_dt(row["creado_en"]),
    )


def _invitacion(row: sqlite3.Row) -> Invitacion:
    return Invitacion(
        id=row["id"],
        tipo=TipoInvitacion(row["tipo"]),
        email=row["email"],
        rol=RolUsuario(row["rol"]),
        creada_en=_dt(row["creada_en"]),
        expira_en=_dt(row["expira_en"]),
    )


# --- Usuarios -----------------------------------------------------------------------------


def crear_usuario(email: str, nombre: str, rol: RolUsuario, password: str) -> UsuarioPublico:
    email = _normalizar_email(email)
    usuario_id = f"usr_{uuid4().hex}"
    try:
        with connect() as db:
            db.execute(
                "INSERT INTO usuarios (id, email, nombre, rol, password_hash, activo, creado_en)"
                " VALUES (?, ?, ?, ?, ?, 1, ?)",
                (usuario_id, email, nombre.strip(), rol.value, hash_password(password), _iso(_now())),
            )
    except sqlite3.IntegrityError as error:
        raise Conflicto(f"Ya existe una cuenta con el correo {email}") from error
    return obtener_usuario(usuario_id)


def obtener_usuario(usuario_id: str) -> UsuarioPublico:
    with connect() as db:
        row = db.execute("SELECT * FROM usuarios WHERE id = ?", (usuario_id,)).fetchone()
    if row is None:
        raise NoEncontrado(f"No existe el usuario {usuario_id}")
    return _usuario(row)


def listar_usuarios() -> list[UsuarioPublico]:
    with connect() as db:
        rows = db.execute("SELECT * FROM usuarios ORDER BY creado_en").fetchall()
    return [_usuario(row) for row in rows]


def actualizar_usuario(
    actor: UsuarioPublico, usuario_id: str, cambios: ActualizacionUsuario
) -> UsuarioPublico:
    """Cambia rol o estado. Nadie se modifica a sí mismo y siempre queda un admin activo."""
    if usuario_id == actor.id and (cambios.rol is not None or cambios.activo is not None):
        raise Conflicto("No puedes cambiar tu propio rol ni desactivar tu propia cuenta")

    with connect() as db:
        row = db.execute("SELECT * FROM usuarios WHERE id = ?", (usuario_id,)).fetchone()
        if row is None:
            raise NoEncontrado(f"No existe el usuario {usuario_id}")

        rol = cambios.rol.value if cambios.rol is not None else row["rol"]
        activo = int(cambios.activo) if cambios.activo is not None else row["activo"]

        deja_de_ser_admin = row["rol"] == RolUsuario.admin.value and row["activo"] and (
            rol != RolUsuario.admin.value or not activo
        )
        if deja_de_ser_admin:
            otros = db.execute(
                "SELECT COUNT(*) FROM usuarios WHERE rol = ? AND activo = 1 AND id != ?",
                (RolUsuario.admin.value, usuario_id),
            ).fetchone()[0]
            if otros == 0:
                raise Conflicto("Debe quedar al menos un administrador activo")

        db.execute("UPDATE usuarios SET rol = ?, activo = ? WHERE id = ?", (rol, activo, usuario_id))
        if not activo or rol != row["rol"]:
            # Un cambio de permisos obliga a iniciar sesión de nuevo.
            db.execute("DELETE FROM sesiones WHERE usuario_id = ?", (usuario_id,))
    return obtener_usuario(usuario_id)


# --- Sesiones -----------------------------------------------------------------------------


def autenticar(email: str, password: str) -> UsuarioPublico:
    """Mismo error para correo inexistente, contraseña incorrecta o cuenta desactivada."""
    email = _normalizar_email(email)
    if limite_login.bloqueado(email):
        raise DemasiadosIntentos("Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.")

    with connect() as db:
        row = db.execute("SELECT * FROM usuarios WHERE email = ?", (email,)).fetchone()

    valido = verify_password(row["password_hash"] if row else None, password)
    if not valido or row is None or not row["activo"]:
        limite_login.registrar_fallo(email)
        raise CredencialesInvalidas("Correo o contraseña incorrectos")

    limite_login.limpiar(email)
    return _usuario(row)


def crear_sesion(usuario_id: str) -> tuple[str, datetime]:
    token = new_token()
    ahora = _now()
    expira = ahora + SESION_INACTIVIDAD
    with connect() as db:
        db.execute("DELETE FROM sesiones WHERE expira_en < ?", (_iso(ahora),))
        db.execute(
            "INSERT INTO sesiones (token_hash, usuario_id, creada_en, expira_en) VALUES (?, ?, ?, ?)",
            (hash_token(token), usuario_id, _iso(ahora), _iso(expira)),
        )
    return token, expira


def usuario_por_token(token: str) -> UsuarioPublico | None:
    """Valida la sesión y extiende su vigencia si se usa (sin pasar el máximo absoluto)."""
    token_hash = hash_token(token)
    ahora = _now()
    with connect() as db:
        row = db.execute(
            "SELECT s.creada_en AS sesion_creada, s.expira_en AS sesion_expira, u.*"
            " FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ?",
            (token_hash,),
        ).fetchone()
        if row is None:
            return None
        limite = _dt(row["sesion_creada"]) + SESION_MAXIMA
        if _dt(row["sesion_expira"]) <= ahora or limite <= ahora or not row["activo"]:
            db.execute("DELETE FROM sesiones WHERE token_hash = ?", (token_hash,))
            return None
        # Renovar solo pasada la mitad de la vigencia evita escribir en cada petición.
        if _dt(row["sesion_expira"]) - ahora < SESION_INACTIVIDAD / 2:
            nueva = min(ahora + SESION_INACTIVIDAD, limite)
            db.execute("UPDATE sesiones SET expira_en = ? WHERE token_hash = ?", (_iso(nueva), token_hash))
    return _usuario(row)


def cerrar_sesion(token: str) -> None:
    with connect() as db:
        db.execute("DELETE FROM sesiones WHERE token_hash = ?", (hash_token(token),))


# --- Invitaciones y recuperación ----------------------------------------------------------


def _crear_token_invitacion(
    tipo: TipoInvitacion, email: str, rol: RolUsuario, creada_por: str | None, usuario_id: str | None
) -> InvitacionCreada:
    token = new_token()
    ahora = _now()
    invitacion_id = f"inv_{uuid4().hex}"
    with connect() as db:
        # Un enlace nuevo anula los anteriores del mismo tipo para ese correo.
        db.execute(
            "DELETE FROM invitaciones WHERE email = ? AND tipo = ? AND usada_en IS NULL",
            (email, tipo.value),
        )
        db.execute(
            "INSERT INTO invitaciones (id, token_hash, tipo, email, rol, usuario_id, creada_por, creada_en, expira_en)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                invitacion_id,
                hash_token(token),
                tipo.value,
                email,
                rol.value,
                usuario_id,
                creada_por,
                _iso(ahora),
                _iso(ahora + VIGENCIA[tipo]),
            ),
        )
    return InvitacionCreada(
        id=invitacion_id,
        tipo=tipo,
        email=email,
        rol=rol,
        creada_en=ahora,
        expira_en=ahora + VIGENCIA[tipo],
        token=token,
    )


def crear_invitacion(email: str, rol: RolUsuario, creada_por: str) -> InvitacionCreada:
    email = _normalizar_email(email)
    with connect() as db:
        existe = db.execute("SELECT 1 FROM usuarios WHERE email = ?", (email,)).fetchone()
    if existe:
        raise Conflicto(f"Ya existe una cuenta con el correo {email}")
    return _crear_token_invitacion(TipoInvitacion.registro, email, rol, creada_por, None)


def crear_recuperacion(usuario_id: str, creada_por: str) -> InvitacionCreada:
    usuario = obtener_usuario(usuario_id)
    return _crear_token_invitacion(
        TipoInvitacion.recuperacion, usuario.email, usuario.rol, creada_por, usuario.id
    )


def listar_invitaciones_pendientes() -> list[Invitacion]:
    with connect() as db:
        rows = db.execute(
            "SELECT * FROM invitaciones WHERE usada_en IS NULL AND expira_en > ? ORDER BY creada_en DESC",
            (_iso(_now()),),
        ).fetchall()
    return [_invitacion(row) for row in rows]


def revocar_invitacion(invitacion_id: str) -> None:
    with connect() as db:
        borradas = db.execute(
            "DELETE FROM invitaciones WHERE id = ? AND usada_en IS NULL", (invitacion_id,)
        ).rowcount
    if not borradas:
        raise NoEncontrado(f"No existe una invitación pendiente {invitacion_id}")


def _consumir(db: sqlite3.Connection, token: str, tipo: TipoInvitacion) -> sqlite3.Row:
    """Marca el token como usado dentro de la transacción del llamador (un solo uso)."""
    ahora = _iso(_now())
    row = db.execute(
        "SELECT * FROM invitaciones WHERE token_hash = ? AND tipo = ?", (hash_token(token), tipo.value)
    ).fetchone()
    if row is None or row["usada_en"] is not None or row["expira_en"] <= ahora:
        raise TokenInvalido("El enlace no es válido, ya se usó o caducó. Pide uno nuevo al administrador.")
    db.execute("UPDATE invitaciones SET usada_en = ? WHERE id = ?", (ahora, row["id"]))
    return row


def registrar_con_invitacion(token: str, nombre: str, password: str) -> UsuarioPublico:
    usuario_id = f"usr_{uuid4().hex}"
    with connect() as db:
        invitacion = _consumir(db, token, TipoInvitacion.registro)
        try:
            db.execute(
                "INSERT INTO usuarios (id, email, nombre, rol, password_hash, activo, creado_en)"
                " VALUES (?, ?, ?, ?, ?, 1, ?)",
                (
                    usuario_id,
                    invitacion["email"],
                    nombre.strip(),
                    invitacion["rol"],
                    hash_password(password),
                    _iso(_now()),
                ),
            )
        except sqlite3.IntegrityError as error:
            raise Conflicto(f"Ya existe una cuenta con el correo {invitacion['email']}") from error
    return obtener_usuario(usuario_id)


def restablecer_password(token: str, password: str) -> None:
    with connect() as db:
        invitacion = _consumir(db, token, TipoInvitacion.recuperacion)
        actualizados = db.execute(
            "UPDATE usuarios SET password_hash = ? WHERE id = ?",
            (hash_password(password), invitacion["usuario_id"]),
        ).rowcount
        if not actualizados:
            raise TokenInvalido("La cuenta de este enlace ya no existe")
        # Cambiar la contraseña cierra todas las sesiones abiertas de la cuenta.
        db.execute("DELETE FROM sesiones WHERE usuario_id = ?", (invitacion["usuario_id"],))
    limite_login.limpiar(invitacion["email"])


__all__ = [
    "ErrorAuth",
    "CredencialesInvalidas",
    "DemasiadosIntentos",
    "NoEncontrado",
    "Conflicto",
    "TokenInvalido",
    "SESION_INACTIVIDAD",
    "SESION_MAXIMA",
    "crear_usuario",
    "obtener_usuario",
    "listar_usuarios",
    "actualizar_usuario",
    "autenticar",
    "crear_sesion",
    "usuario_por_token",
    "cerrar_sesion",
    "crear_invitacion",
    "crear_recuperacion",
    "listar_invitaciones_pendientes",
    "revocar_invitacion",
    "registrar_con_invitacion",
    "restablecer_password",
]
