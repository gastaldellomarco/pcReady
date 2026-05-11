import { Wrench } from "lucide-react";
import { SupportContact } from "@/components/errors/SupportContact";

export function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Wrench className="h-16 w-16 animate-pulse text-muted-foreground" />
      </div>
      <div className="max-w-md">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Manutenzione in corso</h1>
        <p className="mt-2 text-muted-foreground">
          PCReady è temporaneamente non disponibile per aggiornamenti. Tornerà operativo a breve.
        </p>
      </div>
      {import.meta.env.VITE_MAINTENANCE_END && (
        <p className="text-sm text-muted-foreground">
          Rientro previsto: {import.meta.env.VITE_MAINTENANCE_END}
        </p>
      )}
      <SupportContact prefix="Per urgenze contatta" />
    </div>
  );
}
