import { Link } from "@tanstack/react-router";
import { Monitor } from "lucide-react";
import { SupportContact } from "@/components/errors/SupportContact";
import { Button } from "@/components/ui/button";

/**
 *
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
        <Monitor className="size-16 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">404</h1>
        <p className="mt-2 text-xl text-muted-foreground">Pagina non trovata</p>
        <p className="mt-1 text-sm text-muted-foreground">
          La pagina che cerchi non esiste o è stata spostata.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <Link to="/dashboard">Torna alla Dashboard</Link>
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          Indietro
        </Button>
      </div>
      <SupportContact />
    </div>
  );
}
