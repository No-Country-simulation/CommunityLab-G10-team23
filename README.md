# CommunityLab · Grupo 10 · Equipo 23

MVP para convertir interacciones de comunidades de aprendizaje en análisis estructurados y, como objetivo del proyecto, activos de comunicación revisados por personas. El repositorio está organizado como un **monolito modular**: las fases del pipeline viven como módulos del backend, no como microservicios independientes.

> **Estado actual:** están implementados el servicio FastAPI, el chequeo de salud, el endpoint de ingesta/análisis con Gemini, los contratos compartidos y componentes de clasificación/scoring/workflow. La generación de contenidos, la revisión HITL, el almacenamiento OCI, el dashboard y RAG están en el plan del equipo, pero todavía no forman un flujo end-to-end conectado. Consulta [el plan de equipos](docs/CommunityLab%20-%20Plan%20de%20equipos.md) para el alcance acordado.

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

El backend puede arrancar sin la clave porque el cliente de Gemini se inicializa de forma diferida. Sin una clave válida, el endpoint de ingesta responde con análisis neutral degradado; para obtener análisis del modelo configura `GEMINI_API_KEY`. `GEMINI_MODEL` es opcional y, si se omite, se usa `gemini-2.0-flash`.

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
| `POST` | `/api/v1/ingest/process` | Valida un lote y devuelve cada interacción con su análisis. |

La solicitud de ingesta acepta hasta 500 interacciones. Ejemplo:

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

## Estructura del repositorio

```text
backend/
	app/
		api/v1/         Routers y endpoints versionados.
		ai/             Prompts y análisis estructurado con LLM.
		contracts/      Modelos Pydantic y enums compartidos entre equipos.
		intelligence/   Clasificación determinista, LLM y cálculo de relevancia.
		schemas/        Exposición de esquemas externos e internos.
		workflow/       Grafo de clasificación y enrutamiento con LangGraph.
		config.py       Configuración del servicio.
		main.py         Aplicación FastAPI y registro de routers.
	tests/            Pruebas de API, análisis, contratos y workflow.
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

El router actual es un ejemplo: `main.py` registra el router de ingesta bajo `/api/v1/ingest` y su operación `/process` completa la ruta `/api/v1/ingest/process`.

## Ingesta y análisis actuales

El flujo implementado en `POST /api/v1/ingest/process` es:

1. FastAPI valida el lote con `SolicitudProcesamiento` y los modelos Pydantic compartidos.
2. Para cada elemento crea `InteraccionInterna`, con identificador y marca temporal UTC.
3. `app.ai.analyzer` envía el texto y contexto de comunidad/periodo al prompt de Gemini; exige una salida que valide como `AnalisisInterno` y reintenta una vez si hay error.
4. Si un análisis sigue fallando, la ruta crea un resultado neutral y lo marca como degradado; los demás elementos del lote se procesan igualmente.
5. La respuesta devuelve `origen_comunidad`, `periodo_referencia` y `interacciones_procesadas`.

`tipo` se conserva como metadato de la fuente: no debe tratarse como una clasificación confiable. Según el contrato del proyecto, sentimiento, temas, entidades e intención se derivan del texto. El endpoint no persiste datos ni ejecuta actualmente el grafo de clasificación en esa misma petición.

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
