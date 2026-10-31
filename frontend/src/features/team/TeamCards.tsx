import type { CSSProperties } from "react";
import { KeyRound, Loader2, UserRoundCheck, UserRoundX, X } from "lucide-react";
import { ROLES, toneFor, initials, fecha, fechaHora, trackSpot } from "@/features/team/utils";
import { ROL_LABEL, type Invitacion, type RolUsuario, type Usuario } from "@/types/auth";

interface PersonCardProps {
  persona: Usuario;
  esYo: boolean;
  busy: boolean;
  onRol: (rol: RolUsuario) => void;
  onRecuperar: () => void;
  onDesactivar: () => void;
  onReactivar: () => void;
}

export function PersonCard({ persona, esYo, busy, onRol, onRecuperar, onDesactivar, onReactivar }: PersonCardProps) {
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

export function InvitationCard({ invitacion, busy, onRevocar }: { invitacion: Invitacion; busy: boolean; onRevocar: () => void }) {
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
