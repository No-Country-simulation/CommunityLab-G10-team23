import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, BarChart3, CheckCircle2, LayoutList, Menu, RefreshCw, Table as TableIcon, X } from "lucide-react";

export type AppView = "revision" | "tabla" | "dashboard";

const SECTIONS: { title: string; items: { view: AppView; label: string; icon: ReactNode }[] }[] = [
  {
    title: "Revisión",
    items: [{ view: "revision", label: "Bandeja", icon: <LayoutList className="w-4 h-4" /> }],
  },
  {
    title: "Historial",
    items: [
      { view: "tabla", label: "Tabla de casos", icon: <TableIcon className="w-4 h-4" /> },
      { view: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
    ],
  },
];

interface SidebarProps {
  view: AppView;
  onViewChange: (view: AppView) => void;
}

// Navegación lateral [figma:sidebar]: 227px, fondo #08002e, ítems de 16px con opacidad 0.8
// y el activo resaltado. En pantallas pequeñas se abre como panel deslizante.
export function Sidebar({ view, onViewChange }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const checkHealth = async () => {
    try {
      setBackendStatus("checking");
      const res = await fetch("/api/health");
      const data = await res.json();
      setBackendStatus(data.status === "online" ? "online" : "offline");
    } catch {
      setBackendStatus("offline");
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const navigate = (next: AppView) => {
    onViewChange(next);
    setOpen(false);
  };

  const nav = (
    <nav aria-label="Navegación principal" className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto">
      {SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-2.5">
          <p className="text-sm text-chrome-text/60 px-2.5">{section.title}</p>
          {section.items.map((item) => {
            const active = item.view === view;
            return (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 w-full text-left text-base text-chrome-text cursor-pointer transition ${
                  active
                    ? "bg-chrome-active rounded-[5px] p-2.5 font-semibold"
                    : "rounded-[10px] px-2.5 py-1.5 opacity-80 hover:opacity-100 hover:bg-chrome-active"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const status = (
    <button
      onClick={checkHealth}
      className="flex items-center gap-2.5 w-full p-2.5 rounded-[10px] text-sm text-chrome-text hover:bg-chrome-active transition cursor-pointer"
      title="Volver a comprobar la conexión con el backend"
    >
      {backendStatus === "checking" && (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" /> Conectando…
        </>
      )}
      {backendStatus === "online" && (
        <>
          <CheckCircle2 className="w-4 h-4 text-success-400" /> Conectado
        </>
      )}
      {backendStatus === "offline" && (
        <>
          <AlertCircle className="w-4 h-4 text-warning-400" /> Modo demostración
        </>
      )}
    </button>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <img src="/logo.jpg" alt="" className="w-9 h-9 rounded-xl object-cover" />
      <span className="text-lg font-bold text-chrome-text whitespace-nowrap">Community IA</span>
    </div>
  );

  return (
    <>
      {/* Barra superior en móvil y tableta */}
      <div className="lg:hidden flex items-center justify-between gap-3 bg-chrome px-4 py-3">
        {brand}
        <button
          ref={menuButtonRef}
          onClick={() => setOpen(true)}
          className="p-2 rounded-[10px] text-chrome-text hover:bg-chrome-active cursor-pointer"
          aria-label="Abrir navegación"
          aria-expanded={open}
          aria-controls="app-sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {open && <div className="lg:hidden fixed inset-0 z-40 bg-ink-900/50" onClick={() => setOpen(false)} />}

      <aside
        id="app-sidebar"
        className={`bg-chrome flex flex-col gap-[30px] pt-[30px] pb-5 px-5 w-[227px] shrink-0 z-50 fixed inset-y-0 left-0 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          {brand}
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden p-1.5 rounded-[10px] text-chrome-text hover:bg-chrome-active cursor-pointer"
            aria-label="Cerrar navegación"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {nav}
        {status}
      </aside>
    </>
  );
}
