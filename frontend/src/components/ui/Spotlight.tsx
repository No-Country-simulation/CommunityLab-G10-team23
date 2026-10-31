import { useRef, type CSSProperties, type ReactNode } from "react";

// Versión React de SpotlightGallery.astro / SpotlightCard.astro (estilos en styles/spotlight.css),
// para usar las tarjetas de la portada dentro de la app.

/** Los seis tonos de los pasos de la portada, en el mismo orden. */
export const SPOT_TONES = ["#f9869d", "#81ecf8", "#a68bf9", "#f090f9", "#8bf877", "#fbc3b6"];

/** Cuadrícula que pasa la posición del puntero a todas sus tarjetas: el halo se derrama sobre las vecinas. */
export function SpotlightGallery({ children, className = "" }: { children: ReactNode; className?: string }) {
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
    <div ref={ref} onMouseMove={onMouseMove} className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${className}`}>
      {children}
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
