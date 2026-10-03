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

Actualmente `POST /api/v1/ingest/process` devuelve `origen_comunidad`, `periodo_referencia` y `interacciones_procesadas`. Cada elemento contiene:

- `interaccion`: `id` generado, los campos originales y `timestamp` en UTC.
- `analisis`: `sentimiento`, `sentimiento_score` entre -1 y 1, `temas`, `entidades`, `resumen` e `intencion`.
- `degradado`: booleano; `true` indica que no se obtuvo análisis del LLM y se usó el fallback neutral.

El analizador hace hasta dos invocaciones en total (intento inicial más un reintento). Un fallo de una interacción no interrumpe el resto del lote. Los tests simulan al proveedor.

## Contratos entre fases (objetivo del pipeline)

El flujo previsto transmite:

1. **Equipo A → B:** `InteraccionInterna` más `AnalisisInterno`.
2. **Equipo B → C:** `ResultadoAnalisisInterno`, que asocia `interaccion_id`, análisis, `oportunidad` (categoría y `relevance_score` de 0 a 100) y `enrutamiento` (ruta y motivo).
3. **Equipo C → D:** `ResultadoGeneracionInterno` con activos candidatos, tipo de activo, contenido y estado de aprobación.
4. **Equipo D → cliente:** paquete externo final, luego de seleccionar los activos aprobados y persistir el resultado según el contrato acordado.

La taxonomía interna de categorías está enumerada en `AssetCategory`; los tipos oficiales de activo son únicamente `post_linkedin`, `destaque_newsletter_semanal` y `sugerencia_contenido_faq`. Los activos no aprobados no deben pasar a distribución. La regla de desempate definida por el plan selecciona el candidato aprobado con mayor `relevance_score` por clave oficial.

## Salida externa final prevista

El contrato de salida del sistema completo incluye `status`, `resumen_comunidad`, `activos_distribucion_generados` y `almacenamiento_oci`. Los activos de distribución usan las tres claves oficiales indicadas; si no hay candidato aprobado, la clave debe omitirse de la serialización según el plan.

**Importante:** ese paquete final es el contrato objetivo del proyecto, no la respuesta actual de `POST /api/v1/ingest/process`. No describir la ruta de ingesta como si ya generara activos, gestionara aprobación humana o escribiera en OCI.

## Cambios de contrato

- Modifica los modelos canónicos compartidos; evita clases duplicadas en los equipos.
- Avisa a productores y consumidores antes de renombrar o quitar campos.
- Mantén la compatibilidad externa oficial, aunque el contrato interno necesite más metadatos.
- Actualiza las pruebas de contrato en `backend/tests/contracts/` y ejemplos versionados en `schemas/` cuando corresponda.
