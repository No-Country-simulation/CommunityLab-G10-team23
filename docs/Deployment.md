# Desarrollo y despliegue

El proyecto está desplegado en OCI Always Free con dos instancias: el frontend en <http://138.2.245.128:3000/> y el backend en <http://164.152.246.126:8000/docs>. Este documento cubre el entorno local. La guía de despliegue en OCI está en [Guia_Despliegue_OCI.md](Guia_Despliegue_OCI.md) y el detalle de la infraestructura en [Documentacion_Equipo_D_y_Despliegue_OCI.md](Documentacion_Equipo_D_y_Despliegue_OCI.md).

## Requisitos

- Docker Desktop reciente con Docker Compose v2.
- Opcional, para ejecutar pruebas sin Docker: Python 3.12.
- Una clave de Google Gemini para procesar lotes. La suite automatizada no la necesita.

## Configuración de entorno

Crea un `.env` en la raíz a partir de [`.env.example`](../.env.example):

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `GEMINI_API_KEY` | Sí, para procesar lotes | Sin ella la API arranca, pero los lotes terminan en `fallido`. |
| `GEMINI_MODEL` | No | Por defecto `gemini-3.8-flash`. Se recomienda `gemini-3.5-flash-lite` por su cuota gratuita mayor. |
| `OCI_BUCKET_NAME`, `OCI_NAMESPACE`, `OCI_REGION` | No | Sobrescriben el bucket, namespace y región predeterminados. |
| `OCI_MOCK_STORAGE` | No | `true` fuerza el almacenamiento local aunque haya credenciales de OCI. |

`.env` está en `.gitignore`. Nunca pongas claves en ejemplos, commits, issues o logs. El contenedor lee el `.env` al crearse: después de cambiarlo, ejecuta `docker compose up -d --force-recreate backend`.

## Levantar el proyecto

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build            # backend en :8000 y frontend en :3000
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build backend    # solo la API
```

- Aplicación web: `http://localhost:3000`
- Salud: `GET http://localhost:8000/health`
- Swagger UI: `http://localhost:8000/docs` · ReDoc: `http://localhost:8000/redoc`

`docker-compose.dev.yml` monta el código (`./backend:/app`) y activa `--reload` en Uvicorn. Sin ese archivo, `docker compose up --build` levanta la configuración de producción (sin recarga automática, datos en un volumen). Detén los servicios con `Ctrl+C` y limpia los contenedores con `docker compose down`. Detener el backend descarta el avance de un lote en proceso, porque los trabajos viven en memoria.

**Almacenamiento en local:** sin credenciales de OCI, el backend guarda los paquetes en `backend/data/oci_mock/` con la misma estructura del bucket. Guardar cambios, el Historial y el dashboard funcionan igual. Los candidatos en revisión se guardan en `backend/data/activos_candidatos.json`. Ambos están fuera del control de versiones.

## Pruebas

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
python -m pip install -r requirements.txt
python -m pytest -q
```

Dentro de un backend activo: `docker compose exec backend python -m pytest -q`.

Los tests simulan Gemini y OCI, así que no requieren credenciales ni consumen cuota. Al añadir una ruta, incluye pruebas de éxito, de validación (por ejemplo, 422) y de fallos de dependencias externas.

## Pendiente

- No hay CI/CD: el despliegue en OCI se actualiza a mano (`git pull` + `docker compose up -d --build`).
- Los trabajos en segundo plano y los candidatos en revisión no son persistentes. Solo el paquete publicado en OCI es durable.
