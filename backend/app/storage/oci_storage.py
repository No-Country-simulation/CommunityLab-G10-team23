"""Cliente y utilidades de almacenamiento para OCI Object Storage (Equipo D)."""

import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from app.contracts.enums import EstadoAlmacenamientoOCI
from app.contracts.models import AlmacenamientoOCI

load_dotenv()

DEFAULT_BUCKET = os.getenv("OCI_BUCKET_NAME", "communitylab-activos-marketing")
DEFAULT_NAMESPACE = os.getenv("OCI_NAMESPACE", "axrmv8bsyp2r")
DEFAULT_REGION = os.getenv("OCI_REGION", "sa-vinhedo-1")
MOCK_STORAGE_DIR = Path(__file__).resolve().parents[2] / "data" / "oci_mock"


def get_namespace() -> str:
    return os.getenv("OCI_NAMESPACE", DEFAULT_NAMESPACE)


def get_bucket_name() -> str:
    return os.getenv("OCI_BUCKET_NAME", DEFAULT_BUCKET)


def build_object_path(periodo_referencia: str) -> str:
    """Genera la ruta estándar exigida por el contrato oficial del hackathon.
    Ejemplo: activos/Semana_04/paquete-distribucion.json
    """
    clean_periodo = periodo_referencia.strip().replace(" ", "_").lower()
    return f"activos/{clean_periodo}/paquete-distribucion.json"


class _MockObjectStorageClient:
    """Almacén local de respaldo para pruebas y desarrollo offline."""

    def __init__(self, storage_dir: Path = MOCK_STORAGE_DIR) -> None:
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def put_object(self, namespace_name: str, bucket_name: str, object_name: str, put_object_body: bytes) -> Any:
        target = self.storage_dir / namespace_name / bucket_name / object_name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(put_object_body)
        return True

    def get_object(self, namespace_name: str, bucket_name: str, object_name: str) -> Any:
        target = self.storage_dir / namespace_name / bucket_name / object_name
        if not target.exists():
            raise FileNotFoundError(f"Objeto no encontrado en mock OCI: {object_name}")
        data = target.read_bytes()

        class _MockResponse:
            def __init__(self, content: bytes) -> None:
                self.data = type("DataWrapper", (), {"content": content})()

        return _MockResponse(data)


def create_object_storage_client() -> Any:
    """Inicializa el cliente de OCI Object Storage.
    Soporta:
    1. Instance Principals (cuando corre dentro de una VM de OCI)
    2. Archivo de configuración (~/.oci/config)
    3. Variables de entorno individuales
    4. Modo Mock local para pruebas sin credenciales
    """
    # Si se desactiva explícitamente OCI o se está en modo test/mock
    if os.getenv("OCI_MOCK_STORAGE", "").lower() in ("true", "1", "yes"):
        return _MockObjectStorageClient()

    try:
        import oci

        # 1. Intentar con variables de entorno explícitas
        tenancy = os.getenv("OCI_TENANCY_OCID")
        user = os.getenv("OCI_USER_OCID")
        fingerprint = os.getenv("OCI_FINGERPRINT")
        key_file = os.getenv("OCI_KEY_FILE")
        key_content = os.getenv("OCI_KEY_CONTENT")
        region = os.getenv("OCI_REGION", DEFAULT_REGION)

        if tenancy and user and fingerprint and (key_file or key_content):
            config = {
                "tenancy": tenancy,
                "user": user,
                "fingerprint": fingerprint,
                "region": region,
            }
            if key_file:
                config["key_file"] = key_file
            else:
                config["key_content"] = key_content
            return oci.object_storage.ObjectStorageClient(config)

        # 2. Intentar archivo de configuración local estándar (~/.oci/config)
        config_file_path = os.getenv("OCI_CONFIG_FILE", oci.config.DEFAULT_LOCATION)
        if os.path.exists(os.path.expanduser(config_file_path)):
            config = oci.config.from_file(file_location=config_file_path)
            return oci.object_storage.ObjectStorageClient(config)

        # 3. Intentar Instance Principals (máquina virtual de OCI con IAM Policy)
        try:
            signer = oci.auth.signers.InstancePrincipalsSecurityTokenSigner()
            return oci.object_storage.ObjectStorageClient(config={"region": region}, signer=signer)
        except Exception:
            pass

    except Exception:
        pass

    # 4. Fallback automático a Mock si no hay credenciales OCI configuradas
    return _MockObjectStorageClient()


def upload_package(
    package_data: dict[str, Any],
    *,
    periodo_referencia: str,
    bucket_name: str | None = None,
    namespace: str | None = None,
    client: Any | None = None,
) -> AlmacenamientoOCI:
    """Serializa el paquete oficial a JSON y lo persiste en OCI Object Storage."""
    client = client or create_object_storage_client()
    bucket = bucket_name or get_bucket_name()
    ns = namespace or get_namespace()
    object_path = build_object_path(periodo_referencia)

    json_bytes = json.dumps(package_data, ensure_ascii=False, indent=2).encode("utf-8")

    client.put_object(
        namespace_name=ns,
        bucket_name=bucket,
        object_name=object_path,
        put_object_body=json_bytes,
    )

    return AlmacenamientoOCI(
        bucket=bucket,
        ruta_objeto=object_path,
        status=EstadoAlmacenamientoOCI.guardado_con_exito,
    )


def download_package(
    object_path: str,
    *,
    bucket_name: str | None = None,
    namespace: str | None = None,
    client: Any | None = None,
) -> dict[str, Any]:
    """Recupera un paquete JSON guardado en OCI Object Storage."""
    client = client or create_object_storage_client()
    bucket = bucket_name or get_bucket_name()
    ns = namespace or get_namespace()

    response = client.get_object(
        namespace_name=ns,
        bucket_name=bucket,
        object_name=object_path,
    )
    raw_content = response.data.content if hasattr(response.data, "content") else response.data
    return json.loads(raw_content.decode("utf-8"))


__all__ = [
    "DEFAULT_BUCKET",
    "DEFAULT_NAMESPACE",
    "get_namespace",
    "get_bucket_name",
    "build_object_path",
    "create_object_storage_client",
    "upload_package",
    "download_package",
]
