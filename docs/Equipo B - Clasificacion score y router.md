# Equipo B · Clasificación, score y router

**Fases del pipeline:** 3 (Clasificación), 4 (Relevance score) y 5 (Router inteligente)

**Objetivo:** convertir el análisis en una decisión: qué tipo de oportunidad es, qué tan relevante es, y a qué generador de contenido debe enrutarse. Las tres fases quedan juntas en este equipo a propósito: el router lee directamente la categoría y el score, así que separarlos en equipos distintos solo agrega handoffs innecesarios.

## Personas y roles

- **Persona 1, ingeniero/a de scoring y clasificación:** taxonomía de 7 categorías, fórmula de relevance score, reglas de negocio.
- **Persona 2, ingeniero/a de orquestación LangGraph:** grafo de estados, edges condicionales, manejo de reintentos ante fallo del LLM.

## Entradas y salidas

- **Entrada:** el objeto `analisis` (real de Equipo A, o mockeado mientras tanto).
- **Salida (contrato interno, hacia Equipo C):** `oportunidad` (`categoria` + `relevance_score`) y `enrutamiento` (`ruta` + `motivo`). Estos campos son internos: no existen en el JSON oficial de salida. Equipo D es quien, al final, traduce cada `categoria` a una de las 3 claves oficiales fijas (`post_linkedin`, `destaque_newsletter_semanal`, `sugerencia_contenido_faq`), usando `relevance_score` para desempatar cuando hay más de un candidato por clave.
- Sobre **tipo**: no se usa para mapear categoria directamente. Sus reglas de clasificacion parten de sentimiento, temas, entidades e intencion (la salida de Equipo A), porque tipo es una etiqueta de origen sin garantia de ser correcta: un "testimonio" puede ser en realidad una queja disfrazada.

## Entregables por semana

| Semana | Entregable                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------ |
| 1      | Taxonomía de categorías, fórmula de score documentada, diseño del grafo LangGraph en papel       |
| 2      | Clasificador y scorer funcionando contra los mocks de Equipo A                                   |
| 3      | Integración real con la salida de Equipo A, primer ajuste de umbrales                            |
| 4      | Reintentos ante fallo del LLM sin tumbar el pipeline, métricas de evaluación si hay ground truth |
| 5      | Code freeze, umbrales finales documentados                                                       |

## Definition of done

- Las categorías de salida coinciden exacto con el enum acordado (`SUCCESS_STORY`, `FAQ`, `EDUCATIONAL_CONTENT`, `SOCIAL_POST`, `COMMUNITY_HIGHLIGHT`, `SUPPORT_ALERT`, `IGNORE`), nunca strings libres.
- El score es reproducible, o está documentado por qué varía si usan LLM en ese paso.
- El grafo reintenta al menos una vez ante un fallo del LLM sin tumbar el pipeline completo.
- Los mocks de `oportunidad` + `enrutamiento` están disponibles para Equipo C desde la semana 1.

## Dependencias

Consumen el contrato de Equipo A, pero no tienen que esperarlo: empiecen con mocks desde el día 1. Ustedes bloquean a Equipo C si no congelan su propio contrato (categoría + score + ruta) en la semana 1.

## Casos de prueba que les aplican

Casos 1, 2, 3, 4, 5, 6, 8 y 9: son casi todos los casos de clasificación y priorización. Revísenlos en la pestaña principal.
