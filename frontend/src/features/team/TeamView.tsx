import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, MailPlus, RefreshCw, UserRoundX, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { PersonCard, InvitationCard } from "@/features/team/TeamCards";
import { InviteDialog, LinkDialog } from "@/features/team/TeamDialogs";
import { request } from "@/features/team/utils";
import { ROL_LABEL, type Invitacion, type InvitacionCreada, type RolUsuario, type Usuario } from "@/types/auth";

type Notify = (msg: string, type: "success" | "error" | "info") => void;

interface TeamViewProps {
  usuario: Usuario;
  notify: Notify;
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
