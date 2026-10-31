import { useRef, type CSSProperties, type ReactNode } from "react";

// Versión React de SpotlightGallery.astro / SpotlightCard.astro (estilos en styles/spotlight.css),
// para usar las tarjetas de la portada dentro de la app.

/** Los seis tonos de los pasos de la portada, en el mismo orden. */
export const SPOT_TONES = ["#f9869d", "#81ecf8", "#a68bf9", "#f090f9", "#8bf877", "#fbc3b6"];

// Las columnas dependen del ancho del contenedor (no de la ventana): dentro de la app la barra
// lateral resta espacio. Con 3 columnas cada tarjeta mantiene al menos ~300px para el texto.
const COLUMNS = {
  2: "md:grid-cols-2",
  3: "@xl:grid-cols-2 @4xl:grid-cols-3",
};

/** Cuadrícula que pasa la posición del puntero a todas sus tarjetas: el halo se derrama sobre las vecinas. */
export function SpotlightGallery({
  children,
  columns = 2,
  className = "",
}: {
  children: ReactNode;
  /** Máximo de tarjetas por fila; en pantallas angostas bajan a 2 y a 1. */
  columns?: 2 | 3;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const waiting = useRef(false);

  const onMouseMove = (e: React.MouseEvent) => {
    if (waiting.current || !ref.current) return;
    waiting.current = true;
    setTimeout(() => (waiting.current = false), 10);
    for (const card of ref.current.querySelectorAll<HTMLElement>(".spot-card")) {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
      card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    }
  };

  return (
    <div className="@container">
      <div ref={ref} onMouseMove={onMouseMove} className={`grid grid-cols-1 gap-4 ${COLUMNS[columns]} ${className}`}>
        {children}
      </div>
    </div>
  );
}

export function SpotlightCard({
  tone,
  icon,
  children,
  className = "",
}: {
  tone: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // Dentro de la app el relleno es la superficie de las tarjetas, no el fondo de la portada.
  const style = { "--spot-tone": tone, "--spot-surface": "var(--color-surface)" } as CSSProperties;
  return (
    <div className={`spot-card ${className}`} style={style}>
      <div className="spot-content">
        <div className={`spot-inner ${icon ? "with-icon" : ""}`}>
          {icon && (
            <div className="spot-icon" aria-hidden="true">
              {icon}
            </div>
          )}
          <div className="spot-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
