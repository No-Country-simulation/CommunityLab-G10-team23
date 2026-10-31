import pytest
from fastapi.testclient import TestClient

from app.auth import service
from app.contracts.auth import RolUsuario, UsuarioPublico
from app.main import app

PASSWORD = "clave-segura-de-prueba"


@pytest.fixture(autouse=True)
def sesion_simulada():
    """Sin sesión simulada: aquí se prueba la autenticación real."""
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def crear_cuenta():
    def _crear(email: str, rol: RolUsuario, nombre: str = "Persona") -> UsuarioPublico:
        return service.crear_usuario(email, nombre, rol, PASSWORD)

    return _crear


@pytest.fixture
def login(client):
    def _login(email: str, password: str = PASSWORD) -> dict[str, str]:
        response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert response.status_code == 200, response.text
        return {"Authorization": f"Bearer {response.json()['token']}"}

    return _login
