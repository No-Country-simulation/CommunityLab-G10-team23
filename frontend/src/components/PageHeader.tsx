import type { ReactNode } from "react";

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

// Encabezado de cada vista [figma:sidebar]: icono, título de 24px en negrita, subtítulo de
// 14px al 60% y acciones a la derecha.
export function PageHeader({ icon, title, subtitle, actions, children }: PageHeaderProps) {
  return (
    <header className="bg-white px-4 sm:px-5 pt-6 sm:pt-[30px] pb-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-2.5 min-w-0 flex-1 basis-80">
          <span className="text-brand-600 mt-0.5 shrink-0">{icon}</span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink-900 leading-tight">{title}</h1>
            <p className="text-sm text-ink-900/60">{subtitle}</p>
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
