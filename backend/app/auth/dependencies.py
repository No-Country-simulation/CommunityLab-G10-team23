"""Dependencias de FastAPI para exigir sesión y rol en los endpoints."""

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.service import usuario_por_token
from app.contracts.auth import RolUsuario, UsuarioPublico

# auto_error=False: respondemos 401 con nuestro propio mensaje. También habilita "Authorize" en Swagger.
bearer = HTTPBearer(auto_error=False, description="Token de sesión devuelto por POST /api/v1/auth/login")

_NIVEL = {RolUsuario.lector: 1, RolUsuario.revisor: 2, RolUsuario.admin: 3}


def token_actual(credenciales: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if credenciales is None or not credenciales.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inicia sesión para continuar",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credenciales.credentials


def usuario_actual(token: str = Depends(token_actual)) -> UsuarioPublico:
    usuario = usuario_por_token(token)
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu sesión terminó. Inicia sesión de nuevo.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return usuario


def requiere_rol(minimo: RolUsuario) -> Callable[..., UsuarioPublico]:
    """Permite el rol indicado y los superiores (admin > revisor > lector)."""

    def dependencia(usuario: UsuarioPublico = Depends(usuario_actual)) -> UsuarioPublico:
        if _NIVEL[usuario.rol] < _NIVEL[minimo]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu rol no tiene permiso para esta acción",
            )
        return usuario

    return dependencia


requiere_lector = requiere_rol(RolUsuario.lector)
requiere_revisor = requiere_rol(RolUsuario.revisor)
requiere_admin = requiere_rol(RolUsuario.admin)


__all__ = [
    "bearer",
    "token_actual",
    "usuario_actual",
    "requiere_rol",
    "requiere_lector",
    "requiere_revisor",
    "requiere_admin",
]
