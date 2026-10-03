# Equipo A · Ingesta y análisis

**Fases del pipeline:** 1 (Ingestión) y 2 (Análisis con LLM)

**Objetivo:** construir una entrada confiable y normalizada, y extraer sentimiento, temas y entidades de cada interacción vía LLM.

## Personas y roles

- **Persona 1, ingeniero/a de datos backend:** adaptadores CSV/JSON/webhook, validación con Pydantic, endpoint FastAPI de ingesta.
- **Persona 2, ingeniero/a NLP / prompts:** chain de análisis en LangChain, salida estructurada (sentimiento, temas, entidades, resumen, intención).

## Entradas y salidas

- **Entrada (contrato externo, oficial):** el JSON exactamente como lo define el documento oficial: `origen_comunidad`, `periodo_referencia` y una lista de `interacciones`, cada una con `autor` (string simple, no objeto), `canal`, `tipo` y `texto`. Sin `id` ni `timestamp`: el cliente no los manda.
- **Salida (contrato interno, hacia Equipo B):** la misma lista de interacciones, pero con `id` (generado por ustedes) y `timestamp` (generado si la fuente no trae uno) añadidos, más un objeto `analisis` por cada interacción (sentimiento, temas, entidades, resumen, intención). Esto es lo que consume Equipo B; el cliente externo nunca ve `id` ni `timestamp`. El contrato completo está en la pestaña principal, sección "Contrato de datos".
- Sobre **tipo**: se recibe como texto libre y no confiable (puede faltar o variar segun la fuente). Ustedes lo propagan sin cambios hacia el contrato interno y lo pasan como contexto al prompt del LLM, pero sentimiento, temas, entidades e intencion siempre se derivan del texto real, nunca se copian de tipo.

## Entregables por semana

| Semana          | Entregable                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (21/09–27/09) | Esquema `Interaction` e `IngestionBatch` en Pydantic, dataset sintético inicial, mocks de `analisis` para que Equipo B empiece sin esperar      |
| 2 (28/09–04/10) | Endpoint `/ingest` funcional con validación real, prompt de análisis v1                                                                         |
| 3 (05/10–11/10) | Adaptador de una segunda fuente si da tiempo, pruebas de ingestión con datos reales                                                             |
| 4 (12/10–18/10) | Manejo de errores, dataset final para la demo, artefactos de contract testing: `valid_input.json`, `invalid_input.json`, `expected_output.json` |
| 5 (19/10–25/10) | Code freeze, documentación de la sección de ingesta                                                                                             |

## Definition of done

- CSV y JSON funcionan como entrada, y ambos se normalizan al mismo esquema oficial (`origen_comunidad`, `periodo_referencia`, `interacciones[]`) antes de seguir el pipeline.
- El endpoint valida con Pydantic y rechaza un batch inválido con un error claro, nunca en silencio.
- Cada interacción sale hacia Equipo B con `id` y `timestamp` (generados automáticamente si la fuente no los trae), aunque el cliente externo nunca los envía ni los ve: son metadatos internos, no parte del contrato oficial.
- Los mocks de `analisis` están disponibles para Equipo B desde la semana 1.
- Corre en Docker.

## Dependencias

Nadie los bloquea a ustedes. Ustedes bloquean a todos los demás si el contrato de `analisis` no queda congelado en la semana 1: congélenlo temprano, aunque el LLM real todavía no esté conectado.

## Casos de prueba que les aplican

Caso 1 (historia de éxito), Caso 6 (interacción irrelevante) y Caso 10 (el LLM no responde). Los 10 casos completos están en la pestaña principal.
