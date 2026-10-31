# Rediseño con referencias de Figma

Sobre el frontend Astro ya migrado (ver `MIGRACION_ASTRO.md`). No cambia la arquitectura, el backend ni los contratos de API.

## Acceso a las referencias (MCP de Figma)

| Referencia | Acceso MCP | Elementos usados |
| :--- | :--- | :--- |
| Permission Table UI (`community/file/1582338928445145627`) | **Sin acceso**: los enlaces de Figma Community no tienen clave de archivo | Ninguno. Sustituido a pedido por *Selectable Summary Cards* (sin referencia de Figma) |
| Table UI Design Template (`community/file/1093795492733605361`) | **Sin acceso** (mismo motivo) | Ninguno. Sustituido a pedido por Data Table v3 |
| Data Table v3 (`xtvpw3Yh9DrRbbbwKc6FQU`, duplicado por el usuario; nodo `213:701`) | Parcial: estructura de la página y contexto de la cabecera de columnas. El resto quedó bloqueado por el **límite de llamadas del plan Starter** del MCP | Cabecera, alturas de fila, grises, sombra de botón |
| OWA Wizzard Stepper / Table / Sidebar UI (`QdFvnDUqRmQ2DM8gncPmHa`, nodos `2:2087`, `2:2231`) | Inspeccionado (metadatos, contexto de diseño, capturas) | Sidebar, encabezado de página, botones píldora, tipografía Work Sans, colores de texto |
| 100 Mesh Gradients (`GQfq09j6K6vDmkUrwBttjg`, nodos `203:16`, `19:60`) | Inspeccionado. Los degradados son **imágenes PNG**, no rellenos vectoriales | Colores **muestreados** de la imagen `203:16` |
| Smart Charts Kit (`bTCTSkww6rmIgqnJ96EgdH`, nodos `3:100`, `17:25`, `10:65`) | Inspeccionado | Anillo (Chart 3), barras horizontales (Chart 12), columnas apiladas (Chart 6), tarjetas, colores y sombra |

Para terminar de alinear la tabla con Data Table v3 (filas, insignias, paginación y pestañas) hace falta volver a consultar el archivo cuando el límite del MCP lo permita o con un plan con más llamadas.

## Valores aplicados

| Token | Valor | Origen |
| :--- | :--- | :--- |
| `--color-chrome` (sidebar) | `#08002e` | Verificado, Sidebar UI |
| `--color-chrome-text`, `brand-100` | `#e8e3ff` | Verificado, Sidebar UI |
| `--color-chrome-active` | `rgb(232 227 255 / 0.1)` | Verificado, Sidebar UI |
| `ink-900` (texto principal) | `#040110` | Verificado, Sidebar UI |
| `--gradient-primary` | `#2900e2 → #7155ed` | Verificado. El final original `#8266ff` (3.97:1 con blanco) se sustituye por la parada `#7155ed` del logo del mismo archivo (4.97:1) |
| `--gradient-primary-hover` | `#2100b5 → #5939e9` | `#5939e9` verificado (logo); `#2100b5` derivado |
| `--gradient-secondary` | `#3c0399 → #4f61af` | Muestreado de la imagen del nodo `203:16` (≥ 5.7:1 con blanco) |
| `--chart-*` | violeta `#b09fff→#8d79f6`, azul `#7ad3ff→#4fbaf0`, amarillo `#ffd572→#febd38`, verde `#99ffa3→#68ee76`, rojo `#fe6c6c→#fe464b`, naranja `#ff9364→#f25f33` | Verificado, Smart Charts |
| `--color-chart-track` | `#a08cfb` al 20 % | Verificado, Smart Charts (Chart 6) |
| `--color-chart-text` | `#454459` | Verificado, Smart Charts |
| `--shadow-card` | `0 5px 25px rgb(0 0 0 / 0.1)` | Verificado, Smart Charts (Shadow 1) |
| Tipografía | Work Sans | Verificado, Sidebar UI |
| `--color-table-head` | `rgb(247 249 252 / 0.8)` + `blur(4px)` | Verificado, Data Table v3 (cabecera) |
| `--color-table-border` | `#e9edf5` | Verificado, Data Table v3 (Gray/50) |
| `--color-table-muted` | `#687182` (4.67:1 sobre la cabecera) | Verificado, Data Table v3 (Gray/500) |
| `--color-table-text` | `#171c26` | Verificado, Data Table v3 (Gray/900) |
| `--shadow-control` | `0 0 0 1px #464f6029, 0 1px 1px #0000001a` | Verificado, Data Table v3 (sd-button/default) |
| Cabecera de tabla | 34px, padding 8×10px (20px en la 1.ª columna), 12px/18px, peso 500, 0.36px, mayúsculas | Verificado, Data Table v3 |
| Filas | 48px de alto | Verificado por metadatos (no se pudo leer el estilo del texto de las filas) |

No verificado en Data Table v3 por el límite de llamadas: estilo del texto de las filas, insignias de estado, paginación y pestañas. Se conservan los de Community IA. La fuente del archivo (Inter) no se adopta para mantener una sola familia (Work Sans).

Los colores de estado (aprobado, rechazado, pendiente) siguen siendo sólidos en insignias y etiquetas. Los degradados solo se usan en el botón principal, la tarjeta destacada del dashboard, la barra de avance y los rellenos de gráficos, siempre con el valor numérico al lado.

## Cambios

- **Estructura**: sidebar (`Sidebar.tsx`) con Revisión › Bandeja e Historial › Tabla de casos / Dashboard; panel deslizante en pantallas < 1024 px. Encabezado de página compartido (`PageHeader.tsx`). Se elimina `Header.tsx`: el estado del backend pasa a la sidebar y las acciones del lote al encabezado.
- **Paneles de detalle**: la bandeja y el historial usan el mismo componente (`DetailPanel.tsx`), con la estructura del panel del historial. Cada uno conserva sus acciones (editar, aprobar, rechazar y publicar en la bandeja; detalle/JSON y solo lectura en el historial).
- **Dashboard**: mismas métricas y cálculos (`dashboardStats`, `wordCloudData`). Tarjeta destacada con el total de interacciones; anillo con aprobados/rechazados/pendientes; columnas apiladas por canal; barras de sentimiento y relevancia; nube de temas sin cambios de lógica.
- **Tarjetas de estado** (`StatusCards.tsx`): bandeja (Pendientes, Aprobados, Rechazados, Descartados) e historial (Todos, Aprobados, Rechazados). Muestran nombre, cantidad y una métrica secundaria (porcentaje sobre la pestaña, el lote o los casos del período), filtran la tabla y marcan la activa con borde, fondo, check y `aria-pressed`. Jerarquía: tarjetas → filtro por contenido → tabla. "Descartados" reutiliza la vista de descartadas existente.
- **Tablas**: clase `.data-table` compartida por la bandeja y el historial; fila resaltada mientras su panel está abierto (`data-selected`); botones de fila con `.table-action`. Se conservan ordenamiento, paginación, filtros y acciones.
- **Botones**: clases `.btn-primary`, `.btn-soft` y `.btn-ghost` en `global.css`.
