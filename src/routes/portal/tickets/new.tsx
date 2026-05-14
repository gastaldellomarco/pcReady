import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { NewTicketForm } from "@/components/portal/NewTicketForm";
import { PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { getPortalTicketCategories } from "@/lib/portal-tickets";

export const Route = createFileRoute("/portal/tickets/new")({
  component: PortalNewTicketPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton variant="portal" />,
});

function PortalNewTicketPage() {
  const loadCategories = useServerFn(getPortalTicketCategories);
  const [token, setToken] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  const load = useCallback(() => {
    const stored = localStorage.getItem("pcready_portal_token") || "";
    if (!stored) {
      window.location.href = "/portal";
      return;
    }
    setToken(stored);
    setLoading(true);
    setError("");
    loadCategories({ data: { token: stored } })
      .then((result) => setCategories(result.categories || []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Errore di rete"))
      .finally(() => setLoading(false));
  }, [loadCategories]);

  useEffect(() => {
    load();
  }, [load, retryKey]);

  if (error) {
    return (
      <PageFetchError variant="portal" message={error} onRetry={() => setRetryKey((k) => k + 1)} />
    );
  }

  if (loading || !token) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-8 w-64 max-w-full animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded-md bg-muted" />
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-32 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Apri nuovo ticket</h1>
        <p className="text-sm text-muted-foreground">
          Descrivi il problema: il team tecnico prenderà in carico la richiesta.
        </p>
      </div>
      <NewTicketForm token={token} categories={categories} />
    </div>
  );
}
