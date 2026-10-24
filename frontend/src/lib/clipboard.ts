/**
 * Utilidad resiliente para copiar texto al portapapeles.
 * Compatible con:
 * - Entornos seguros: localhost y conexiones HTTPS (usa navigator.clipboard).
 * - Entornos HTTP no seguros e IPs públicas (usa fallback transparente con textarea y document.execCommand).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Intentar la API moderna navigator.clipboard
  if (typeof window !== "undefined" && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Si falla por contexto no seguro (HTTP), pasamos al fallback
      console.warn("navigator.clipboard falló o bloqueado, intentando fallback:", err);
    }
  }

  // 2. Fallback universal usando document.execCommand('copy')
  // Funciona perfectamente en conexiones HTTP directas a IPs públicas
  try {
    if (typeof document !== "undefined") {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "-9999px";
      textArea.style.left = "-9999px";
      textArea.setAttribute("readonly", "");
      textArea.style.opacity = "0";
      textArea.style.pointerEvents = "none";
      document.body.appendChild(textArea);

      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999); // Soporte para navegadores móviles

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (fallbackErr) {
    console.error("Fallback de copia al portapapeles falló:", fallbackErr);
  }

  return false;
}
