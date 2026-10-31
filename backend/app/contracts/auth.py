"""Contratos de autenticación y gestión de usuarios """

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

# Validación deliberadamente simple: el correo solo identifica la cuenta, no se envían mensajes.
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
# Límite superior para que una contraseña enorme no dispare el costo del hash.
PASSWORD_MIN = 12
PASSWORD_MAX = 128


class RolUsuario(str, Enum):
    """De mayor a menor privilegio: admin > revisor > lector."""

    admin = "admin"
    revisor = "revisor"
    lector = "lector"


class TipoInvitacion(str, Enum):
    registro = "registro"
    recuperacion = "recuperacion"


class UsuarioPublico(BaseModel):
    id: str
    email: str
    nombre: str
    rol: RolUsuario
    activo: bool
    creado_en: datetime


class SolicitudLogin(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=PASSWORD_MAX)


class RespuestaSesion(BaseModel):
    token: str
    expira_en: datetime
    usuario: UsuarioPublico


class SolicitudRegistro(BaseModel):
    token: str = Field(min_length=1, max_length=256)
    nombre: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)


class SolicitudRestablecer(BaseModel):
    token: str = Field(min_length=1, max_length=256)
    password: str = Field(min_length=PASSWORD_MIN, max_length=PASSWORD_MAX)


class SolicitudInvitacion(BaseModel):
    email: str = Field(max_length=254, pattern=EMAIL_PATTERN)
    rol: RolUsuario


class Invitacion(BaseModel):
    """Invitación o enlace de recuperación pendiente, sin el token."""

    id: str
    tipo: TipoInvitacion
    email: str
    rol: RolUsuario
    creada_en: datetime
    expira_en: datetime


class InvitacionCreada(Invitacion):
    """El token solo se devuelve una vez, al crearla; en la base se guarda su hash."""

    token: str


class ActualizacionUsuario(BaseModel):
    rol: RolUsuario | None = None
    activo: bool | None = None


__all__ = [
    "EMAIL_PATTERN",
    "PASSWORD_MIN",
    "PASSWORD_MAX",
    "RolUsuario",
    "TipoInvitacion",
    "UsuarioPublico",
    "SolicitudLogin",
    "RespuestaSesion",
    "SolicitudRegistro",
    "SolicitudRestablecer",
    "SolicitudInvitacion",
    "Invitacion",
    "InvitacionCreada",
    "ActualizacionUsuario",
]
