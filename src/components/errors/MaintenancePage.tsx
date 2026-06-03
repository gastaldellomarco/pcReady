import { Wrench } from "lucide-react";
import { SupportContact } from "@/components/errors/SupportContact";
import { getMaintenanceEndEnv } from "@/lib/maintenance-env";

function formatMaintenanceEnd(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(d);
}

/**
 *
 */
export function MaintenancePage() {
  const endLabel = formatMaintenanceEnd(getMaintenanceEndEnv());

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
        <Wrench className="size-16 animate-pulse text-muted-foreground" />
      </div>
      <div className="max-w-md">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Manutenzione in corso</h1>
        <p className="mt-2 text-muted-foreground">
          PCReady è temporaneamente non disponibile per aggiornamenti. Tornerà operativo a breve.
        </p>
      </div>
      {endLabel ? (
        <p className="text-sm text-muted-foreground">Rientro previsto: {endLabel}</p>
      ) : null}
      <SupportContact prefix="Per urgenze contatta" />
    </div>
  );
}
