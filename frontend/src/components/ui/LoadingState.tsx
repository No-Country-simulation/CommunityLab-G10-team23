import { Loader2 } from "lucide-react";

/** Indicador de carga centrado con texto y una pista opcional. */
export function LoadingState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center text-ink-600">
      <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      <p className="text-sm font-medium">{label}</p>
      {hint && <p className="text-xs text-ink-500 max-w-xs">{hint}</p>}
    </div>
  );
}
