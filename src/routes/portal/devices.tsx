import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ListSkeleton, PageEmptyState, PageFetchError } from "@/components/page-states";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { listPortalDevices } from "@/lib/portal-tickets";
import { fmtDateTime } from "@/lib/pcready";

export const Route = createFileRoute("/portal/devices")({
  component: PortalDevicesPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton variant="portal" />,
});

function PortalDevicesPage() {
  const loadDevices = useServerFn(listPortalDevices);
  const [devices, setDevices] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);

  const load = useCallback(() => {
    const token = localStorage.getItem("pcready_portal_token") || "";
    if (!token) {
      window.location.href = "/portal";
      return;
    }
    setLoading(true);
    setError("");
    loadDevices({ data: { token } })
      .then((result) => setDevices((result.devices as any[]) || []))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Errore di rete"))
      .finally(() => setLoading(false));
  }, [loadDevices]);

  useEffect(() => {
    load();
  }, [load, retryKey]);

  if (error) {
    return <PageFetchError variant="portal" message={error} onRetry={() => setRetryKey((key) => key + 1)} />;
  }

  if (loading) return <ListSkeleton rows={5} variant="portal" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">I miei dispositivi</h1>
        <p className="text-sm text-muted-foreground">Asset e dispositivi collegati al tuo account cliente.</p>
      </div>
      {!devices.length ? (
        <PageEmptyState variant="portal" title="Nessun dispositivo" description="Non risultano dispositivi associati al tuo cliente." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {devices.map((device) => (
            <div key={device.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{device.model}</h2>
                  <p className="font-mono text-xs text-muted-foreground">{device.serial || device.id.slice(0, 8)}</p>
                </div>
                <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium">{device.status}</span>
              </div>
              <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <div><dt className="font-medium text-foreground">Sistema operativo</dt><dd>{device.os || "—"}</dd></div>
                <div><dt className="font-medium text-foreground">Utente assegnato</dt><dd>{device.assigned_to || "—"}</dd></div>
                <div>
                  <dt className="font-medium text-foreground">Ultimo ticket</dt>
                  <dd>
                    {device.lastTicket ? (
                      <a className="text-primary hover:underline" href={`/portal/tickets/${device.lastTicket.id}`}>
                        {device.lastTicket.ticket_code} · {fmtDateTime(device.lastTicket.created_at)}
                      </a>
                    ) : "—"}
                  </dd>
                </div>
              </dl>
              <Button className="mt-4" asChild>
                <a href={`/portal/tickets/new?device=${device.id}`}>Segnala problema</a>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
