# Community Lab — Front-End

Interfaz web moderna para la orquestación y curaduría inteligente de contenido comunitario, desarrollada con **Next.js 15**, **React 19**, **TypeScript** y **Tailwind CSS**.

El sistema se conecta a un backend en **FastAPI** y modelos de IA generativa (Google Gemini / LangGraph) para transformar conversaciones de comunidades de aprendizaje (Discord, Slack, foros) en publicaciones de alto impacto para **LinkedIn**, **Newsletter**, **Contenido FAQ** y **Casos de Éxito**.

---

## 📋 Tabla de Contenidos

- [Requisitos Previos](#requisitos-previos)
- [Puesta en Marcha](#puesta-en-marcha)
- [Guía de Uso Paso a Paso](#guía-de-uso-paso-a-paso)
- [Estructura del Proyecto y Explicación de Componentes](#estructura-del-proyecto-y-explicación-de-componentes)
- [Arquitectura de Comunicación (BFF)](#arquitectura-de-comunicación-bff)
- [Contrato de Datos JSON](#contrato-de-datos-json)

---

## ⚙️ Requisitos Previos

- **Docker Desktop** con **Docker Compose v2** (estándar oficial del equipo)
- **Node.js**: v18.18+ o v20+ (para desarrollo local del frontend)
- Archivo `.env` en la raíz del repositorio con tu `GEMINI_API_KEY` (puedes tomar `.env.example` como base).

---

## 🚀 Puesta en Marcha (Configuración Oficial del Equipo)

El equipo utiliza **Docker Compose** como el estándar oficial para garantizar un entorno reproducible, hermético e idéntico para todos los desarrolladores.

### 1. Iniciar el Backend (Oficial con Docker)

Desde la **raíz del repositorio**:
```bash
docker compose up --build backend
```

> **Verificación:**
> - Comprueba el servicio: `curl http://localhost:8000/health` (debe responder `status: ok`).
> - La documentación interactiva de la API está disponible en: `http://localhost:8000/docs`.
> - Para detener el servicio: presiona `Ctrl+C` y ejecuta `docker compose down`.

---

### 2. Iniciar el Front-End (Next.js)

En una nueva terminal, entra a la carpeta `frontend/`:
```bash
cd frontend
npm install
npm run dev
```

Abre tu navegador en:
👉 **`http://localhost:3000`**

En la cabecera verás el indicador verde **`● Servidor Conectado`**, confirmando que el frontend se está comunicando correctamente con el contenedor de FastAPI en el puerto `8000`.

---

### 💡 Alternativa: Iniciar Todo el Stack con Docker
Si prefieres levantar tanto el backend como el frontend contenerizados con un solo comando:
```bash
# Desde la raíz del repositorio
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

---

### 🛠️ Modo Alternativo: Desarrollo Local sin Docker (Opcional)
Si en algún momento deseas ejecutar el backend sin abrir Docker Desktop (por ejemplo, para depuración rápida de bajo consumo de memoria):
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

---

## 🖥️ Guía de Uso Paso a Paso

La interfaz está diseñada en dos niveles cómodos para que cualquier persona (incluso sin perfil técnico) pueda operarla con facilidad:

### Paso 1: Cargar las conversaciones de la comunidad
Tienes tres formas de cargar los datos:
1. **Arrastrar y soltar (Drag & Drop)**: Arrastra cualquier archivo `.json` de conversaciones (por ejemplo, `ejemplo_comunidad_prueba.json`) directamente sobre el recuadro punteado.
2. **Subir archivo**: Haz clic en el recuadro para seleccionarlo desde tu explorador de archivos.
3. **Casos de ejemplo rápidos**: En la barra superior, pulsa **"Caso Oficial"** para cargar un lote preconfigurado del Discord de la comunidad, o **"Lote Vacío"** para probar el filtro de descarte.

> **Resumen visual**: Una vez cargado, verás una tarjeta verde que resume el nombre de la comunidad, período, cantidad de mensajes analizados y participantes principales. El código técnico en corchetes `{}` se mantiene oculto por defecto y puedes desplegarlo si deseas inspeccionarlo.

---

### Paso 2: Seleccionar el tipo de análisis
Elige cómo deseas que la inteligencia artificial procese el lote:
- **Análisis Automático (Recomendado)**: La IA clasifica automáticamente cada mensaje por sentimiento, relevancia e intención, determinando qué mensajes merecen ser publicados en cada red.
- **Modo Personalizado (Direccionado)**: Te permite desbloquear manualmente los canales del Paso 3 para enfocar el análisis hacia una plataforma en particular.

---

### Paso 3: Explorar los canales oficiales
En este bloque dinámico se muestran las 4 categorías oficiales acordadas por el equipo:

| Canal | Propósito y Proceso en Trasfondo |
| :--- | :--- |
| **LinkedIn** | Procesa el texto para destacar aprendizajes y logros profesionales con un tono formal y llamada a la acción. |
| **Newsletter** | Sintetiza la información en un formato editorial con titulares y resúmenes para el boletín semanal. |
| **Contenido FAQ** | Detecta patrones en dudas recurrentes para formular preguntas frecuentes y derivarlas a guías o mentoría. |
| **Casos de Éxito & Testimonios** | Evalúa y puntúa el impacto de testimonios reales para dar visibilidad y reconocimiento a los miembros. |

Cada botón incluye un contador (ej. *"2 publicaciones"*, *"1 sugerencia"*) que indica cuántas propuestas se detectaron para ese formato.

---

### Paso 4: Revisión Humana (HITL) y Publicación
Al desplazarte hacia abajo verás las propuestas en un diseño espacioso de dos columnas:

1. **Indicador de Calidad**: Cada tarjeta muestra una valoración amigable (ej. `⭐ Impacto Excelente (95%)` o `✓ Impacto Alto (80%)`).
2. **Edición con un clic (✏️)**: Si deseas retocar el texto antes de publicarlo, haz clic en el ícono del lápiz para activar el editor en línea, ajusta el contenido y presiona **Guardar**.
3. **Aprobación Humana**: Puedes marcar la propuesta como **Aprobado** (verde), **Pendiente** (amarillo) o **Rechazado** (rojo). Esta acción se sincroniza en tiempo real con el backend mediante la API de revisión.
4. **Copiar al portapapeles**: Pulsa el botón de copiar para llevarte el texto a cualquier otra herramienta.
5. **Barra de Publicación Directa**: La barra inferior te permite publicar de inmediato la propuesta seleccionada en **LinkedIn**, **Newsletter** o **Discord**.

---

## 🧩 Estructura del Proyecto y Explicación de Componentes

Los componentes modulares se encuentran en `frontend/src/components/`:

```
frontend/src/
├── app/
│   ├── api/
│   │   ├── health/route.ts              # Chequeo de salud del backend FastAPI
│   │   ├── pipeline/process/route.ts    # Proxy BFF hacia POST /api/v1/pipeline/process
│   │   └── review/assets/[id]/route.ts  # Proxy BFF hacia PATCH /api/v1/review/assets/{id}
│   ├── layout.tsx                       # Layout raíz con fuentes e infraestructura visual
│   └── page.tsx                         # Orquestador principal de estado y vista general
├── components/
│   ├── Header.tsx                       # Barra superior con estado del servidor y cargas rápidas
│   ├── Step1JsonInput.tsx               # Carga, Drag & Drop, resumen amigable y validador JSON
│   ├── Step2AnalysisType.tsx            # Selección de modalidad (Automático / Personalizado)
│   ├── Step3ActionBlock.tsx            # Bloque 2x2 de canales oficiales con explicaciones
│   ├── Step4ResultsList.tsx             # Grid espacioso de tarjetas, editor en línea (✏️) y HITL
│   └── SocialChannelBar.tsx             # Barra inferior para despacho a redes sociales
└── types/
    └── backend.ts                       # Tipos TypeScript y contratos de datos oficiales
```

### Detalle de Componentes Clave:

- **[`Header.tsx`](src/components/Header.tsx)**:
  Gestiona la cabecera de la aplicación. Consulta periódicamente `/api/health` para mostrar si el backend de Python está online (`Servidor Conectado`) o si se encuentra en modo fallback (`Modo Demostración`). Provee accesos directos para cargar casos de prueba con un solo clic.

- **[`Step1JsonInput.tsx`](src/components/Step1JsonInput.tsx)**:
  Controla la entrada de datos. Soporta arrastrar archivos (`onDragOver`, `onDrop`), carga mediante selector de archivos y edición manual. Para usuarios no técnicos, genera un resumen instantáneo con los autores y canales detectados; para usuarios técnicos, ofrece formateo automático y validación sintáctica de JSON.

- **[`Step2AnalysisType.tsx`](src/components/Step2AnalysisType.tsx)**:
  Presenta las opciones de análisis mediante tarjetas claras. Traduce la intención del usuario para disparar la orquestación global o habilitar la exploración selectiva.

- **[`Step3ActionBlock.tsx`](src/components/Step3ActionBlock.tsx)**:
  Representa los 4 destinos editoriales oficiales. Contiene subtítulos que explican de forma transparente qué transformación realiza la IA detrás de escena y muestra las insignias de conteo resultantes.

- **[`Step4ResultsList.tsx`](src/components/Step4ResultsList.tsx)**:
  El área de trabajo principal para el curador de contenido. Organiza las tarjetas en una cuadrícula amplia sin scrolls restrictivos. Integra el flujo **Human-in-the-Loop (HITL)**, permitiendo editar en caliente el texto de la IA y registrar el estado de aprobación.

- **[`SocialChannelBar.tsx`](src/components/SocialChannelBar.tsx)**:
  Barra de acciones al pie de página que permite ejecutar el envío a canales finales y confirma la publicación mediante notificaciones interactivas.

---

## 🔄 Arquitectura de Comunicación (BFF)

Para garantizar estabilidad y seguridad, el frontend utiliza el patrón **Backend-For-Frontend (BFF)** a través de Route Handlers de Next.js:

```
[Navegador Web / React]
        │
        ▼ (Peticiones internas sin problemas de CORS)
[Next.js API Routes en /api/*]
        │
        ├─► Timeout extendido de 60-70s (adecuado para llamadas con Gemini y LangGraph)
        ├─► Filtro inteligente de candidatos de demostración
        │
        ▼
[FastAPI Backend en http://localhost:8000]
        │
        ├─► POST  /api/v1/pipeline/process
        ├─► PATCH /api/v1/review/assets/{candidate_id}
        └─► GET   /api/v1/system/health
```

- **Resiliencia ante caídas**: Si el backend de Python no estuviera en ejecución, el proxy activa automáticamente un simulador local que permite seguir navegando la interfaz y probando el flujo completo.

---

## 📄 Contrato de Datos JSON

El archivo de entrada debe cumplir con el modelo oficial `SolicitudProcesamiento`:

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

Puedes encontrar ejemplos listos para probar en:
- `ejemplo_comunidad_prueba.json` (ubicado en tu Escritorio y en la carpeta general de cursos).
- Los botones de carga rápida en la cabecera de la aplicación.
