import { Outlet } from "@tanstack/react-router";
import { PageErrorBoundary } from "@/components/page-states";
import { Monitor } from "lucide-react";

export function PortalLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a href="/portal" className="flex items-center gap-2 font-semibold">
            <Monitor className="h-5 w-5 text-primary" />
            <span>PCReady</span>
            <span className="hidden text-muted-foreground sm:inline">| Portale Cliente</span>
          </a>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="/portal/dashboard" className="hover:text-foreground">
              Dashboard
            </a>
            <a href="/portal/tickets" className="hover:text-foreground">
              Ticket
            </a>
            <a href="/portal/documents" className="hover:text-foreground">
              Documenti
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <PageErrorBoundary variant="portal">
          <Outlet />
        </PageErrorBoundary>
      </main>
    </div>
  );
}
