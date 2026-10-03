# Desarrollo y despliegue local

## Requisitos

- Docker Desktop reciente con Docker Compose v2.
- Opcional para ejecutar pruebas sin Docker: Python 3.12.
- Una clave de Google Gemini solo para obtener análisis reales; la suite automatizada simula las llamadas externas.

## Configuración de entorno

El backend recibe `GEMINI_API_KEY` mediante el archivo `.env` de la raíz y Compose. `GEMINI_MODEL` es opcional; el analizador usa `gemini-2.0-flash` si no se configura. El cliente LLM se crea bajo demanda, de modo que el servicio puede iniciar sin una clave, pero el análisis caerá en el resultado neutral degradado.

Usa un `.env` local basado en [`.env.example`](../.env.example). Nunca pongas claves válidas en ejemplos, commits, issues o logs. **Situación de seguridad a resolver:** `.env` está versionado actualmente en la rama de desarrollo. Si contenía una clave real, revócala/ rótala en el proveedor; ignorar el archivo no elimina una credencial de los commits anteriores. El repositorio debe dejar de rastrear `.env` y conservar solo el ejemplo sin secretos.

## Backend con Compose

Desde la raíz:

```bash
docker compose up --build backend
```

- Base URL local: `http://localhost:8000`
- Salud: `GET http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Ingesta: `POST http://localhost:8000/api/v1/ingest/process`

El volumen `./backend:/app` monta el código en el contenedor y Uvicorn usa `--reload` para desarrollo. Detén el servicio con `Ctrl+C`; limpia contenedores con `docker compose down`.

Compose también declara `frontend`, pero el código actual (`frontend/app.py`) solo imprime un texto y termina; el dashboard real está pendiente. Por eso el comando recomendado aquí es iniciar `backend` de forma explícita.

## Pruebas locales

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pytest -q
```

Para ejecutar los tests dentro de un backend activo:

```bash
docker compose exec backend python -m pytest -q
```

Los tests de API y análisis usan `TestClient` y mocks, sin depender de Gemini. Al añadir una ruta, incluye pruebas de éxito, validación (por ejemplo, 422) y errores de dependencias externas.

## Estado de despliegue

Este repositorio documenta el entorno local de desarrollo. La integración completa de las cuatro fases, Streamlit/HITL, persistencia OCI, configuración de producción, gestión de secretos y CI/CD son objetivos de trabajo; no asumir que están desplegados por ejecutar Compose hoy.
