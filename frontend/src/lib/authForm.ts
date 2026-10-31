// Comportamiento compartido de los formularios de acceso (se ejecuta en el navegador).

/** Destino tras iniciar sesión: solo rutas internas, para no redirigir a otro sitio. */
export function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

/** Lee el token del enlace y lo quita de la barra de direcciones y del historial. */
export function takeToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    params.delete("token");
    const rest = params.toString();
    history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
  }
  return token;
}

export function showAlert(form: HTMLElement, message: string | null, tone: "error" | "info" = "error") {
  const alert = form.querySelector<HTMLElement>("[data-alert]");
  if (!alert) return;
  alert.hidden = !message;
  alert.textContent = message ?? "";
  alert.dataset.tone = tone;
}

interface Options {
  endpoint: string;
  /** Devuelve el cuerpo a enviar, o un mensaje si el formulario no es válido. */
  build: (data: FormData) => Record<string, string> | string;
  onSuccess: () => void;
}

export function bindAuthForm(form: HTMLFormElement, { endpoint, build, onSuccess }: Options) {
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
  const idleLabel = button?.textContent ?? "";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = build(new FormData(form));
    if (typeof body === "string") {
      showAlert(form, body);
      return;
    }

    showAlert(form, null);
    if (button) {
      button.disabled = true;
      button.textContent = button.dataset.busy ?? "Un momento…";
    }
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        onSuccess();
        return;
      }
      const data = await response.json().catch(() => null);
      showAlert(form, data?.error ?? "No se pudo completar la solicitud. Inténtalo de nuevo.");
    } catch {
      showAlert(form, "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
    }
    if (button) {
      button.disabled = false;
      button.textContent = idleLabel;
    }
  });
}

/** Validación común de contraseña nueva + confirmación. */
export function checkNewPassword(data: FormData): string | null {
  const password = String(data.get("password") ?? "");
  if (password.length < 12) return "La contraseña debe tener al menos 12 caracteres.";
  if (password.length > 128) return "La contraseña no puede tener más de 128 caracteres.";
  if (password !== String(data.get("confirmar") ?? "")) return "Las contraseñas no coinciden.";
  return null;
}
