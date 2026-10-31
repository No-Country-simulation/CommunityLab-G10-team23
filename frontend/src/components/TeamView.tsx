import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, MouseEvent, ReactNode } from "react";
import { AlertTriangle, Check, Copy, KeyRound, Loader2, MailPlus, RefreshCw, UserRoundCheck, UserRoundX, Users, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AlertDialog } from "@/components/AlertDialog";
import { apiFetch } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import {
  ROL_DESCRIPCION,
  ROL_LABEL,
  type Invitacion,
  type InvitacionCreada,
  type RolUsuario,
  type Usuario,
} from "@/types/auth";

type Notify = (msg: string, type: "success" | "error" | "info") => void;

interface TeamViewProps {
  usuario: Usuario;
  notify: Notify;
}

const ROLES: RolUsuario[] = ["admin", "revisor", "lector"];

// Tonos pastel de las tarjetas [ref] (Dong): cada persona conserva el suyo entre visitas.
const TONES = ["249 134 157", "166 139 249", "129 236 248", "240 144 249", "139 248 119", "251 195 182"];
const toneFor = (key: string) => TONES[[...key].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TONES.length];

const initials = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api/usuarios${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data as T;
}

// El halo de la tarjeta sigue al puntero (solo responde a la persona; nada se mueve solo).
function trackSpot(event: MouseEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
  event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
}

export function TeamView({ usuario, notify }: TeamViewProps) {
  const [personas, setPersonas] = useState<Usuario[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [enlace, setEnlace] = useState<InvitacionCreada | null>(null);
  const [confirmar, setConfirmar] = useState<
    { tipo: "desactivar"; persona: Usuario } | { tipo: "revocar"; invitacion: Invitacion } | null
  >(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [lista, pendientes] = await Promise.all([
        request<Usuario[]>(""),
        request<Invitacion[]>("/invitaciones"),
      ]);
      setPersonas(lista);
      setInvitaciones(pendientes);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  const cambiarRol = (persona: Usuario, rol: RolUsuario) =>
    run(persona.id, async () => {
      const actualizada = await request<Usuario>(`/${persona.id}`, { method: "PATCH", body: JSON.stringify({ rol }) });
      setPersonas((prev) => prev.map((p) => (p.id === actualizada.id ? actualizada : p)));
      notify(`${persona.nombre} ahora tiene el rol ${ROL_LABEL[rol]}. Tendrá que iniciar sesión de nuevo.`, "success");
    });

  const cambiarEstado = (persona: Usuario, activo: boolean) =>
    run(persona.id, async () => {
      const actualizada = await request<Usuario>(`/${persona.id}`, { method: "PATCH", body: JSON.stringify({ activo }) });
      setPersonas((prev) => prev.map((p) => (p.id === actualizada.id ? actualizada : p)));
      notify(activo ? `${persona.nombre} puede volver a entrar` : `${persona.nombre} ya no puede entrar`, "success");
    });

  const crearRecuperacion = (persona: Usuario) =>
    run(persona.id, async () => {
      setEnlace(await request<InvitacionCreada>(`/${persona.id}/recuperacion`, { method: "POST" }));
    });

  const revocar = (invitacion: Invitacion) =>
    run(invitacion.id, async () => {
      await request(`/invitaciones/${invitacion.id}`, { method: "DELETE" });
      setInvitaciones((prev) => prev.filter((i) => i.id !== invitacion.id));
      notify(`Invitación de ${invitacion.email} anulada`, "success");
    });

  const activas = personas.filter((p) => p.activo).length;
  // Las invitaciones de registro son las que esperan a alguien nuevo; las de recuperación se muestran aparte.
  const pendientes = invitaciones.filter((i) => i.tipo === "registro");
  const recuperaciones = invitaciones.filter((i) => i.tipo === "recuperacion");

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        icon={<Users className="w-[27px] h-[27px]" />}
        title="Equipo"
        subtitle="Invita a quienes revisan el contenido y decide qué puede hacer cada persona."
        actions={
          <button className="btn-primary" onClick={() => setInviting(true)}>
            <MailPlus className="w-4 h-4" /> Invitar persona
          </button>
        }
      />

      <main className="flex-1 min-h-0 overflow-y-auto bg-ink-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-10">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-ink-600">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600" /> Cargando el equipo…
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <p className="text-sm text-ink-700">No se pudo cargar el equipo: {loadError}</p>
              <button className="btn-ghost" onClick={load}>
                <RefreshCw className="w-4 h-4" /> Reintentar
              </button>
            </div>
          ) : (
            <>
              <section aria-labelledby="personas-titulo" className="flex flex-col gap-4">
                {/* Recuento como titular, a la manera del "Total N posts" de Dong */}
                <h2 id="personas-titulo" className="text-2xl font-semibold text-ink-900">
                  {personas.length === 1 ? "1 persona en el equipo" : `${personas.length} personas en el equipo`}
                  {activas < personas.length && (
                    <span className="block text-sm font-normal text-ink-500 mt-1">
                      {personas.length - activas === 1 ? "1 cuenta desactivada" : `${personas.length - activas} cuentas desactivadas`}
                    </span>
                  )}
                </h2>
                <ul className="flex flex-col gap-3">
                  {personas.map((persona) => (
                    <PersonCard
                      key={persona.id}
                      persona={persona}
                      esYo={persona.id === usuario.id}
                      busy={busyId === persona.id}
                      onRol={(rol) => cambiarRol(persona, rol)}
                      onRecuperar={() => crearRecuperacion(persona)}
                      onDesactivar={() => setConfirmar({ tipo: "desactivar", persona })}
                      onReactivar={() => cambiarEstado(persona, true)}
                    />
                  ))}
                </ul>
              </section>

              <section aria-labelledby="invitaciones-titulo" className="flex flex-col gap-4">
                <h2 id="invitaciones-titulo" className="text-lg font-semibold text-ink-900">
                  Invitaciones sin usar
                </h2>
                {pendientes.length === 0 ? (
                  <p className="text-sm text-ink-500">
                    No hay invitaciones esperando respuesta. Las que envíes aparecerán aquí hasta que la persona cree su
                    cuenta o el enlace caduque.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {pendientes.map((invitacion) => (
                      <InvitationCard
                        key={invitacion.id}
                        invitacion={invitacion}
                        busy={busyId === invitacion.id}
                        onRevocar={() => setConfirmar({ tipo: "revocar", invitacion })}
                      />
                    ))}
                  </ul>
                )}
                {recuperaciones.length > 0 && (
                  <p className="text-sm text-ink-500">
                    {recuperaciones.length === 1
                      ? "1 enlace para crear contraseña nueva sigue sin usarse. Caduca a las 24 horas de crearse."
                      : `${recuperaciones.length} enlaces para crear contraseña nueva siguen sin usarse. Caducan a las 24 horas de crearse.`}
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {inviting && (
        <InviteDialog
          onClose={() => setInviting(false)}
          onCreated={(nueva) => {
            setInviting(false);
            setEnlace(nueva);
            setInvitaciones((prev) => [nueva, ...prev.filter((i) => !(i.email === nueva.email && i.tipo === nueva.tipo))]);
          }}
        />
      )}

      {enlace && <LinkDialog enlace={enlace} onClose={() => setEnlace(null)} />}

      {confirmar?.tipo === "desactivar" && (
        <AlertDialog
          icon={<UserRoundX className="w-5 h-5" />}
          title={`¿Desactivar a ${confirmar.persona.nombre}?`}
          onClose={() => setConfirmar(null)}
          actions={
            <>
              <button className="btn-ghost" onClick={() => setConfirmar(null)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  cambiarEstado(confirmar.persona, false);
                  setConfirmar(null);
                }}
              >
                Desactivar cuenta
              </button>
            </>
          }
        >
          Se cerrarán sus sesiones y no podrá entrar hasta que reactives la cuenta. Lo que ya revisó se conserva.
        </AlertDialog>
      )}

      {confirmar?.tipo === "revocar" && (
        <AlertDialog
          icon={<AlertTriangle className="w-5 h-5" />}
          title="¿Anular esta invitación?"
          onClose={() => setConfirmar(null)}
          actions={
            <>
              <button className="btn-ghost" onClick={() => setConfirmar(null)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  revocar(confirmar.invitacion);
                  setConfirmar(null);
                }}
              >
                Anular invitación
              </button>
            </>
          }
        >
          El enlace enviado a {confirmar.invitacion.email} dejará de funcionar. Puedes invitar de nuevo cuando quieras.
        </AlertDialog>
      )}
    </div>
  );
}

interface PersonCardProps {
  persona: Usuario;
  esYo: boolean;
  busy: boolean;
  onRol: (rol: RolUsuario) => void;
  onRecuperar: () => void;
  onDesactivar: () => void;
  onReactivar: () => void;
}

function PersonCard({ persona, esYo, busy, onRol, onRecuperar, onDesactivar, onReactivar }: PersonCardProps) {
  const tone = toneFor(persona.id);
  return (
    <li
      className="spotlight-card p-4 sm:p-5 flex flex-col gap-4"
      style={{ "--tone": tone } as CSSProperties}
      data-muted={!persona.activo || undefined}
      onMouseMove={trackSpot}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className={`w-11 h-11 shrink-0 rounded-lg flex items-center justify-center text-sm font-semibold text-ink-900 ${
            persona.activo ? "" : "grayscale"
          }`}
          style={{ backgroundColor: `rgb(${tone} / 0.35)` }}
        >
          {initials(persona.nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-medium text-ink-900 truncate">{persona.nombre}</h3>
          <p className="text-sm text-ink-500 truncate">{persona.email}</p>
        </div>
        {busy && <Loader2 className="w-4 h-4 animate-spin text-brand-600 shrink-0 mt-1" aria-label="Guardando" />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-sm text-ink-500">Desde el {fecha(persona.creado_en)}</span>
          <span className="meta-tag">
            <span>@</span>
            <span>{ROL_LABEL[persona.rol]}</span>
          </span>
          <span className="meta-tag">
            <span>#</span>
            <span>{esYo ? "tú" : persona.activo ? "activa" : "desactivada"}</span>
          </span>
        </div>

        {!esYo && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`rol-${persona.id}`}>
              Rol de {persona.nombre}
            </label>
            <select
              id={`rol-${persona.id}`}
              value={persona.rol}
              disabled={busy || !persona.activo}
              onChange={(e) => onRol(e.target.value as RolUsuario)}
              className="table-action text-sm px-2.5 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>
                  {ROL_LABEL[rol]}
                </option>
              ))}
            </select>
            {persona.activo ? (
              <>
                <button className="table-action text-sm px-2.5" disabled={busy} onClick={onRecuperar} title="Crear un enlace para que elija una contraseña nueva">
                  <KeyRound className="w-4 h-4" /> Contraseña nueva
                </button>
                <button className="table-action text-sm px-2.5 text-danger-700" disabled={busy} onClick={onDesactivar}>
                  <UserRoundX className="w-4 h-4" /> Desactivar
                </button>
              </>
            ) : (
              <button className="table-action text-sm px-2.5" disabled={busy} onClick={onReactivar}>
                <UserRoundCheck className="w-4 h-4" /> Reactivar
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function InvitationCard({ invitacion, busy, onRevocar }: { invitacion: Invitacion; busy: boolean; onRevocar: () => void }) {
  const tone = toneFor(invitacion.email);
  return (
    <li
      className="spotlight-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
      style={{ "--tone": tone } as CSSProperties}
      data-pending
      onMouseMove={trackSpot}
    >
      <div className="min-w-0 flex flex-col gap-1">
        <p className="text-base font-medium text-ink-900 truncate">{invitacion.email}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-sm text-ink-500">Caduca el {fechaHora(invitacion.expira_en)}</span>
          <span className="meta-tag">
            <span>@</span>
            <span>{ROL_LABEL[invitacion.rol]}</span>
          </span>
        </div>
      </div>
      <button className="table-action text-sm px-2.5" disabled={busy} onClick={onRevocar}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Anular
      </button>
    </li>
  );
}

// Ventana propia (no la del navegador) con foco atrapado de forma sencilla y cierre con Escape.
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

function InviteDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (i: InvitacionCreada) => void }) {
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
function LinkDialog({ enlace, onClose }: { enlace: InvitacionCreada; onClose: () => void }) {
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
