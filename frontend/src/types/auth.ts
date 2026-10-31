// Espejo de app/contracts/auth.py (solo los campos que usa el frontend).

export type RolUsuario = "admin" | "revisor" | "lector";

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  creado_en: string;
}

export const ROL_LABEL: Record<RolUsuario, string> = {
  admin: "Administración",
  revisor: "Revisión",
  lector: "Solo lectura",
};

export const ROL_DESCRIPCION: Record<RolUsuario, string> = {
  admin: "Todo lo de revisión, más guardar los lotes en el historial, invitar personas y gestionar el equipo.",
  revisor: "Sube conversaciones y aprueba o rechaza el contenido de cualquier lote del equipo.",
  lector: "Consulta la tabla de casos y el dashboard, sin cambiar nada.",
};

/** Orden de privilegio, igual que en el backend (admin > revisor > lector). */
export const NIVEL_ROL: Record<RolUsuario, number> = { lector: 1, revisor: 2, admin: 3 };

export const tieneRol = (usuario: Usuario | null, minimo: RolUsuario) =>
  !!usuario && NIVEL_ROL[usuario.rol] >= NIVEL_ROL[minimo];

export type TipoInvitacion = "registro" | "recuperacion";

export interface Invitacion {
  id: string;
  tipo: TipoInvitacion;
  email: string;
  rol: RolUsuario;
  creada_en: string;
  expira_en: string;
}

/** Solo al crearla: el token no vuelve a mostrarse. */
export interface InvitacionCreada extends Invitacion {
  token: string;
}
