"""Gestión de usuarios e invitaciones (solo administradores)."""

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.auth import service
from app.auth.dependencies import requiere_admin
from app.contracts.auth import (
    ActualizacionUsuario,
    Invitacion,
    InvitacionCreada,
    SolicitudInvitacion,
    UsuarioPublico,
)

# El router se registra en main.py con la dependencia requiere_admin; aquí se repite
# solo donde hace falta el usuario que actúa.
router = APIRouter()


def _http(error: service.ErrorAuth) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail=error.detail)


@router.get("", response_model=list[UsuarioPublico])
def listar_usuarios() -> list[UsuarioPublico]:
    return service.listar_usuarios()


@router.patch("/{usuario_id}", response_model=UsuarioPublico)
def actualizar_usuario(
    usuario_id: str,
    cambios: ActualizacionUsuario,
    admin: UsuarioPublico = Depends(requiere_admin),
) -> UsuarioPublico:
    try:
        return service.actualizar_usuario(admin, usuario_id, cambios)
    except service.ErrorAuth as error:
        raise _http(error) from error


@router.post("/{usuario_id}/recuperacion", response_model=InvitacionCreada, status_code=status.HTTP_201_CREATED)
def crear_recuperacion(usuario_id: str, admin: UsuarioPublico = Depends(requiere_admin)) -> InvitacionCreada:
    """Genera un enlace de un solo uso para que la persona defina una contraseña nueva."""
    try:
        return service.crear_recuperacion(usuario_id, creada_por=admin.id)
    except service.ErrorAuth as error:
        raise _http(error) from error


@router.get("/invitaciones", response_model=list[Invitacion])
def listar_invitaciones() -> list[Invitacion]:
    return service.listar_invitaciones_pendientes()


@router.post("/invitaciones", response_model=InvitacionCreada, status_code=status.HTTP_201_CREATED)
def crear_invitacion(
    request: SolicitudInvitacion, admin: UsuarioPublico = Depends(requiere_admin)
) -> InvitacionCreada:
    """El token se devuelve una sola vez; el administrador comparte el enlace con la persona."""
    try:
        return service.crear_invitacion(request.email, request.rol, creada_por=admin.id)
    except service.ErrorAuth as error:
        raise _http(error) from error


@router.delete("/invitaciones/{invitacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def revocar_invitacion(invitacion_id: str) -> Response:
    try:
        service.revocar_invitacion(invitacion_id)
    except service.ErrorAuth as error:
        raise _http(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
