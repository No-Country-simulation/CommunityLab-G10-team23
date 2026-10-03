# Equipo C · Generación y HITL

**Fases del pipeline:** 6 (Generación de contenido) y 7 (Human-in-the-loop)

**Objetivo:** generar los activos de contenido y darle a una persona el control de aprobar, editar o rechazar cada uno antes de que se guarde o publique nada.

## Personas y roles

- **Persona 1, ingeniero/a de prompts y copywriting:** cadenas de generación por canal (LinkedIn, newsletter, FAQ), few-shot examples, tono de voz por canal.
- **Persona 2, frontend Streamlit (HITL):** panel de revisión, edición y aprobación.

## Entradas y salidas

- **Entrada:** `enrutamiento` (real de Equipo B, o mockeado mientras tanto).
- **Salida (contrato interno, hacia Equipo D):** por cada interacción, una lista `activos_candidatos[]`. Cada candidato trae `tipo_activo` (debe ser exactamente una de las 3 claves oficiales fijas: `post_linkedin`, `destaque_newsletter_semanal` o `sugerencia_contenido_faq`; no se pueden inventar claves nuevas), `contenido` y `estado_aprobacion`. Mínimo 2 candidatos distintos por corrida (requisito del checklist oficial). Equipo D, al armar la respuesta final, elige qué candidato aprobado gana cada clave si hay más de uno.

## Entregables por semana

| Semana | Entregable                                                                                  |
| ------ | ------------------------------------------------------------------------------------------- |
| 1      | Wireframe del panel HITL, few-shot examples borrador por canal                              |
| 2      | Cadenas de generación contra input mockeado con la categoría y el score esperados           |
| 3      | Integración real contra la salida de Equipo B, panel HITL funcional (ver y editar)          |
| 4      | Aprobar/rechazar persistiendo el estado, reglas para no inventar hechos, nombres o métricas |
| 5      | Code freeze, documentación de prompts de generación                                         |

## Definition of done

- Mínimo 2 formatos de activo distintos generados por corrida (requisito del checklist oficial), y el `tipo_activo` de cada uno coincide exactamente con una de las 3 claves oficiales fijas (`post_linkedin`, `destaque_newsletter_semanal`, `sugerencia_contenido_faq`); ningún activo se genera con una clave fuera de esa lista.
- Cada activo trae `interaccion_id` de origen, para poder rastrear de dónde salió.
- El panel HITL persiste el estado de aprobación, no solo lo muestra en pantalla.
- Hay un fallback si el LLM de generación falla (no se cae el pipeline completo).

## Dependencias

Consumen el contrato de Equipo B. Entregan `activos_generados` con estado a Equipo D para que lo guarde en OCI: si cambian la forma de ese objeto a mitad de camino, avisen antes de tocarlo.

## Casos de prueba que les aplican

Casos 1, 4 y 7 (generación de contenido a partir de algo positivo) y caso 9 (revisión humana ante una interacción ambigua).
