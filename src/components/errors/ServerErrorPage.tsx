import { AlertTriangle } from "lucide-react";
import { SupportContact } from "@/components/errors/SupportContact";
import { Button } from "@/components/ui/button";

/**
 *
 */
export function ServerErrorPage({ error }: { error: Error }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-16 text-destructive" />
      </div>
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">500</h1>
        <p className="mt-2 text-xl text-muted-foreground">Errore del server</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Si è verificato un errore imprevisto. Il team tecnico è stato notificato.
        </p>
      </div>
      {import.meta.env.DEV && error.message && (
        <pre className="max-h-48 max-w-lg overflow-auto rounded-md bg-muted p-4 text-left font-mono text-xs text-muted-foreground">
          {error.message}
        </pre>
      )}
      <Button onClick={() => window.location.reload()}>Ricarica la pagina</Button>
      <SupportContact prefix="Se il problema persiste, contatta" />
    </div>
  );
}
