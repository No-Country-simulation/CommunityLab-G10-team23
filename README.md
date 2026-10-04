# CommunityLab · Grupo 10 · Equipo 23

MVP para convertir interacciones de comunidades de aprendizaje en análisis estructurados y, como objetivo del proyecto, activos de comunicación revisados por personas. El repositorio está organizado como un **monolito modular**: las fases del pipeline viven como módulos del backend, no como microservicios independientes.

> **Estado actual:** están implementados el servicio FastAPI, el chequeo de salud, los contratos compartidos y el pipeline completo conectado de extremo a extremo: ingesta/análisis con Gemini (Equipo A), clasificación/score/ruteo con un grafo LangGraph (Equipo B) y generación de activos candidatos con revisión humana HITL (Equipo C). La persistencia de candidatos es hoy un archivo JSON local, no el almacenamiento OCI definitivo. El almacenamiento OCI, el dashboard y RAG siguen en el plan del equipo. Consulta [el plan de equipos](docs/CommunityLab%20-%20Plan%20de%20equipos.md) para el alcance acordado.

## Inicio rápido con Docker

Requisitos: Docker Desktop con Docker Compose v2.

1. En la raíz del repositorio, prepara un archivo local `.env` con `GEMINI_API_KEY`. Puedes tomar [`.env.example`](.env.example) como referencia. No compartas ni subas credenciales reales.
2. Construye e inicia el backend:

	 ```bash
	 docker compose up --build backend
	 ```

3. Comprueba el servicio:

	 ```bash
	 curl http://localhost:8000/health
	 ```

	 Debe responder con `status: ok`. La documentación interactiva de la API está en <http://localhost:8000/docs>.
4. Para detenerlo, usa `Ctrl+C`; para quitar los contenedores, ejecuta `docker compose down`.

El backend puede arrancar sin la clave porque el cliente de Gemini se inicializa de forma diferida. Sin una clave válida, el análisis cae en un resultado neutral degradado y la generación de activos usa contenido de respaldo basado en plantillas; para obtener análisis y contenido reales del modelo configura `GEMINI_API_KEY`. `GEMINI_MODEL` es opcional y, si se omite, se usa `gemini-3.8-flash`.

La cuota gratuita de la API de Gemini es de 20 solicitudes/día **por proyecto** (no por API key individual): si varias claves provienen del mismo proyecto de Google AI Studio/Cloud, comparten el mismo límite. Un solo llamado al pipeline completo consume varias solicitudes (análisis + clasificación + generación), así que ese límite se agota rápido en pruebas manuales. Para desarrollo sostenido, habilita billing en el proyecto asociado a la clave o reserva las pruebas contra la API real para verificaciones puntuales; la suite automatizada (`pytest`) no consume cuota porque simula el proveedor.

El servicio `frontend` de Compose es actualmente un placeholder que solo imprime un mensaje y termina; no es todavía el dashboard Streamlit descrito en el plan.

## Ejecutar las pruebas

Con Python 3.12 recomendado, instala las dependencias desde `backend` y ejecuta la suite:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pytest -q
```

Las pruebas de API y de análisis simulan las llamadas al LLM, por lo que no necesitan credenciales ni acceso al proveedor. La imagen Docker también instala `pytest`; con el backend en ejecución se puede lanzar la suite en el contenedor con `docker compose exec backend python -m pytest -q`.

## API disponible

| Método | Ruta | Propósito |
| --- | --- | --- |
| `GET` | `/health` | Estado y entorno del servicio. |
| `POST` | `/api/v1/ingest/process` | Equipo A solamente: valida un lote y devuelve cada interacción con su análisis. |
| `POST` | `/api/v1/pipeline/process` | Flujo completo A→B→C: análisis, clasificación/score/ruteo y, si corresponde, generación de activos candidatos. |
| `GET` | `/api/v1/review/assets` | Lista los activos candidatos generados y su estado de aprobación (HITL). |
| `PATCH` | `/api/v1/review/assets/{candidato_id}` | Aprueba, rechaza o edita el contenido de un activo candidato antes de distribuirlo. |

La solicitud de ingesta acepta hasta 500 interacciones y es el mismo payload para `/api/v1/ingest/process` y `/api/v1/pipeline/process`. Ejemplo:

```json
{
	"origen_comunidad": "Discord",
	"periodo_referencia": "2026-W40",
	"interacciones": [
		{
			"autor": "Mariana",
			"canal": "#preguntas",
			"tipo": "pregunta",
			"texto": "¿Cómo puedo usar FastAPI?"
		}
	]
}
```

Cada elemento de `interacciones` requiere `autor`, `canal`, `tipo` y `texto` como cadenas. La API genera un `id` y un `timestamp` UTC, y entrega el análisis con `sentimiento`, `sentimiento_score` (de -1 a 1), `temas`, `entidades`, `resumen` e `intencion`. Si el proveedor falla tras el reintento, esa interacción se marca `degradado: true` y el lote continúa. Los datos enviados a esta ruta y su respuesta representan el **contrato interno de ingesta/análisis**; no son todavía el paquete externo final definido para el pipeline completo.

`POST /api/v1/pipeline/process` usa la misma solicitud y además devuelve, por interacción, `oportunidad` (`categoria` y `relevance_score` de 0 a 100), `enrutamiento` (`ruta` y `motivo`), `activos_candidatos` (lista de activos generados con `candidato_id`, `tipo_activo`, `contenido` y `estado_aprobacion: "pendiente"`) y un `error` opcional si alguna fase falló para esa interacción sin interrumpir el resto del lote.

`GET /api/v1/review/assets` devuelve esa misma lista de candidatos persistidos. `PATCH /api/v1/review/assets/{candidato_id}` acepta `{"estado_aprobacion": "aprobado" | "rechazado" | "pendiente", "contenido": {...}}` (`contenido` es opcional) y responde 404 si el id no existe.

## Estructura del repositorio

```text
backend/
	app/
		api/v1/         Routers y endpoints versionados (ingest, pipeline, review).
		ai/             Prompts y análisis estructurado con LLM (Equipo A).
		contracts/      Modelos Pydantic y enums compartidos entre equipos.
		intelligence/   Clasificación determinista, LLM y cálculo de relevancia (Equipo B).
		schemas/        Exposición de esquemas externos e internos.
		workflow/       Grafo de clasificación/ruteo (LangGraph) y orquestación A→B→C.
		content/        Generación de activos candidatos y persistencia para HITL (Equipo C).
		config.py       Configuración del servicio.
		main.py         Aplicación FastAPI y registro de routers.
	data/             Almacenamiento JSON local de activos candidatos (no versionado).
	tests/            Pruebas de API, análisis, contratos, intelligence, content y workflow.
	Dockerfile
	requirements.txt
frontend/            Placeholder actual; objetivo futuro: Streamlit/HITL.
docs/                Arquitectura, contratos, despliegue y planes por equipo.
schemas/             Ejemplos JSON de entrada y salida del contrato del proyecto.
docker-compose.yml   Servicios de desarrollo local.
```

## Añadir una ruta nueva

Mantén las rutas en módulos propios bajo `backend/app/api/v1/`, los modelos de validación en `backend/app/contracts/` (y sus módulos de exposición en `backend/app/schemas/` cuando corresponda), y las pruebas bajo `backend/tests/api/`.

1. Define un modelo Pydantic de entrada y, si aplica, otro de respuesta; reutiliza los contratos existentes en vez de duplicarlos.
2. Crea un `APIRouter` en un módulo nuevo, por ejemplo `backend/app/api/v1/items.py`, y declara la operación con `@router.get(...)`, `@router.post(...)`, etc. Usa `response_model` para validar/documentar la salida.
3. Importa el router en `backend/app/main.py` y regístralo con `app.include_router(...)`. El `prefix` aporta la parte común de la ruta; por ejemplo, un prefijo `/api/v1/items` más `@router.get("/")` produce `/api/v1/items/`.
4. Añade pruebas con `fastapi.testclient.TestClient` para respuestas correctas y entradas inválidas. Simula dependencias externas como Gemini u OCI para que la suite sea determinista.
5. Comprueba el resultado en `/docs` y ejecuta `python -m pytest -q` desde `backend`.

`main.py` registra tres routers: el de ingesta bajo `/api/v1/ingest`, el del pipeline completo bajo `/api/v1/pipeline` y el de revisión HITL bajo `/api/v1/review`.

## Ingesta y análisis (Equipo A)

El flujo implementado en `POST /api/v1/ingest/process` es:

1. FastAPI valida el lote con `SolicitudProcesamiento` y los modelos Pydantic compartidos.
2. Para cada elemento crea `InteraccionInterna`, con identificador y marca temporal UTC.
3. `app.ai.analyzer` envía el texto y contexto de comunidad/periodo al prompt de Gemini; exige una salida que valide como `AnalisisInterno` y reintenta una vez si hay error.
4. Si un análisis sigue fallando, la ruta crea un resultado neutral y lo marca como degradado; los demás elementos del lote se procesan igualmente.
5. La respuesta devuelve `origen_comunidad`, `periodo_referencia` y `interacciones_procesadas`.

`tipo` se conserva como metadato de la fuente: no debe tratarse como una clasificación confiable. Según el contrato del proyecto, sentimiento, temas, entidades e intención se derivan del texto. Este endpoint no clasifica ni genera contenido; para eso usa el pipeline completo.

## Pipeline completo (Equipos A→B→C)

`POST /api/v1/pipeline/process` (implementado en `app/workflow/pipeline.py::process_batch`) orquesta las tres fases por interacción:

1. **Equipo A** – mismo análisis que el endpoint de ingesta; si falla, usa el resultado neutral degradado y continúa.
2. **Equipo B** – un grafo de LangGraph (`app/workflow/classification_graph.py`) clasifica el análisis: intenta con un clasificador LLM (hasta 2 intentos), cae a un clasificador determinista por palabras clave/intención si el LLM no responde con confianza ≥ 0.75, calcula un `relevance_score` (0–100) y decide una ruta (`equipo_c.generar_activos`, `equipo_c.revision_prioritaria` o `flujo.descartar`).
3. **Equipo C** – si la ruta es `equipo_c.generar_activos`, `app/content/generator.py` pide a Gemini los formatos correspondientes a la categoría (post de LinkedIn, destaque de newsletter y/o sugerencia de FAQ) y, si el LLM falla, usa contenido de respaldo por plantilla. Los candidatos se guardan como `pendiente` vía `app/content/repository.py`.

Un fallo en cualquier fase se registra en el campo `error` de esa interacción sin interrumpir el resto del lote (aislamiento de errores por ítem).

## Revisión humana (HITL, Equipo C)

Los activos candidatos generados se persisten en `backend/data/activos_candidatos.json` (no versionado, no es el almacenamiento OCI definitivo). `GET /api/v1/review/assets` los lista; `PATCH /api/v1/review/assets/{candidato_id}` permite aprobarlos, rechazarlos o editar su `contenido` antes de la distribución final. Solo los candidatos con `estado_aprobacion: "aprobado"` deben llegar a distribución (ver `armar_respuesta_externa` en `app/contracts/models.py`, que elige el de mayor `relevance_score` por tipo oficial de activo).

## Contratos y documentación

- [Arquitectura y estado de implementación](docs/Architecture.md)
- [Contratos de entrada, salida y comunicación interna](docs/DataContract.md)
- [Ejecución y despliegue](docs/Deployment.md)
- [Plan integral de equipos](docs/CommunityLab%20-%20Plan%20de%20equipos.md)
- [Equipo A: ingesta y análisis](docs/Equipo%20A%20-%20Ingesta%20y%20analisis.md)
- [Equipo B: clasificación, score y router](docs/Equipo%20B%20-%20Clasificacion%20score%20y%20router.md)
- [Equipo C: generación y HITL](docs/Equipo%20C%20-%20Generacion%20y%20HITL.md)
- [Equipo D: storage, dashboard y RAG](docs/Equipo%20D%20-%20Storage%20dashboard%20y%20RAG.md)

Antes de implementar una fase nueva, acuerda el esquema Pydantic y los nombres de campos con los equipos que producen y consumen ese dato; conserva la distinción entre contrato externo oficial y contratos internos.
