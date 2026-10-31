import io
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from app.auth import crear_admin, service
from app.auth.db import connect
from app.auth.security import MAX_INTENTOS
from app.contracts.auth import RolUsuario

from .conftest import PASSWORD


def _vencer(tabla: str) -> None:
    pasado = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(timespec="microseconds")
    with connect() as db:
        db.execute(f"UPDATE {tabla} SET expira_en = ?", (pasado,))


# --- Login, sesión y logout ---------------------------------------------------------------


def test_login_returns_opaque_token_and_me_returns_user(client, crear_cuenta, login):
    crear_cuenta("Ana@Ejemplo.com", RolUsuario.revisor, nombre="Ana")

    headers = login("ana@ejemplo.com")
    me = client.get("/api/v1/auth/me", headers=headers)

    assert me.status_code == 200
    assert me.json()["email"] == "ana@ejemplo.com"
    assert me.json()["rol"] == "revisor"
    assert "password_hash" not in me.json()
    token = headers["Authorization"].removeprefix("Bearer ")
    with connect() as db:
        guardados = [row[0] for row in db.execute("SELECT token_hash FROM sesiones")]
    assert token not in guardados and len(guardados) == 1


def test_wrong_password_and_unknown_email_get_the_same_error(client, crear_cuenta):
    crear_cuenta("ana@ejemplo.com", RolUsuario.revisor)

    mala = client.post("/api/v1/auth/login", json={"email": "ana@ejemplo.com", "password": "otra-clave-xx"})
    inexistente = client.post("/api/v1/auth/login", json={"email": "nadie@ejemplo.com", "password": PASSWORD})

    assert mala.status_code == inexistente.status_code == 401
    assert mala.json() == inexistente.json()


@pytest.mark.parametrize("email", ["ana@ejemplo.com", "nadie@ejemplo.com"])
def test_repeated_failures_lock_the_email_even_if_it_does_not_exist(client, crear_cuenta, email):
    crear_cuenta("ana@ejemplo.com", RolUsuario.revisor)
    for _ in range(MAX_INTENTOS):
        assert client.post("/api/v1/auth/login", json={"email": email, "password": "incorrecta-123"}).status_code == 401

    bloqueado = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})

    assert bloqueado.status_code == 429


def test_logout_invalidates_the_token(client, crear_cuenta, login):
    crear_cuenta("ana@ejemplo.com", RolUsuario.lector)
    headers = login("ana@ejemplo.com")

    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_expired_session_is_rejected(client, crear_cuenta, login):
    crear_cuenta("ana@ejemplo.com", RolUsuario.lector)
    headers = login("ana@ejemplo.com")
    _vencer("sesiones")

    response = client.get("/api/v1/auth/me", headers=headers)

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_session_is_extended_when_used_after_half_its_lifetime(client, crear_cuenta, login):
    crear_cuenta("ana@ejemplo.com", RolUsuario.lector)
    headers = login("ana@ejemplo.com")
    casi = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(timespec="microseconds")
    with connect() as db:
        db.execute("UPDATE sesiones SET expira_en = ?", (casi,))

    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    with connect() as db:
        expira = datetime.fromisoformat(db.execute("SELECT expira_en FROM sesiones").fetchone()[0])
    assert expira - datetime.now(timezone.utc) > timedelta(hours=11)


# --- Protección de los endpoints existentes -----------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/api/v1/review/assets"),
        ("get", "/api/v1/pipeline/jobs/job_x"),
        ("post", "/api/v1/pipeline/jobs"),
        ("post", "/api/v1/ingest/process"),
        ("get", "/api/v1/storage/packages"),
        ("get", "/api/v1/storage/status"),
        ("post", "/api/v1/storage/publish"),
        ("get", "/api/v1/usuarios"),
        ("get", "/api/v1/auth/me"),
    ],
)
def test_protected_endpoints_require_a_session(client, method, path):
    response = getattr(client, method)(path)

    assert response.status_code == 401


def test_health_stays_public(client):
    assert client.get("/health").status_code == 200


def test_lector_can_read_packages_but_not_review_or_manage_users(client, crear_cuenta, login):
    crear_cuenta("lector@ejemplo.com", RolUsuario.lector)
    headers = login("lector@ejemplo.com")

    with patch("app.api.v1.storage.list_published_packages", return_value=[]):
        assert client.get("/api/v1/storage/packages", headers=headers).status_code == 200
    assert client.get("/api/v1/review/assets", headers=headers).status_code == 403
    assert client.post("/api/v1/storage/publish", headers=headers, json={}).status_code == 403
    assert client.get("/api/v1/usuarios", headers=headers).status_code == 403


def test_revisor_can_review_but_not_publish_or_manage_users(client, crear_cuenta, login):
    crear_cuenta("revisor@ejemplo.com", RolUsuario.revisor)
    headers = login("revisor@ejemplo.com")

    with patch("app.api.v1.review.list_assets", return_value=[]):
        assert client.get("/api/v1/review/assets", headers=headers).status_code == 200
    assert client.post("/api/v1/storage/publish", headers=headers, json={"lote_id": "job_x"}).status_code == 403
    assert client.get("/api/v1/usuarios", headers=headers).status_code == 403
    assert client.post(
        "/api/v1/usuarios/invitaciones", headers=headers, json={"email": "x@ejemplo.com", "rol": "admin"}
    ).status_code == 403


# --- Invitaciones y registro --------------------------------------------------------------


def _invitar(client, headers, email="nueva@ejemplo.com", rol="revisor"):
    response = client.post("/api/v1/usuarios/invitaciones", headers=headers, json={"email": email, "rol": rol})
    assert response.status_code == 201, response.text
    return response.json()


def test_invitation_creates_account_with_its_role_and_cannot_be_reused(client, crear_cuenta, login):
    crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    admin = login("admin@ejemplo.com")
    invitacion = _invitar(client, admin)

    registro = client.post(
        "/api/v1/auth/registro", json={"token": invitacion["token"], "nombre": "Nueva", "password": PASSWORD}
    )
    repetido = client.post(
        "/api/v1/auth/registro", json={"token": invitacion["token"], "nombre": "Otra", "password": PASSWORD}
    )

    assert registro.status_code == 201
    assert registro.json()["usuario"]["rol"] == "revisor"
    assert registro.json()["usuario"]["email"] == "nueva@ejemplo.com"
    assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {registro.json()['token']}"}).status_code == 200
    assert repetido.status_code == 400
    assert client.get("/api/v1/usuarios/invitaciones", headers=admin).json() == []


def test_expired_or_replaced_invitation_is_rejected(client, crear_cuenta, login):
    crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    admin = login("admin@ejemplo.com")
    primera = _invitar(client, admin)
    segunda = _invitar(client, admin)

    reemplazada = client.post(
        "/api/v1/auth/registro", json={"token": primera["token"], "nombre": "N", "password": PASSWORD}
    )
    _vencer("invitaciones")
    vencida = client.post(
        "/api/v1/auth/registro", json={"token": segunda["token"], "nombre": "N", "password": PASSWORD}
    )

    assert reemplazada.status_code == 400
    assert vencida.status_code == 400


def test_invitation_list_never_exposes_tokens(client, crear_cuenta, login):
    crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    admin = login("admin@ejemplo.com")
    _invitar(client, admin)

    pendientes = client.get("/api/v1/usuarios/invitaciones", headers=admin).json()

    assert len(pendientes) == 1 and "token" not in pendientes[0]


def test_cannot_invite_an_existing_email_or_register_with_a_short_password(client, crear_cuenta, login):
    crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    admin = login("admin@ejemplo.com")

    existente = client.post(
        "/api/v1/usuarios/invitaciones", headers=admin, json={"email": "ADMIN@ejemplo.com", "rol": "lector"}
    )
    invitacion = _invitar(client, admin)
    corta = client.post("/api/v1/auth/registro", json={"token": invitacion["token"], "nombre": "N", "password": "corta"})

    assert existente.status_code == 409
    assert corta.status_code == 422


def test_revoked_invitation_cannot_be_used(client, crear_cuenta, login):
    crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    admin = login("admin@ejemplo.com")
    invitacion = _invitar(client, admin)

    assert client.delete(f"/api/v1/usuarios/invitaciones/{invitacion['id']}", headers=admin).status_code == 204
    assert client.post(
        "/api/v1/auth/registro", json={"token": invitacion["token"], "nombre": "N", "password": PASSWORD}
    ).status_code == 400


# --- Recuperación de contraseña -----------------------------------------------------------


def test_password_reset_changes_password_and_closes_sessions(client, crear_cuenta, login):
    crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    ana = crear_cuenta("ana@ejemplo.com", RolUsuario.revisor)
    admin = login("admin@ejemplo.com")
    sesion_vieja = login("ana@ejemplo.com")

    enlace = client.post(f"/api/v1/usuarios/{ana.id}/recuperacion", headers=admin).json()
    nueva = "otra-clave-muy-segura"
    assert client.post("/api/v1/auth/restablecer", json={"token": enlace["token"], "password": nueva}).status_code == 204

    assert client.get("/api/v1/auth/me", headers=sesion_vieja).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "ana@ejemplo.com", "password": PASSWORD}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "ana@ejemplo.com", "password": nueva}).status_code == 200
    assert client.post(
        "/api/v1/auth/restablecer", json={"token": enlace["token"], "password": nueva}
    ).status_code == 400


def test_registration_token_cannot_be_used_to_reset_a_password(client, crear_cuenta, login):
    crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    admin = login("admin@ejemplo.com")
    invitacion = _invitar(client, admin)

    response = client.post("/api/v1/auth/restablecer", json={"token": invitacion["token"], "password": PASSWORD})

    assert response.status_code == 400


# --- Gestión de usuarios ------------------------------------------------------------------


def test_deactivating_a_user_closes_sessions_and_blocks_login(client, crear_cuenta, login):
    crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    ana = crear_cuenta("ana@ejemplo.com", RolUsuario.revisor)
    admin = login("admin@ejemplo.com")
    sesion = login("ana@ejemplo.com")

    response = client.patch(f"/api/v1/usuarios/{ana.id}", headers=admin, json={"activo": False})

    assert response.status_code == 200 and response.json()["activo"] is False
    assert client.get("/api/v1/auth/me", headers=sesion).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "ana@ejemplo.com", "password": PASSWORD}).status_code == 401


def test_role_change_takes_effect_on_next_login(client, crear_cuenta, login):
    crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    ana = crear_cuenta("ana@ejemplo.com", RolUsuario.revisor)
    admin = login("admin@ejemplo.com")
    sesion = login("ana@ejemplo.com")

    client.patch(f"/api/v1/usuarios/{ana.id}", headers=admin, json={"rol": "lector"})

    assert client.get("/api/v1/auth/me", headers=sesion).status_code == 401
    assert client.get("/api/v1/auth/me", headers=login("ana@ejemplo.com")).json()["rol"] == "lector"


def test_admin_cannot_change_own_role_or_deactivate_self(client, crear_cuenta, login):
    yo = crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    admin = login("admin@ejemplo.com")

    assert client.patch(f"/api/v1/usuarios/{yo.id}", headers=admin, json={"rol": "lector"}).status_code == 409
    assert client.patch(f"/api/v1/usuarios/{yo.id}", headers=admin, json={"activo": False}).status_code == 409


def test_service_keeps_at_least_one_active_admin(crear_cuenta):
    unico = crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    otro = crear_cuenta("revisor@ejemplo.com", RolUsuario.revisor)

    with pytest.raises(service.Conflicto):
        service.actualizar_usuario(otro, unico.id, service.ActualizacionUsuario(activo=False))


def test_unknown_user_returns_404(client, crear_cuenta, login):
    crear_cuenta("admin@ejemplo.com", RolUsuario.admin)
    admin = login("admin@ejemplo.com")

    assert client.patch("/api/v1/usuarios/usr_x", headers=admin, json={"rol": "lector"}).status_code == 404


# --- Primer administrador -----------------------------------------------------------------


def test_crear_admin_command_creates_first_admin(monkeypatch, client):
    monkeypatch.setattr("sys.stdin", io.StringIO(PASSWORD + "\n"))

    codigo = crear_admin.main(["--email", "root@ejemplo.com", "--nombre", "Root", "--password-stdin"])

    assert codigo == 0
    sesion = client.post("/api/v1/auth/login", json={"email": "root@ejemplo.com", "password": PASSWORD})
    assert sesion.json()["usuario"]["rol"] == "admin"


def test_crear_admin_rejects_short_password_and_duplicates(monkeypatch, crear_cuenta):
    crear_cuenta("root@ejemplo.com", RolUsuario.admin)

    monkeypatch.setattr("sys.stdin", io.StringIO("corta"))
    assert crear_admin.main(["--email", "otro@ejemplo.com", "--nombre", "O", "--password-stdin"]) == 1
    monkeypatch.setattr("sys.stdin", io.StringIO(PASSWORD))
    assert crear_admin.main(["--email", "root@ejemplo.com", "--nombre", "R", "--password-stdin"]) == 1
