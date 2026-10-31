// fetch del navegador hacia el BFF. Si la sesión terminó (401), vuelve al inicio de sesión
// y regresa a la misma vista después de entrar.

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    const next = window.location.pathname + window.location.search;
    window.location.assign(`/login?${new URLSearchParams({ next, motivo: "sesion" })}`);
  }
  return response;
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.assign("/login");
}
