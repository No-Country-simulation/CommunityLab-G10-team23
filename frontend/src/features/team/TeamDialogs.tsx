import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Check, Copy, Loader2, MailPlus, X } from "lucide-react";
import { copyToClipboard } from "@/lib/client/clipboard";
import { ROLES, fechaHora, request } from "@/features/team/utils";
import { ROL_DESCRIPCION, ROL_LABEL, type InvitacionCreada, type RolUsuario } from "@/types/auth";

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>("input:not([type=radio])") ?? panel?.querySelector<HTMLElement>("button"))?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-60 bg-scrim backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-dialog-title"
        className="bg-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-ink-200 shadow-2xl p-6 flex flex-col gap-5 max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="team-dialog-title" className="text-lg font-bold text-ink-900">
            {title}
          </h2>
          <button className="p-1.5 -m-1.5 rounded-lg text-ink-500 hover:bg-ink-100 cursor-pointer" onClick={onClose} aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function InviteDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (i: InvitacionCreada) => void }) {
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<RolUsuario>("revisor");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Escribe un correo válido, por ejemplo ana@tucomunidad.org.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      onCreated(await request<InvitacionCreada>("/invitaciones", { method: "POST", body: JSON.stringify({ email: email.trim(), rol }) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSending(false);
    }
  };

  return (
    <Dialog title="Invitar a una persona" onClose={onClose}>
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
        {error && (
          <p role="alert" className="rounded-[10px] bg-danger-50 text-danger-700 text-sm px-3.5 py-3">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="invite-email" className="text-sm font-medium text-ink-700">
            Correo
          </label>
          <input
            id="invite-email"
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            required
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-ink-700 mb-1.5">Qué podrá hacer</legend>
          {ROLES.map((opcion) => (
            <label
              key={opcion}
              className={`flex items-start gap-3 rounded-[10px] border p-3 cursor-pointer transition-colors ${
                rol === opcion ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:bg-ink-50"
              }`}
            >
              <input
                type="radio"
                name="rol"
                value={opcion}
                checked={rol === opcion}
                onChange={() => setRol(opcion)}
                className="mt-1 accent-brand-600"
              />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-ink-900">{ROL_LABEL[opcion]}</span>
                <span className="text-sm text-ink-500">{ROL_DESCRIPCION[opcion]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap justify-end gap-2.5">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailPlus className="w-4 h-4" />} Crear invitación
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// El token solo existe en esta respuesta: se muestra una vez para que la administración lo comparta.
export function LinkDialog({ enlace, onClose }: { enlace: InvitacionCreada; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const esRegistro = enlace.tipo === "registro";
  const url = `${window.location.origin}/${esRegistro ? "registro" : "restablecer"}?token=${encodeURIComponent(enlace.token)}`;

  const copy = async () => {
    if (await copyToClipboard(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog title={esRegistro ? "Invitación lista" : "Enlace para contraseña nueva"} onClose={onClose}>
      <p className="text-sm text-ink-600 leading-relaxed">
        {esRegistro
          ? `Envía este enlace a ${enlace.email}. Con él creará su cuenta con el rol ${ROL_LABEL[enlace.rol]}.`
          : `Envía este enlace a ${enlace.email}. Con él elegirá una contraseña nueva y se cerrarán sus sesiones abiertas.`}
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor="invite-link" className="text-sm font-medium text-ink-700">
          Enlace
        </label>
        <div className="flex gap-2">
          <input id="invite-link" readOnly value={url} className="field-input text-sm" onFocus={(e) => e.currentTarget.select()} />
          <button className="btn-primary shrink-0" onClick={copy}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
        <p className="text-sm text-ink-500">
          Funciona una sola vez y caduca el {fechaHora(enlace.expira_en)}. No podrás volver a verlo: si se pierde, crea
          otro y el anterior dejará de funcionar.
        </p>
      </div>
      <div className="flex justify-end">
        <button className="btn-ghost" onClick={onClose}>
          Listo
        </button>
      </div>
    </Dialog>
  );
}
