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

## Contrato interno de revisión HITL implementado

`GET /api/v1/review/assets` devuelve la lista completa de `ActivoCandidato` persistidos (serializados a `dict`), tal como se guardaron en `backend/data/activos_candidatos.json`. `PATCH /api/v1/review/assets/{candidato_id}` acepta `{"estado_aprobacion": "pendiente" | "aprobado" | "rechazado", "contenido": {...}}` (`contenido` opcional, mismo shape que el campo original del candidato) y devuelve el candidato actualizado o `404` si el id no existe.

## Contratos entre fases (Equipo A→B→C implementado; D objetivo)

El flujo conecta hoy:

1. **Equipo A → B (implementado):** `InteraccionInterna` más `AnalisisInterno`, pasados dentro del estado del grafo de clasificación (`app/workflow/classification_graph.py`).
2. **Equipo B → C (implementado):** `ResultadoAnalisisInterno`, que asocia `interaccion_id`, análisis, `oportunidad` (categoría y `relevance_score` de 0 a 100) y `enrutamiento` (ruta y motivo). Solo se invoca a Equipo C cuando `enrutamiento.ruta == "equipo_c.generar_activos"`.
3. **Equipo C → D (pendiente de integrar):** `ResultadoGeneracionInterno` con activos candidatos, tipo de activo, contenido y estado de aprobación — hoy se persiste en JSON local vía `app/content/repository.py`, no en OCI.
4. **Equipo D → cliente (objetivo, no implementado):** paquete externo final, luego de seleccionar los activos aprobados y persistir el resultado según el contrato acordado. La función `armar_respuesta_externa` (`app/contracts/models.py`) ya implementa la lógica de selección, pero ningún endpoint la invoca todavía.

La taxonomía interna de categorías está enumerada en `AssetCategory`; los tipos oficiales de activo son únicamente `post_linkedin`, `destaque_newsletter_semanal` y `sugerencia_contenido_faq`. Los activos no aprobados no deben pasar a distribución. La regla de desempate implementada en `armar_respuesta_externa` selecciona, por cada clave oficial, el candidato **aprobado** con mayor `relevance_score` de la interacción que lo generó; si ninguno está aprobado, la clave se omite.

## Salida externa final prevista (sin endpoint todavía)

El contrato de salida del sistema completo incluye `status`, `resumen_comunidad`, `activos_distribucion_generados` y `almacenamiento_oci`. Los activos de distribución usan las tres claves oficiales indicadas; si no hay candidato aprobado, la clave se omite de la serialización — esto ya está cubierto por `armar_respuesta_externa` y probado en `backend/tests/contracts/test_contracts.py`, pero falta el endpoint que lo exponga, el cálculo de `resumen_comunidad` a partir del lote y la escritura real en OCI (`almacenamiento_oci`).

**Importante:** ese paquete final sigue siendo el contrato objetivo del proyecto. No describir `/api/v1/pipeline/process` ni `/api/v1/review` como si ya devolvieran este paquete o escribieran en OCI — hoy devuelven los contratos internos descritos arriba.

## Cambios de contrato

- Modifica los modelos canónicos compartidos; evita clases duplicadas en los equipos.
- Avisa a productores y consumidores antes de renombrar o quitar campos.
- Mantén la compatibilidad externa oficial, aunque el contrato interno necesite más metadatos.
- Actualiza las pruebas de contrato en `backend/tests/contracts/` y ejemplos versionados en `schemas/` cuando corresponda.
