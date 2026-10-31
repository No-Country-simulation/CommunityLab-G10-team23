# Community Lab — Front-End

Interfaz web para la **revisión humana (HITL)** del contenido que genera el pipeline de CommunityLab, desarrollada con **Next.js 15**, **React 19**, **TypeScript** y **Tailwind CSS**.

Se conecta al backend en **FastAPI**, que analiza, clasifica y redacta con **Google Gemini** (orquestado con LangGraph) las conversaciones de comunidades de aprendizaje, y propone publicaciones para **LinkedIn**, **Newsletter** y **Contenido FAQ** que una persona revisa antes de publicar.

---

## 📋 Tabla de Contenidos

- [Community Lab — Front-End](#community-lab--front-end)
  - [📋 Tabla de Contenidos](#-tabla-de-contenidos)
  - [⚙️ Requisitos Previos](#️-requisitos-previos)
  - [🚀 Puesta en Marcha](#-puesta-en-marcha)
    - [Opción recomendada: todo el stack con Docker](#opción-recomendada-todo-el-stack-con-docker)
    - [Alternativa: frontend en modo desarrollo (sin Docker)](#alternativa-frontend-en-modo-desarrollo-sin-docker)
  - [🖥️ Guía de Uso](#️-guía-de-uso)
    - [1. Cargar un lote](#1-cargar-un-lote)
    - [2. Filtrar por formato (pestañas)](#2-filtrar-por-formato-pestañas)
    - [3. Revisar el detalle (menú ⋮)](#3-revisar-el-detalle-menú-)
  - [🧩 Estructura del Proyecto](#-estructura-del-proyecto)
  - [🔄 Arquitectura de Comunicación (BFF)](#-arquitectura-de-comunicación-bff)
  - [📄 Contrato de Datos JSON](#-contrato-de-datos-json)

---

## ⚙️ Requisitos Previos

- **Docker Desktop** con **Docker Compose v2** (estándar oficial del equipo).
- Archivo `.env` en la raíz del repositorio, basado en [`.env.example`](../.env.example), con:
  - `GEMINI_API_KEY`: tu llave de Google AI Studio.
  - `GEMINI_MODEL`: se recomienda `gemini-3.5-flash-lite` (ver [cuotas de Gemini](#cuota-de-gemini-agotada-error-429)).
- **Node.js** v18.18+ o v20+, solo si vas a ejecutar el frontend fuera de Docker.

---

## 🚀 Puesta en Marcha

### Opción recomendada: todo el stack con Docker

Desde la **raíz del repositorio**:

```bash
docker compose up --build
```

- Frontend: **http://localhost:3000**
- Backend: **http://localhost:8000** (documentación interactiva en `/docs`)

En la cabecera verás **● Conectado** si el frontend llega al backend, o **Modo demostración** si no (ver [Resiliencia](#-arquitectura-de-comunicación-bff)).

Comandos útiles:

| Acción | Comando |
| :--- | :--- |
| Detener sin borrar los contenedores | `docker compose stop` (reanudar con `docker compose start`) |
| Congelar sin detener | `docker compose pause` (reanudar con `docker compose unpause`) |
| Detener y eliminar los contenedores | `docker compose down` |
| Reconstruir solo el frontend | `docker compose up -d --build --no-deps frontend` |

> Detener o eliminar el backend (`stop`/`down`) descarta el avance de un lote en proceso: los trabajos viven en su memoria. Lo ya generado y las aprobaciones se conservan en `backend/data/activos_candidatos.json`.

### Alternativa: frontend en modo desarrollo (sin Docker)

Con el backend levantado (`docker compose up --build backend`), en otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre **http://localhost:3000**. El proxy apunta a `http://localhost:8000` salvo que definas `BACKEND_URL`.

---

## 🖥️ Guía de Uso

La interfaz ocupa toda la pantalla y funciona como una **bandeja de revisión**: el lote se procesa automáticamente al cargarlo y el revisor aprueba, edita o rechaza lo que generó la IA.

### 1. Cargar un lote

Mientras los lotes no lleguen automáticamente desde la nube, hay tres formas de cargarlos:

- **Cargar JSON** (cabecera): selecciona un archivo con el contrato `SolicitudProcesamiento`.
- **Arrastrar y soltar**: arrastra el `.json` sobre cualquier parte de la página.
- **Datos de prueba** (cabecera): lotes de demostración (*Caso oficial* y *Lote sin oportunidades*).

El archivo se valida en el navegador y se envía al backend, que lo procesa **en segundo plano, una interacción a la vez**. Las filas aparecen en la tabla a medida que cada interacción termina y la cabecera muestra **Procesando X de N**. Puedes abrir y revisar las filas que ya llegaron mientras el resto se procesa. **Reprocesar** vuelve a enviar el lote actual.

### 2. Filtrar por formato (pestañas)

| Pestaña | Qué muestra |
| :--- | :--- |
| **Todos** | Una fila por interacción, con los formatos que generó y el estado de cada uno. **Ver descartadas** muestra solo las interacciones que la IA clasificó como `IGNORE`. |
| **LinkedIn / Newsletter / FAQ** | Una fila por contenido generado de ese formato oficial (`post_linkedin`, `destaque_newsletter_semanal`, `sugerencia_contenido_faq`). |
| **Alertas de soporte** | Interacciones `SUPPORT_ALERT` enrutadas a `equipo_c.revision_prioritaria`. No generan contenido; requieren atención del equipo. |

Dentro de cada pestaña, el selector **Pendientes / Aprobados / Rechazados** funciona como bandeja: por defecto se ven los pendientes y, al aprobar o rechazar, la fila pasa a la bandeja correspondiente. La tabla se ordena por relevancia y se puede buscar por autor. Una ⚠ junto al autor indica que alguna fase falló o que el análisis quedó degradado.

### 3. Revisar el detalle (menú ⋮)

El menú **⋮** de cada fila permite **Ver detalle** y, en las pestañas de formato, **Aprobar**, **Rechazar** o **Marcar pendiente** sin abrir el detalle. Hacer clic en la fila también abre el detalle.

La ventana de detalle muestra la interacción original, el análisis de la IA (sentimiento, temas, entidades y resumen) y la clasificación (categoría, relevancia y motivo), junto a un editor con los campos de cada formato:

| Formato | Editables | Solo lectura | No se muestran |
| :--- | :--- | :--- | :--- |
| **LinkedIn** | Título, Copy | Canal recomendado | Potencial de engagement |
| **Newsletter** | Titular, Resumen | Sección | — |
| **FAQ** | Tema | Origen | Status |

- Los campos que no se muestran se conservan: cada cambio se guarda con `PATCH /api/v1/review/assets/{candidato_id}` enviando el `contenido` **completo**, porque el backend lo reemplaza.
- **Copiar** lleva al portapapeles solo los campos editables.
- **Publicar** solo se habilita cuando el contenido está aprobado y sin cambios pendientes. Por ahora la publicación es simulada.
- Si cierras la ventana con cambios sin guardar, se pide confirmación.

El backend redacta el copy de LinkedIn como un post (gancho, párrafos cortos, llamada a la acción y hashtags) y el resumen del Newsletter con formato de noticia (entradilla y contexto, 60–120 palabras). La sección del Newsletter la elige el modelo entre *Logros de la comunidad*, *Preguntas destacadas*, *Aprendizaje y recursos* y *Vida de la comunidad*.

---

## 🧩 Estructura del Proyecto

```
frontend/src/
├── app/
│   ├── api/
│   │   ├── health/route.ts              # Chequeo de salud del backend (GET /health)
│   │   ├── pipeline/jobs/route.ts       # Proxy BFF hacia POST /api/v1/pipeline/jobs (con simulador)
│   │   ├── pipeline/jobs/[id]/route.ts  # Proxy BFF hacia GET /api/v1/pipeline/jobs/{id}?desde=n
│   │   └── review/assets/[id]/route.ts  # Proxy BFF hacia PATCH /api/v1/review/assets/{id}
│   ├── layout.tsx                       # Layout raíz
│   └── page.tsx                         # Estado de la página: carga del lote, avance, pestañas, filtros y revisión
├── components/
│   ├── Header.tsx                       # Cabecera: lote actual y avance, cargar JSON, reprocesar, datos de prueba, estado del backend
│   ├── ReviewTable.tsx                  # Tabla de datos con menú ⋮ por fila
│   └── InteractionDetailModal.tsx       # Ventana de detalle con editor por formato y acciones HITL
├── lib/
│   ├── review.ts                        # Pestañas, etiquetas, campos por formato y armado de filas
│   ├── samples.ts                       # Lotes de demostración
│   └── simulation.ts                    # Resultado simulado para el modo demostración
└── types/
    └── backend.ts                       # Tipos TypeScript de los contratos del backend
```

`frontend/.dockerignore` excluye `node_modules` y `.next` del build de Docker: se generan dentro de la imagen.

---

## 🔄 Arquitectura de Comunicación (BFF)

El navegador nunca llama directamente a FastAPI: usa Route Handlers de Next.js como **Backend-For-Frontend (BFF)**, lo que evita problemas de CORS. En Docker, el proxy llega al backend por `BACKEND_URL=http://backend:8000`.

```
[Navegador Web / React]
        │
        ▼
[Next.js API Routes en /api/*]
        │
        ▼
[FastAPI Backend]
        │
        ├─► POST  /api/v1/pipeline/jobs              (crea el trabajo, responde 202 al instante)
        ├─► GET   /api/v1/pipeline/jobs/{id}?desde=n (avance + solo las interacciones nuevas)
        ├─► PATCH /api/v1/review/assets/{candidato_id}
        └─► GET   /health
```

- **Fila por fila**: el backend procesa un lote a la vez y, dentro de él, una interacción a la vez. La página consulta el avance cada 2 s y agrega a la tabla las filas nuevas. No hay un tiempo máximo de espera por lote; si el backend deja de responder 5 veces seguidas, el lote se marca como interrumpido y se conservan las filas recibidas.
- **Resiliencia ante caídas (modo demostración)**: si el backend no está disponible al crear el trabajo, el proxy responde con un resultado simulado (`src/lib/simulation.ts`) para seguir navegando la interfaz. Los cambios de revisión sobre esos datos solo se guardan en la sesión.

---

## 📄 Contrato de Datos JSON

El archivo de entrada debe cumplir el modelo `SolicitudProcesamiento` (hasta 500 interacciones; cada una con `autor`, `canal`, `tipo` y `texto`):

```json
{
  "origen_comunidad": "Comunidad_Alura_Latam",
  "periodo_referencia": "Semana_05_2026",
  "interacciones": [
    {
      "autor": "Valentina Ríos",
      "canal": "#historias-de-éxito",
      "tipo": "testimonio",
      "texto": "¡Comunidad, no puedo contener la emoción! Hoy firmé mi contrato como AI Engineer Junior..."
    },
    {
      "autor": "Carlos Mendoza",
      "canal": "#dudas-generativa",
      "tipo": "pregunta",
      "texto": "¿Cómo están manejando el control de rate limits en FastAPI con Gemini en producción?..."
    }
  ]
}
```

Para probar sin preparar un archivo, usa el menú **Datos de prueba** de la cabecera. La definición formal del contrato (JSON Schema) está en [`schemas/input.json`](../schemas/input.json); sirve como referencia del formato, no como lote para cargar.

---


