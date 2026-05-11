import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal/documents/")({
  component: PortalDocumentsPage,
});

function PortalDocumentsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Documenti</h1>
        <p className="text-sm text-muted-foreground">
          In questa sezione saranno disponibili verbali di intervento e report mensili scaricabili.
        </p>
      </div>
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Generazione PDF server-side protetta pronta per integrazione completa con i verbali ticket completati.
      </div>
    </div>
  );
}
