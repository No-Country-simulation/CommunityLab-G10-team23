"""Inicio de sesión, registro por invitación y restablecimiento de contraseña."""

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.auth import service
from app.auth.dependencies import token_actual, usuario_actual
from app.contracts.auth import (
    RespuestaSesion,
    SolicitudLogin,
    SolicitudRegistro,
    SolicitudRestablecer,
    UsuarioPublico,
)

router = APIRouter()


def _http(error: service.ErrorAuth) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail=error.detail)


def _sesion(usuario: UsuarioPublico) -> RespuestaSesion:
    token, expira = service.crear_sesion(usuario.id)
    return RespuestaSesion(token=token, expira_en=expira, usuario=usuario)


@router.post("/login", response_model=RespuestaSesion)
def login(request: SolicitudLogin) -> RespuestaSesion:
    try:
        usuario = service.autenticar(request.email, request.password)
    except service.ErrorAuth as error:
        raise _http(error) from error
    return _sesion(usuario)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: str = Depends(token_actual)) -> Response:
    service.cerrar_sesion(token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UsuarioPublico)
def me(usuario: UsuarioPublico = Depends(usuario_actual)) -> UsuarioPublico:
    return usuario


@router.post("/registro", response_model=RespuestaSesion, status_code=status.HTTP_201_CREATED)
def registro(request: SolicitudRegistro) -> RespuestaSesion:
    """Crea la cuenta con un enlace de invitación y deja la sesión iniciada."""
    try:
        usuario = service.registrar_con_invitacion(request.token, request.nombre, request.password)
    except service.ErrorAuth as error:
        raise _http(error) from error
    return _sesion(usuario)


@router.post("/restablecer", status_code=status.HTTP_204_NO_CONTENT)
def restablecer(request: SolicitudRestablecer) -> Response:
    """Cambia la contraseña con un enlace de recuperación y cierra las sesiones abiertas."""
    try:
        service.restablecer_password(request.token, request.password)
    except service.ErrorAuth as error:
        raise _http(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
