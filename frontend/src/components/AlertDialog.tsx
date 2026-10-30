import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface AlertDialogProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}

// Aviso propio de la aplicación (sustituye a window.alert/confirm del navegador).
export function AlertDialog({ icon, title, children, actions, onClose }: AlertDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-60 bg-ink-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-body"
        className="bg-white w-full max-w-md rounded-2xl border border-ink-200 shadow-2xl p-6 flex flex-col gap-4"
      >
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-xl bg-warning-100 text-warning-800 shrink-0">{icon}</span>
          <div className="min-w-0">
            <h2 id="alert-dialog-title" className="text-lg font-bold text-ink-900">
              {title}
            </h2>
            <div id="alert-dialog-body" className="text-sm text-ink-600 mt-1 leading-relaxed">
              {children}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2.5">{actions}</div>
      </div>
    </div>
  );
}
