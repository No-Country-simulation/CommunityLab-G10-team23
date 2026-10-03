# Equipo D · Storage, dashboard y RAG

**Fases del pipeline:** almacenamiento en OCI, 9 (Dashboard) y 10 (RAG/FAQ, diferencial). Este equipo también es dueño de la integración end-to-end de las otras tres partes.

**Objetivo:** persistir lo aprobado en OCI Object Storage, visualizar el estado de la comunidad, y si sobra tiempo, construir el FAQ con RAG.

## Personas y roles

- **Persona 1, DevOps/Cloud:** OCI Object Storage, docker-compose, variables de entorno y secretos, y dueña/o de que el pipeline completo (A→B→C→D) funcione integrado.
- **Persona 2, full-stack / data viz:** dashboard de Streamlit, y el RAG diferencial si el resto del pipeline ya está estable.

RAG no se le asigna a nadie de entrada. Se decide en la semana 4, según cuánto tiempo real haya sobrado, no antes.

## Entradas y salidas

- **Entrada:** por cada interacción, `activos_candidatos[]` con `estado_aprobacion` (de Equipo C), más el `relevance_score` correspondiente (de Equipo B) para poder desempatar.
- **Salida (contrato externo, oficial):** UN único paquete JSON por periodo, con la forma exacta que pide el documento oficial (`status`, `resumen_comunidad`, `activos_distribucion_generados` con sus 3 claves fijas, `almacenamiento_oci`), guardado como un solo objeto en OCI. Ustedes eligen, para cada clave oficial, el candidato aprobado con mayor `relevance_score` (o la omiten si no hay ninguno aprobado). Además, un dashboard de métricas y, opcionalmente, un chatbot de FAQ con RAG.

## Entregables por semana

| Semana | Entregable                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| 1      | Repo, bucket OCI Always Free, esqueleto docker-compose, prototipo de dashboard con datos mock                  |
| 2      | Conectar OCI de verdad (escritura y lectura de prueba), Streamlit corriendo en Docker                          |
| 3      | Guardar activos aprobados reales, primera corrida end-to-end con las 4 partes conectadas, aunque tenga errores |
| 4      | Dashboard leyendo datos reales de OCI. RAG solo si el pipeline A→B→C→D ya corre estable                        |
| 5      | Prueba de `docker compose up` desde un clon limpio, video de respaldo del demo, code freeze                    |

## Definition of done

- El bucket está probado con al menos una escritura y lectura reales antes de terminar la semana 2.
- Se guarda UN solo paquete JSON por periodo (no uno por activo): por ejemplo `activos/2026-semana-04/paquete-distribucion.json`, con la forma exacta del contrato oficial. Esto revierte lo que este documento sugería antes (un objeto por activo); el formato oficial no lo permite.
- `docker compose up` levanta todo el sistema con un solo comando desde un clon limpio del repo.
- El dashboard lee datos reales de storage antes de la demo, nunca datos hardcodeados.

## Dependencias

Consumen el contrato de Equipo C. Además de su propia pieza, son responsables de verificar que el pipeline completo funcione junto: no esperen a la semana 5 para probarlo por primera vez. También son dueños de la regla de desempate al agregar (mayor `relevance_score` gana cada clave oficial): si el negocio la cuestiona, avisen antes de cambiarla, porque los otros 3 equipos dan por hecho que esa es la regla vigente.

## Casos de prueba que les aplican

Caso 10 (verificar que un fallo del LLM no corrompe lo que ya está guardado), y las 3 interacciones de la demo final (una success story, una pregunta técnica, un mensaje de soporte), que están en la pestaña principal.
