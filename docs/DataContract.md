# Contratos de datos

El proyecto separa dos capas: el **contrato externo oficial** que consumen los clientes y los **contratos internos** que comparten los módulos/equipos. Los identificadores, marcas temporales, categorías y scores internos no se agregan al formato externo salvo que el contrato oficial se actualice.

Los modelos canónicos se mantienen en `backend/app/contracts/models.py` y sus enums en `backend/app/contracts/enums.py`. La API importa sus esquemas desde `backend/app/schemas/`.

## Entrada oficial

La solicitud incluye `origen_comunidad`, `periodo_referencia` y `interacciones`. Cada interacción tiene `autor`, `canal`, `tipo` y `texto`, todos cadenas. El lote admite un máximo de 500 elementos. Los clientes no envían `id` ni `timestamp`.

```json
{
	"origen_comunidad": "Discord_Grupo_ONE_G10",
	"periodo_referencia": "Semana_04",
	"interacciones": [
		{
			"autor": "Mariana Souza",
			"canal": "#logros-y-empleos",
			"tipo": "testimonio",
			"texto": "Quedé seleccionada para mi primer empleo de desarrollo."
		}
	]
}
```

`tipo` es texto libre de la fuente, puede ser incorrecto o variar de un canal a otro. Se conserva y puede darse como contexto, pero no debe usarse como verdad de clasificación. Sentimiento, temas, entidades e intención se derivan del texto.

## Contrato interno de ingesta/análisis implementado

`POST /api/v1/ingest/process` (solo Equipo A) devuelve `origen_comunidad`, `periodo_referencia` y `interacciones_procesadas`. Cada elemento contiene:

- `interaccion`: `id` generado, los campos originales y `timestamp` en UTC.
- `analisis`: `sentimiento`, `sentimiento_score` entre -1 y 1, `temas`, `entidades`, `resumen` e `intencion`.
- `degradado`: booleano; `true` indica que no se obtuvo análisis del LLM y se usó el fallback neutral.

El analizador hace hasta dos invocaciones en total (intento inicial más un reintento). Un fallo de una interacción no interrumpe el resto del lote. Los tests simulan al proveedor.

## Contrato interno del pipeline completo implementado

`POST /api/v1/pipeline/process` devuelve el mismo envoltorio (`origen_comunidad`, `periodo_referencia`, `interacciones_procesadas`), pero cada elemento (`ResultadoPipelineItem` en `app/schemas/internal.py`) extiende al de ingesta con:

- `oportunidad`: `OportunidadInterna` — `categoria` (`AssetCategory`) y `relevance_score` (0 a 100). `None` si la clasificación falló sin fallback posible.
- `enrutamiento`: `EnrutamientoInterno` — `ruta` y `motivo` elegidos por el grafo de Equipo B. `None` en el mismo caso anterior.
- `activos_candidatos`: lista de `ActivoCandidato` (puede estar vacía si la ruta no es `equipo_c.generar_activos` o si Equipo C falló).
- `error`: cadena opcional con el detalle de qué fase falló (`"Equipo A: ..."`, `"Equipo B: ..."`, `"Equipo C: ..."`, o varias combinadas), sin interrumpir el resto del lote.

Este es ya el **contrato interno real** entre A, B y C — no es prospectivo. Ver `docs/Architecture.md` para las reglas exactas de clasificación, score y ruteo que determinan estos valores.

## Contrato interno de revisión HITL en equipo

La revisión es del equipo: cualquier `revisor` puede abrir cualquier lote sin publicar y decidir sobre sus candidatos. La autoría (`Autoria{usuario_id, nombre, en}`) la sella siempre el backend con la sesión; nunca se acepta en el cuerpo de una petición.

- `GET /api/v1/pipeline/jobs?sin_publicar=true` devuelve `list[ResumenLote]`. Cada fila trae el lote, quién lo subió (`creado_por`) y cuántos activos están pendientes, aprobados y rechazados.
- `GET /api/v1/pipeline/jobs/{id}?desde=n` devuelve `TrabajoPipeline` con `creado_por`, `publicado_por` y cada candidato con su última decisión.
- `GET /api/v1/review/assets?lote_id=…` devuelve los `ActivoCandidato` guardados en `app.db`, con `lote_id` e `interaccion_id`.
- `PATCH /api/v1/review/assets/{candidato_id}` acepta `{"estado_aprobacion", "contenido"?, "version"?}`. La respuesta es el candidato con `revisado_por` y `version` nuevos.
  - Responde `409` con `detail: {mensaje, actual}` si la `version` ya no es la vigente (otra persona lo cambió).
  - Responde `409` con un mensaje si el lote ya se publicó.
  - Responde `404` si el id no existe.
- `GET /api/v1/review/assets/{candidato_id}/historial` devuelve los `EventoRevision` (acción, estado anterior y nuevo, autor, contenido anterior si se editó).

`ActivoCandidato.revisado_por`, `ActivoCandidato.version`, `TrabajoPipeline.creado_por`/`publicado_por`, `ResumenLote` y `EventoRevision` son **internos**: no aparecen en `RespuestaProcesamiento`.

## Contratos entre fases (A→B→C→D implementado)

1. **Equipo A → B:** `InteraccionInterna` más `AnalisisInterno`, pasados dentro del estado del grafo de clasificación (`app/workflow/classification_graph.py`).
2. **Equipo B → C:** `ResultadoAnalisisInterno`, que asocia `interaccion_id`, análisis, `oportunidad` (categoría y `relevance_score` de 0 a 100) y `enrutamiento` (ruta y motivo). Solo se invoca a Equipo C cuando `enrutamiento.ruta == "equipo_c.generar_activos"`.
3. **Equipo C → revisión:** los activos candidatos de cada interacción se guardan en `app.db` (`app/content/repository.py`) con su lote, y el equipo los aprueba o rechaza.
4. **Revisión → Equipo D:** `POST /api/v1/storage/publish {"lote_id"}`, **solo admin**.
   - Lee las decisiones guardadas; no las que envíe el cliente, y no aprueba nada automáticamente.
   - Aplica `armar_respuesta_externa`, sube el paquete a OCI y cierra el lote.
   - Responde `409` si el lote sigue procesándose o ya se publicó, y `404` si no existe.

La taxonomía interna de categorías está enumerada en `AssetCategory`; los tipos oficiales de activo son únicamente `post_linkedin`, `destaque_newsletter_semanal` y `sugerencia_contenido_faq`. Los activos no aprobados no pasan a distribución. La regla de desempate de `armar_respuesta_externa` selecciona, por cada clave oficial, el candidato **aprobado** con mayor `relevance_score` de la interacción que lo generó; si ninguno está aprobado, la clave se omite.

## Salida externa final

`POST /api/v1/storage/publish` devuelve el contrato oficial `RespuestaProcesamiento`: `status`, `resumen_comunidad`, `activos_distribucion_generados` (solo claves oficiales con candidato aprobado) y `almacenamiento_oci`.

El objeto guardado en el bucket (`activos/paquete_{N}/paquete-distribucion.json`) añade campos internos para el historial: `nombre_paquete`, `fecha_guardado`, `casos` y un bloque `auditoria`:

```json
"auditoria": {
  "lote_id": "job_…",
  "procesado_por": {"usuario_id": "…", "nombre": "…", "en": "…"},
  "publicado_por": {"usuario_id": "…", "nombre": "…", "en": "…"},
  "revisores": [{"usuario_id": "…", "nombre": "…", "en": "…"}]
}
```

`/api/v1/pipeline/process` y `/api/v1/review` siguen devolviendo los contratos internos descritos arriba, no el paquete final.

## Cambios de contrato

- Modifica los modelos canónicos compartidos; evita clases duplicadas en los equipos.
- Avisa a productores y consumidores antes de renombrar o quitar campos.
- Mantén la compatibilidad externa oficial, aunque el contrato interno necesite más metadatos.
- Actualiza las pruebas de contrato en `backend/tests/contracts/` y ejemplos versionados en `schemas/` cuando corresponda.
