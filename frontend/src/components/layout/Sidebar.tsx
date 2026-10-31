import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, BarChart3, CheckCircle2, LayoutList, LogOut, Menu, Moon, RefreshCw, Sun, Table as TableIcon, Users, X } from "lucide-react";
import { logout } from "@/lib/client/api";
import { ROL_LABEL, tieneRol, type RolUsuario, type Usuario } from "@/types/auth";

export type AppView = "revision" | "tabla" | "dashboard" | "equipo";

// Cada sección indica el rol mínimo para verla; el backend vuelve a comprobarlo en cada acción.
const SECTIONS: { title: string; minRol: RolUsuario; items: { view: AppView; label: string; icon: ReactNode }[] }[] = [
  {
    title: "Revisión",
    minRol: "revisor",
    items: [{ view: "revision", label: "Bandeja", icon: <LayoutList className="w-4 h-4" /> }],
  },
  {
    title: "Historial",
    minRol: "lector",
    items: [
      { view: "tabla", label: "Tabla de casos", icon: <TableIcon className="w-4 h-4" /> },
      { view: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
    ],
  },
  {
    title: "Administración",
    minRol: "admin",
    items: [{ view: "equipo", label: "Equipo", icon: <Users className="w-4 h-4" /> }],
  },
];

/** Vistas que el rol puede abrir, en el orden de la barra lateral. */
export const viewsFor = (usuario: Usuario | null): AppView[] =>
  SECTIONS.filter((section) => tieneRol(usuario, section.minRol)).flatMap((section) => section.items.map((i) => i.view));

interface SidebarProps {
  view: AppView;
  onViewChange: (view: AppView) => void;
  usuario: Usuario | null;
}

// Navegación lateral [figma:sidebar]: 227px, fondo #08002e, ítems de 16px con opacidad 0.8
// y el activo resaltado. En pantallas pequeñas se abre como panel deslizante.
// Lleva los rayos de luz de la portada (sin animar, para no distraer mientras se revisa) y el
// área de trabajo queda neutra: la identidad vive en el marco de navegación, no sobre los datos.
const sidebarRays = (
  <div className="godray-frame" aria-hidden="true">
    <div className="godray godray--dark godray--still" style={{ opacity: 0.35, ["--godray-mask" as string]: "0 0" }} />
  </div>
);
export function Sidebar({ view, onViewChange, usuario }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline" | "demo">("checking");
  const [leaving, setLeaving] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const checkHealth = async () => {
    try {
      setBackendStatus("checking");
      const res = await fetch("/api/health");
      const data = await res.json();
      setBackendStatus(data.status === "online" || data.status === "demo" ? data.status : "offline");
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
      {SECTIONS.filter((section) => tieneRol(usuario, section.minRol)).map((section) => (
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

  // El clic y aria-pressed los gestiona el script de tema de BaseLayout (data-theme-toggle).
  const themeToggle = (
    <button
      type="button"
      data-theme-toggle
      className="theme-toggle p-2 rounded-[10px] text-chrome-text hover:bg-chrome-active transition cursor-pointer"
      aria-label="Modo oscuro"
      title="Cambiar tema"
    >
      <Moon className="icon-moon w-4 h-4" aria-hidden="true" />
      <Sun className="icon-sun w-4 h-4" aria-hidden="true" />
    </button>
  );

  const status = (
    <button
      onClick={checkHealth}
      className="flex items-center gap-2.5 flex-1 min-w-0 p-2.5 text-left rounded-[10px] text-sm text-chrome-text hover:bg-chrome-active transition cursor-pointer"
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
          <AlertCircle className="w-4 h-4 text-danger-400" /> Sin conexión
        </>
      )}
      {backendStatus === "demo" && (
        <>
          <AlertCircle className="w-4 h-4 text-warning-400" /> Modo demostración
        </>
      )}
    </button>
  );

  // En modo demostración no hay sesión real que cerrar.
  const account = usuario && backendStatus !== "demo" && (
    <div className="flex items-center gap-2.5 border-t border-chrome-active pt-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-chrome-text truncate" title={usuario.email}>
          {usuario.nombre}
        </p>
        <p className="text-xs text-chrome-text/60">{ROL_LABEL[usuario.rol]}</p>
      </div>
      <button
        onClick={() => {
          setLeaving(true);
          logout();
        }}
        disabled={leaving}
        className="p-2 rounded-[10px] text-chrome-text hover:bg-chrome-active transition cursor-pointer disabled:opacity-50"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-2.5 text-chrome-text">
      <span className="brand-mark w-9 h-9" aria-hidden="true" />
      <span className="text-lg font-bold whitespace-nowrap">Community IA</span>
    </div>
  );

  return (
    <>
      {/* Barra superior en móvil y tableta */}
      <div className="lg:hidden relative isolate flex items-center justify-between gap-3 bg-chrome px-4 py-3">
        {sidebarRays}
        {brand}
        <div className="flex items-center gap-1">
          {themeToggle}
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
      </div>

      {open && <div className="lg:hidden fixed inset-0 z-40 bg-scrim" onClick={() => setOpen(false)} />}

      <aside
        id="app-sidebar"
        className={`bg-chrome isolate dark:border-r dark:border-hairline flex flex-col gap-[30px] pt-[30px] pb-5 px-5 w-[227px] shrink-0 z-50 fixed inset-y-0 left-0 transition-transform lg:relative lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarRays}
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            {status}
            {themeToggle}
          </div>
          {account}
        </div>
      </aside>
    </>
  );
}
