import { WifiOff } from "lucide-react";
import { useRealtimeConnectionStatus } from "@/hooks/useRealtimeConnectionStatus";

export function ConnectionBanner() {
  const status = useRealtimeConnectionStatus();

  if (status === "connected") return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex min-h-10 items-center justify-center gap-2 border-b border-amber-300 bg-amber-400 px-3 py-2 text-center text-sm font-semibold text-amber-950 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Connessione persa. Riconnessione in corso...</span>
    </div>
  );
}
