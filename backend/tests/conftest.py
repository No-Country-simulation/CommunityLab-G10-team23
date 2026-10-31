from datetime import datetime, timezone

import pytest

from app.auth.dependencies import usuario_actual
from app.auth.security import limite_login
from app.contracts.auth import RolUsuario, UsuarioPublico
from app.main import app

ADMIN_SIMULADO = UsuarioPublico(
    id="usr_test_admin",
    email="admin@test.local",
    nombre="Admin de pruebas",
    rol=RolUsuario.admin,
    activo=True,
    creado_en=datetime(2026, 1, 1, tzinfo=timezone.utc),
)


@pytest.fixture(autouse=True)
def _auth_db_temporal(tmp_path, monkeypatch):
    """Ningún test escribe en backend/data/auth.db."""
    monkeypatch.setenv("AUTH_DB_PATH", str(tmp_path / "auth.db"))
    limite_login.limpiar()
    yield
    limite_login.limpiar()


@pytest.fixture(autouse=True)
def sesion_simulada():
    """Los tests de las fases A–D no prueban la autenticación: actúan como un admin.

    tests/auth/ redefine este fixture para probar el flujo real.
    """
    app.dependency_overrides[usuario_actual] = lambda: ADMIN_SIMULADO
    yield
    app.dependency_overrides.pop(usuario_actual, None)
