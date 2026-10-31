from unittest.mock import patch
from fastapi.testclient import TestClient

from app.contracts.enums import AssetCategory, EstadoAlmacenamientoOCI, EstadoRespuesta
from app.contracts.models import (
    AnalisisInterno,
    EnrutamientoInterno,
    InteraccionInterna,
    OportunidadInterna,
    SolicitudProcesamiento,
)
from app.main import app
from app.schemas.internal import ResultadoPipeline, ResultadoPipelineItem
from app.storage.oci_storage import (
    _MockObjectStorageClient,
    build_object_path,
    download_package,
    upload_package,
)
from app.storage.service import calcular_resumen_comunidad, publicar_lote_a_oci

client = TestClient(app)


def test_build_object_path_matches_official_hackathon_spec():
    path = build_object_path("Semana_04")
    assert path == "activos/semana_04/paquete-distribucion.json"

    path_with_spaces = build_object_path("2026 semana 04")
    assert path_with_spaces == "activos/2026_semana_04/paquete-distribucion.json"


def test_calcular_resumen_comunidad():
    items = [
        ResultadoPipelineItem(
            interaccion=InteraccionInterna(autor="Mariana", canal="#logros", tipo="testimonio", texto="Consegui empleo"),
            analisis=AnalisisInterno(
                sentimiento="positivo",
                sentimiento_score=0.9,
                temas=["contratacion", "portfolio"],
                entidades=["OCI"],
                resumen="Mariana consiguio empleo.",
                intencion="compartir_logro",
            ),
        ),
        ResultadoPipelineItem(
            interaccion=InteraccionInterna(autor="Lucas", canal="#dudas", tipo="pregunta", texto="Duda"),
            analisis=AnalisisInterno(
                sentimiento="positivo",
                sentimiento_score=0.6,
                temas=["contratacion", "LangGraph"],
                entidades=["LangGraph"],
                resumen="Duda tecnica.",
                intencion="solicitar_ejemplo",
            ),
        ),
    ]

    resumen = calcular_resumen_comunidad(items)
    assert resumen.total_interacciones_procesadas == 2
    assert resumen.sentimiento_predominante == "Altamente Positivo"
    assert "contratacion" in resumen.temas_principales


def test_upload_and_download_cycle_mock():
    mock_client = _MockObjectStorageClient()
    test_data = {"status": "exito", "mensaje": "prueba"}

    storage_res = upload_package(
        test_data,
        periodo_referencia="Semana_04",
        bucket_name="communitylab-test-bucket",
        namespace="test-ns",
        client=mock_client,
    )

    assert storage_res.bucket == "communitylab-test-bucket"
    assert storage_res.status == EstadoAlmacenamientoOCI.guardado_con_exito
    assert storage_res.ruta_objeto == "activos/semana_04/paquete-distribucion.json"

    retrieved = download_package(
        storage_res.ruta_objeto,
        bucket_name="communitylab-test-bucket",
        namespace="test-ns",
        client=mock_client,
    )
    assert retrieved == test_data


def test_publicar_lote_a_oci_assembles_official_response():
    request = SolicitudProcesamiento(
        origen_comunidad="Discord_Grupo_ONE_G10",
        periodo_referencia="Semana_04",
        interacciones=[
            {
                "autor": "Mariana Souza",
                "canal": "#logros",
                "tipo": "testimonio",
                "texto": "Quede seleccionada como desarrolladora de IA!",
            }
        ],
    )

    fake_items = [
        ResultadoPipelineItem(
            interaccion=InteraccionInterna(
                id="int_123",
                autor="Mariana Souza",
                canal="#logros",
                tipo="testimonio",
                texto="Quede seleccionada",
            ),
            analisis=AnalisisInterno(
                sentimiento="positivo",
                sentimiento_score=0.9,
                temas=["contratacion"],
                entidades=["OCI"],
                resumen="Seleccionada para puesto de IA",
                intencion="compartir_logro",
            ),
            oportunidad=OportunidadInterna(
                categoria=AssetCategory.success_story,
                relevance_score=95.0,
            ),
            enrutamiento=EnrutamientoInterno(
                ruta="equipo_c.generar_activos",
                motivo="Historia de exito relevante",
            ),
            activos_candidatos=[],
        )
    ]

    with patch("app.storage.service.process_batch") as mock_pipeline:
        mock_pipeline.return_value = ResultadoPipeline(
            origen_comunidad=request.origen_comunidad,
            periodo_referencia=request.periodo_referencia,
            interacciones_procesadas=fake_items,
        )

        res = publicar_lote_a_oci(request, client=_MockObjectStorageClient())

        assert res.status == EstadoRespuesta.exito
        assert res.resumen_comunidad.total_interacciones_procesadas == 1
        assert res.almacenamiento_oci.status == EstadoAlmacenamientoOCI.guardado_con_exito
        assert "semana_04" in res.almacenamiento_oci.ruta_objeto


def test_api_publish_endpoint():
    request_payload = {
        "origen_comunidad": "Discord_Grupo_ONE_G10",
        "periodo_referencia": "Semana_04",
        "interacciones": [
            {
                "autor": "Mariana Souza",
                "canal": "#logros",
                "tipo": "testimonio",
                "texto": "Quede seleccionada!",
            }
        ],
    }

    with patch("app.storage.service.process_batch") as mock_pipeline:
        mock_pipeline.return_value = ResultadoPipeline(
            origen_comunidad="Discord",
            periodo_referencia="Semana_04",
            interacciones_procesadas=[
                ResultadoPipelineItem(
                    interaccion=InteraccionInterna(autor="Mariana", canal="#logros", tipo="test", texto="Exito"),
                    analisis=AnalisisInterno(
                        sentimiento="positivo",
                        sentimiento_score=0.9,
                        temas=["empleo"],
                        entidades=["OCI"],
                        resumen="Exito laboral",
                        intencion="compartir_logro",
                    ),
                    oportunidad=OportunidadInterna(categoria=AssetCategory.success_story, relevance_score=90.0),
                    enrutamiento=EnrutamientoInterno(ruta="equipo_c.generar_activos", motivo="Exito"),
                )
            ],
        )
        response = client.post("/api/v1/storage/publish", json=request_payload)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "exito"
    assert data["resumen_comunidad"]["total_interacciones_procesadas"] == 1
    assert "almacenamiento_oci" in data
    assert data["almacenamiento_oci"]["status"] == "guardado_con_exito"


def test_api_storage_status():
    response = client.get("/api/v1/storage/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["bucket"] == "communitylab-activos-marketing"
    assert data["always_free_tier"] is True


def test_api_root_redirects_to_docs():
    response = client.get("/", follow_redirects=False)
    assert response.status_code in (307, 308, 302, 301)
    assert response.headers["location"] == "/docs"
