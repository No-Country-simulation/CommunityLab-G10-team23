"""Revisión en equipo: cualquier revisor decide, cada decisión queda firmada y el lote
publicado ya no se puede cambiar. La publicación es solo de admin y usa lo guardado."""

import json
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.auth.dependencies import usuario_actual
from app.contracts.auth import RolUsuario, UsuarioPublico
from app.contracts.enums import AssetCategory, EstadoTrabajo, TipoActivoOficial
from app.contracts.models import (
    ActivoCandidato,
    AnalisisInterno,
    Autoria,
    EnrutamientoInterno,
    InteraccionInterna,
    OportunidadInterna,
    SolicitudProcesamiento,
)
from app.main import app
from app.schemas.internal import ResultadoPipelineItem
from app.storage.oci_storage import _MockObjectStorageClient
from app.workflow import repository

client = TestClient(app)


def persona(usuario_id: str, nombre: str, rol: RolUsuario) -> UsuarioPublico:
    return UsuarioPublico(
        id=usuario_id,
        email=f"{usuario_id}@test.local",
        nombre=nombre,
        rol=rol,
        activo=True,
        creado_en=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )


PAULA = persona("usr_paula", "Paula Rojas", RolUsuario.revisor)
HUGO = persona("usr_hugo", "Hugo Méndez", RolUsuario.revisor)
ADMIN = persona("usr_admin", "Ana Admin", RolUsuario.admin)


def como(usuario: UsuarioPublico) -> None:
    app.dependency_overrides[usuario_actual] = lambda: usuario


@pytest.fixture
def lote() -> dict:
    """Lote subido por Paula, ya procesado, con un post de LinkedIn y un destaque pendientes."""
    autor = Autoria(usuario_id=PAULA.id, nombre=PAULA.nombre, en=datetime.now(timezone.utc))
    request = SolicitudProcesamiento(
        origen_comunidad="Discord",
        periodo_referencia="Semana_04",
        interacciones=[{"autor": "Mariana", "canal": "#logros", "tipo": "testimonio", "texto": "Conseguí empleo."}],
    )
    repository.crear_lote("job_equipo", request, autor)
    post = ActivoCandidato(
        tipo_activo=TipoActivoOficial.post_linkedin,
        contenido={"titulo": "Primer empleo", "copy": "Mariana consiguió empleo.", "potencial_engagement": "alto"},
    )
    destaque = ActivoCandidato(
        tipo_activo=TipoActivoOficial.destaque_newsletter_semanal,
        contenido={"seccion": "Logros", "titular": "Mariana", "resumen": "Primer empleo."},
    )
    item = ResultadoPipelineItem(
        interaccion=InteraccionInterna(autor="Mariana", canal="#logros", tipo="testimonio", texto="Conseguí empleo."),
        analisis=AnalisisInterno(
            sentimiento="positivo", sentimiento_score=0.9, temas=["empleo"], entidades=[], resumen="Empleo", intencion="logro"
        ),
        oportunidad=OportunidadInterna(categoria=AssetCategory.success_story, relevance_score=90),
        enrutamiento=EnrutamientoInterno(ruta="equipo_c.generar_activos", motivo="Historia de éxito"),
        activos_candidatos=[post, destaque],
    )
    repository.agregar_item("job_equipo", 0, item)
    repository.actualizar_estado("job_equipo", EstadoTrabajo.completado)
    return {"id": "job_equipo", "post": post.candidato_id, "destaque": destaque.candidato_id}


@pytest.fixture
def bucket(tmp_path):
    mock = _MockObjectStorageClient(storage_dir=tmp_path / "oci")
    with patch("app.storage.oci_storage.create_object_storage_client", return_value=mock):
        yield mock


def test_otro_revisor_puede_aprobar_el_lote_de_un_companero_y_queda_firmado(lote):
    como(HUGO)
    respuesta = client.patch(f"/api/v1/review/assets/{lote['post']}", json={"estado_aprobacion": "aprobado", "version": 1})

    assert respuesta.status_code == 200
    activo = respuesta.json()
    assert activo["estado_aprobacion"] == "aprobado"
    assert activo["revisado_por"]["usuario_id"] == HUGO.id
    assert activo["revisado_por"]["nombre"] == "Hugo Méndez"
    assert activo["version"] == 2


def test_la_autoria_sale_de_la_sesion_aunque_el_cuerpo_diga_otra_cosa(lote):
    como(HUGO)
    falso = {"usuario_id": "usr_otro", "nombre": "Impostor", "en": "2026-01-01T00:00:00Z"}
    respuesta = client.patch(
        f"/api/v1/review/assets/{lote['post']}",
        json={"estado_aprobacion": "rechazado", "revisado_por": falso},
    )

    assert respuesta.json()["revisado_por"]["usuario_id"] == HUGO.id


def test_el_lote_abierto_por_otra_persona_muestra_la_ultima_decision(lote):
    como(HUGO)
    client.patch(f"/api/v1/review/assets/{lote['post']}", json={"estado_aprobacion": "aprobado"})

    como(PAULA)
    trabajo = client.get(f"/api/v1/pipeline/jobs/{lote['id']}").json()
    candidatos = trabajo["interacciones_procesadas"][0]["activos_candidatos"]
    post = next(c for c in candidatos if c["candidato_id"] == lote["post"])

    assert trabajo["creado_por"]["nombre"] == "Paula Rojas"
    assert post["estado_aprobacion"] == "aprobado"
    assert post["revisado_por"]["nombre"] == "Hugo Méndez"


def test_version_desactualizada_responde_409_con_el_estado_actual(lote):
    como(HUGO)
    client.patch(f"/api/v1/review/assets/{lote['post']}", json={"estado_aprobacion": "rechazado", "version": 1})

    como(PAULA)
    respuesta = client.patch(f"/api/v1/review/assets/{lote['post']}", json={"estado_aprobacion": "aprobado", "version": 1})

    assert respuesta.status_code == 409
    actual = respuesta.json()["detail"]["actual"]
    assert actual["estado_aprobacion"] == "rechazado"
    assert actual["revisado_por"]["nombre"] == "Hugo Méndez"


def test_cambiar_una_decision_ajena_queda_en_el_historial(lote):
    como(HUGO)
    client.patch(f"/api/v1/review/assets/{lote['post']}", json={"estado_aprobacion": "rechazado"})
    como(PAULA)
    nuevo = {"titulo": "Primer empleo", "copy": "Texto corregido.", "potencial_engagement": "alto"}
    client.patch(f"/api/v1/review/assets/{lote['post']}", json={"estado_aprobacion": "aprobado", "contenido": nuevo})

    eventos = client.get(f"/api/v1/review/assets/{lote['post']}/historial").json()

    assert [(e["accion"], e["autor"]["nombre"]) for e in eventos] == [
        ("rechazar", "Hugo Méndez"),
        ("aprobar", "Paula Rojas"),
    ]
    assert eventos[1]["estado_anterior"] == "rechazado"
    assert eventos[1]["contenido_anterior"]["copy"] == "Mariana consiguió empleo."


def test_guardar_sin_cambios_no_genera_evento_ni_version(lote):
    como(HUGO)
    respuesta = client.patch(f"/api/v1/review/assets/{lote['post']}", json={"estado_aprobacion": "pendiente"})

    assert respuesta.json()["version"] == 1
    assert client.get(f"/api/v1/review/assets/{lote['post']}/historial").json() == []


def test_listado_de_lotes_del_equipo_cuenta_activos_por_estado(lote):
    como(HUGO)
    client.patch(f"/api/v1/review/assets/{lote['post']}", json={"estado_aprobacion": "aprobado"})

    lotes = client.get("/api/v1/pipeline/jobs", params={"sin_publicar": True}).json()

    assert [l["job_id"] for l in lotes] == [lote["id"]]
    assert lotes[0]["creado_por"]["nombre"] == "Paula Rojas"
    assert (lotes[0]["activos_pendientes"], lotes[0]["activos_aprobados"]) == (1, 1)


def test_solo_un_admin_puede_publicar(lote, bucket):
    como(PAULA)
    respuesta = client.post("/api/v1/storage/publish", json={"lote_id": lote["id"]})

    assert respuesta.status_code == 403


def test_publicar_usa_las_decisiones_guardadas_y_registra_la_auditoria(lote, bucket):
    como(HUGO)
    client.patch(f"/api/v1/review/assets/{lote['post']}", json={"estado_aprobacion": "aprobado"})

    como(ADMIN)
    respuesta = client.post("/api/v1/storage/publish", json={"lote_id": lote["id"]})

    assert respuesta.status_code == 200
    salida = respuesta.json()
    # Contrato externo intacto: sin autoría, y solo el activo aprobado pasa a distribución.
    assert set(salida) == {"status", "resumen_comunidad", "activos_distribucion_generados", "almacenamiento_oci"}
    activos = salida["activos_distribucion_generados"]
    assert activos["post_linkedin"]["copy"] == "Mariana consiguió empleo."
    assert activos.get("destaque_newsletter_semanal") is None

    ruta = salida["almacenamiento_oci"]["ruta_objeto"]
    guardado = json.loads(next((bucket.storage_dir).rglob("paquete-distribucion.json")).read_text(encoding="utf-8"))
    assert ruta.endswith("paquete-distribucion.json")
    assert guardado["auditoria"]["lote_id"] == lote["id"]
    assert guardado["auditoria"]["procesado_por"]["nombre"] == "Paula Rojas"
    assert guardado["auditoria"]["publicado_por"]["nombre"] == "Ana Admin"
    assert [r["nombre"] for r in guardado["auditoria"]["revisores"]] == ["Hugo Méndez"]
    assert "destaque_newsletter_semanal" not in guardado["activos_distribucion_generados"]


def test_lote_publicado_queda_cerrado(lote, bucket):
    como(ADMIN)
    assert client.post("/api/v1/storage/publish", json={"lote_id": lote["id"]}).status_code == 200

    como(HUGO)
    cambio = client.patch(f"/api/v1/review/assets/{lote['post']}", json={"estado_aprobacion": "aprobado"})
    como(ADMIN)
    de_nuevo = client.post("/api/v1/storage/publish", json={"lote_id": lote["id"]})

    assert cambio.status_code == 409
    assert de_nuevo.status_code == 409
    assert client.get("/api/v1/pipeline/jobs", params={"sin_publicar": True}).json() == []
    assert client.get(f"/api/v1/pipeline/jobs/{lote['id']}").json()["publicado_por"]["nombre"] == "Ana Admin"


def test_no_se_publica_un_lote_que_sigue_procesandose(lote, bucket):
    repository.actualizar_estado(lote["id"], EstadoTrabajo.en_proceso)
    como(ADMIN)

    assert client.post("/api/v1/storage/publish", json={"lote_id": lote["id"]}).status_code == 409


def test_publicar_un_lote_inexistente_responde_404(bucket):
    como(ADMIN)

    assert client.post("/api/v1/storage/publish", json={"lote_id": "job_nada"}).status_code == 404


def test_al_arrancar_los_lotes_a_medias_quedan_como_fallidos(lote):
    repository.actualizar_estado(lote["id"], EstadoTrabajo.en_proceso)

    assert repository.interrumpir_lotes_en_curso() == 1
    trabajo = repository.obtener_lote(lote["id"])
    assert trabajo.estado == EstadoTrabajo.fallido
    assert trabajo.procesadas == 1


def test_admin_elimina_un_lote_sin_publicar_con_todo_su_contenido(lote):
    como(HUGO)
    client.patch(f"/api/v1/review/assets/{lote['post']}", json={"estado_aprobacion": "aprobado"})

    como(ADMIN)
    respuesta = client.delete(f"/api/v1/pipeline/jobs/{lote['id']}")

    assert respuesta.status_code == 204
    assert client.get(f"/api/v1/pipeline/jobs/{lote['id']}").status_code == 404
    assert client.get("/api/v1/pipeline/jobs").json() == []
    assert client.get("/api/v1/review/assets", params={"lote_id": lote["id"]}).json() == []
    assert client.get(f"/api/v1/review/assets/{lote['post']}/historial").status_code == 404


def test_un_revisor_no_puede_eliminar_lotes(lote):
    como(PAULA)

    assert client.delete(f"/api/v1/pipeline/jobs/{lote['id']}").status_code == 403
    assert client.get(f"/api/v1/pipeline/jobs/{lote['id']}").status_code == 200


def test_no_se_elimina_un_lote_publicado_ni_uno_en_proceso(lote, bucket):
    como(ADMIN)
    repository.actualizar_estado(lote["id"], EstadoTrabajo.en_proceso)
    en_proceso = client.delete(f"/api/v1/pipeline/jobs/{lote['id']}")

    repository.actualizar_estado(lote["id"], EstadoTrabajo.completado)
    client.post("/api/v1/storage/publish", json={"lote_id": lote["id"]})
    publicado = client.delete(f"/api/v1/pipeline/jobs/{lote['id']}")

    assert (en_proceso.status_code, publicado.status_code) == (409, 409)
    assert client.get(f"/api/v1/pipeline/jobs/{lote['id']}").status_code == 200


def test_eliminar_un_lote_inexistente_responde_404():
    como(ADMIN)

    assert client.delete("/api/v1/pipeline/jobs/job_nada").status_code == 404
