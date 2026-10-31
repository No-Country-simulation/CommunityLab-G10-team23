# Migración del frontend de Next.js a Astro

Rama de trabajo: `feature/astro-migration`. La implementación Next.js original queda recuperable desde `main` (commit `bea5f8a`).

## Estado inicial (Next.js 15)

| Pieza | Archivo(s) | Naturaleza |
| :--- | :--- | :--- |
| Layout raíz | `src/app/layout.tsx`, `src/app/globals.css` | Estático: `<html lang="es">`, título, favicon `/logo.jpg`, Tailwind v4 |
| Página única | `src/app/page.tsx` (cliente) | Todo el estado de la app: carga del lote, sondeo del trabajo, pestañas, filtros, revisión HITL, guardado en OCI, toasts, arrastrar y soltar, cambio de vista Bandeja/Historial |
| Componentes | `Header`, `ReviewTable`, `InteractionDetailModal`, `HistoryView` (2068 líneas) | Todos interactivos (`"use client"`) |
| BFF | 7 Route Handlers en `src/app/api/**` | Proxy a FastAPI (`BACKEND_URL`), simulación si el backend no responde |
| Utilidades | `src/lib/*`, `src/types/backend.ts` | TypeScript puro, sin dependencia de Next |
| Estáticos | `public/logo.jpg`, `public/logo_comunitylab.jpg` | |
| Despliegue | `Dockerfile` (`node:20`, `next start` en :3000) | `BACKEND_URL=http://backend:8000` desde `docker-compose.yml` |

Rutas BFF que deben conservarse con el mismo contrato:

- `GET /api/health`
- `POST /api/pipeline/jobs` (simula si el backend falla o responde 5xx)
- `GET /api/pipeline/jobs/{id}?desde=n`
- `PATCH /api/review/assets/{id}` (IDs no reales se confirman localmente)
- `GET /api/storage/packages`
- `GET /api/storage/packages/{...slug}`
- `POST /api/storage/publish` (timeout 180 s)

## Análisis: qué va a `.astro` y qué queda en React

La interfaz es una sola pantalla cuyo estado está compartido: la cabecera muestra el avance y los botones del lote, la bandeja y el historial se alternan sin perder el lote en curso, y al guardar en OCI se limpia la bandeja y se salta al historial. Partirla en varias islas obligaría a sincronizar estado entre ellas (dependencia extra tipo nanostores) o a convertir Bandeja/Historial en páginas separadas, lo que **perdería el lote en proceso al cambiar de vista**. Por eso:

- **Astro nativo**: documento HTML, `<head>`, fuentes, estilos globales, favicon, contenedor de la página y los 7 endpoints BFF (`src/pages/api/**`).
- **React (una isla, `client:load`)**: `ReviewApp` (antes `page.tsx`) con sus componentes. Se renderiza en el servidor y se hidrata al cargar, así la primera pintura llega en HTML.
- **Carga diferida**: `HistoryView` (el componente más pesado) se carga con `React.lazy` solo al abrir el Historial.

## Riesgos y sustituciones

| Riesgo | Mitigación |
| :--- | :--- |
| `NextResponse` / `next/server` en el BFF | Reemplazo por `Response` estándar en endpoints de Astro (`APIRoute`) |
| `BACKEND_URL` debe leerse en tiempo de ejecución (Docker) | `process.env.BACKEND_URL` en el servidor; nunca `import.meta.env` (se reemplaza al compilar) |
| Astro 7 requiere Node ≥ 22.23 | Imagen Docker `node:22-alpine` |
| Puerto 3000 en Docker | `HOST=0.0.0.0` y `PORT=3000` en la imagen |
| Directivas `"use client"` | Se eliminan (Vite advierte por directivas de módulo) |
| `next lint` no tenía ESLint instalado | Se reemplaza por `astro check` (tipos de `.astro` y `.ts/.tsx`) |
| Clases de color dispersas (slate/indigo/emerald…) | Escalas semánticas centralizadas en `src/styles/global.css` |

## Plan por etapas

1. Documentar estado y plan (este archivo).
2. Configurar Astro: `astro.config.mjs` (salida `server`, adaptador Node standalone, React, Tailwind vía Vite), `package.json`, `tsconfig.json`.
3. Rutas y layout: `src/layouts/BaseLayout.astro`, `src/pages/index.astro`, endpoints en `src/pages/api/**`.
4. Componentes: mover `page.tsx` a `src/components/ReviewApp.tsx`; reutilizar el resto sin reescribirlos.
5. Sistema visual: tokens de color y tipografía en `src/styles/global.css` con la paleta de referencia; sustituir las familias de color de Tailwind por las escalas semánticas.
6. Hidratación: una isla `client:load`, Historial diferido.
7. Scripts y dependencias: retirar Next/PostCSS, añadir Astro y sus integraciones.
8. Verificación: `astro check`, `astro build`, servidor de producción con y sin backend, pruebas de endpoints.

Solo después de verificar la etapa 8 se eliminan `src/app/`, `next.config.mjs`, `next-env.d.ts` y `postcss.config.mjs`.

## Sistema visual

Referencia: tema "Dong" (`riceball-tw.github.io/dong`). Se descargó su CSS (`/_astro/BlogBase.*.css`) y su HTML; sus tokens están en OKLCH y se convirtieron a HEX (sRGB; los colores fuera de gama se recortaron al convertir).

| Token del proyecto | HEX | Origen en la referencia | Verificación |
| :--- | :--- | :--- | :--- |
| `brand-100` | `#e8e7ff` | `--background` claro `oklch(93.6% .032 287.2)` | Verificado (convertido) |
| `brand-400` | `#9c7cff` | `--primary-active` claro `oklch(70.2% .235 287.2)` | Verificado (convertido) |
| `brand-500` | `#8b60ff` | `--primary` claro `oklch(63.9% .258 287.2)` | Verificado (convertido, recortado a sRGB) |
| `brand-950` / `--color-chrome` | `#180046` | `--background` oscuro `oklch(16.3% .148 292.2)` | Verificado (convertido) |
| `ink-300` | `#c3c2d8` | `--border` claro `oklch(82.2% .031 287.2)` | Verificado (convertido) |
| `ink-900` / `--color-text` | `#03004a` | `--foreground` claro `oklch(16.8% .14 265.3)` | Verificado (convertido) |
| `info-100` | `#d3f0ff` | `--muted` claro `oklch(93.9% .038 234.3)` | Verificado (convertido) |
| `info-200` | `#bfdced` | `--accent` claro `oklch(87.8% .038 234.3)` | Verificado (convertido) |
| `spectrum-a…d` | `#84e052` `#52e05e` `#5286e0` `#9952e0` | `--themeColorA`, `--themeColorB`, `--mainThemeColor`, `--themeColorC` | Verificado (HEX literal) |
| `brand-600` / `--color-primary` | `#704ee8` | Derivado: mismo tono, más oscuro | Derivado (blanco sobre él 5.3:1) |
| Resto de escalas `brand`, `ink`, `success`, `danger`, `warning`, `info` | ver `src/styles/global.css` | Derivadas en OKLCH con el tono de la referencia | Derivado |

Roles semánticos definidos en `@theme`: `--color-primary`, `--color-primary-strong`, `--color-secondary`, `--color-background`, `--color-surface`, `--color-chrome`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-link`, `--color-hover`, `--color-focus`.

Contraste (WCAG 2.1) comprobado: texto `ink-900` sobre blanco 19.0:1; texto secundario `ink-500` sobre blanco 5.3:1 (antes `slate-400`, 2.6:1); botón primario blanco sobre `brand-600` 5.3:1; aprobar blanco sobre `success-600` 5.2:1; insignias `*-800` sobre `*-50` ≥ 8:1; texto `brand-200`/`ink-300` sobre la cabecera `#180046` ≥ 10:1.

Tipografía: Bricolage Grotesque (títulos) e Instrument Sans (interfaz), autoalojadas con Fontsource (sin peticiones a terceros). Única pieza expresiva: la cabecera violeta profundo de la referencia y su franja multicolor, usada como barra real de avance del lote.

## Diferencias respecto al frontend Next.js

- Arrastrar y soltar un `.json` ahora también funciona en la pantalla vacía (antes el texto lo indicaba pero solo funcionaba sobre la tabla).
- El Historial muestra un estado de error con «Reintentar» cuando el almacenamiento no responde (antes mostraba «No se encontraron casos»).
- La cabecera muestra una barra de avance (`role="progressbar"`) además del texto «Procesando X de N».
- El Historial se descarga al abrirlo por primera vez (indicador «Cargando historial…»).
- Ajustes de accesibilidad: `aria-pressed` en el selector de vistas, `aria-label` en el buscador, foco visible global, `prefers-reduced-motion`.
