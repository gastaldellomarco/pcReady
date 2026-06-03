import { createLazyFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ListSkeleton, PageEmptyState, PageFetchError } from "@/components/page-states";
import { listPortalDevices } from "@/lib/portal-tickets";
import { fmtDateTime } from "@/lib/pcready";
import { ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, ShieldOff, RotateCw } from "lucide-react";

export const Route = createLazyFileRoute("/portal/devices")({
  component: PortalDevicesPage,
});

interface DeviceInfo {
  id: string;
  model: string;
  serial?: string | null;
  os?: string | null;
  status: string;
  assigned_to?: string | null;
  updated_at?: string;
  purchase_date?: string | null;
  warranty_expiry_date?: string | null;
  warranty_type?: string | null;
  warranty_provider?: string | null;
  warranty_notes?: string | null;
  lastTicket?: any;
  ticketHistory?: any[];
}

function PortalDevicesPage() {
  const loadDevices = useServerFn(listPortalDevices);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    const token = localStorage.getItem("pcready_portal_token") || "";
    if (!token) {
      window.location.href = "/portal";
      return;
    }
    setLoading(true);
    setError("");
    loadDevices({ data: { token } })
      .then((result) => setDevices((result.devices as DeviceInfo[]) || []))
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
            <DeviceCard
              key={device.id}
              device={device}
              expanded={expandedId === device.id}
              onToggle={() => setExpandedId(expandedId === device.id ? null : device.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Warranty helpers ──────────────────────────────────────────────────────

function getWarrantyStatus(expiryDate: string | null | undefined): { label: string; variant: "ok" | "warning" | "critical" | "none"; daysLeft: number | null } {
  if (!expiryDate) return { label: "Garanzia non specificata", variant: "none", daysLeft: null };
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (expiry <= now) return { label: "Garanzia scaduta", variant: "critical", daysLeft: 0 };
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 30) return { label: `Scade tra ${daysLeft} giorni`, variant: "critical", daysLeft };
  if (daysLeft <= 60) return { label: `Scade tra ${daysLeft} giorni`, variant: "warning", daysLeft };
  if (daysLeft <= 90) return { label: `Scade tra ${daysLeft} giorni`, variant: "warning", daysLeft };
  return { label: `Valida fino al ${expiry.toLocaleDateString("it-IT")}`, variant: "ok", daysLeft };
}

const WARRANTY_BADGE_STYLES = {
  ok: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50",
  warning: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/50",
  critical: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50",
  none: "bg-muted text-muted-foreground border-border",
};

const WARRANTY_ICONS = {
  ok: ShieldCheck,
  warning: ShieldAlert,
  critical: ShieldOff,
  none: ShieldOff,
};

// ── Device Card ────────────────────────────────────────────────────────────

function DeviceCard({ device, expanded, onToggle }: { device: DeviceInfo; expanded: boolean; onToggle: () => void }) {
  const warranty = getWarrantyStatus(device.warranty_expiry_date);
  const WarrantyIcon = WARRANTY_ICONS[warranty.variant];
  const hasDetail = !!(device.warranty_expiry_date || device.purchase_date || device.warranty_type || device.os || (device.ticketHistory?.length));

  return (
    <div className="rounded-lg border bg-card">
      {/* Header row */}
      <button
        className="w-full p-4 text-left transition-colors hover:bg-accent/50"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold">{device.model}</h2>
              {/* Warranty badge */}
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${WARRANTY_BADGE_STYLES[warranty.variant]}`}>
                <WarrantyIcon className="h-3 w-3" />
                {warranty.label}
              </span>
            </div>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">{device.serial || device.id.slice(0, 8)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium">{device.status}</span>
            {hasDetail && (
              <span className="text-muted-foreground">
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expandable detail */}
      {expanded && hasDetail && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* OS & Warranty details */}
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {device.os && (
              <div>
                <dt className="text-xs font-semibold text-muted-foreground uppercase">Sistema operativo</dt>
                <dd className="mt-0.5">{device.os}</dd>
              </div>
            )}
            {device.warranty_expiry_date && (
              <div>
                <dt className="text-xs font-semibold text-muted-foreground uppercase">Scadenza garanzia</dt>
                <dd className="mt-0.5">{new Date(device.warranty_expiry_date).toLocaleDateString("it-IT")}</dd>
              </div>
            )}
            {device.purchase_date && (
              <div>
                <dt className="text-xs font-semibold text-muted-foreground uppercase">Data acquisto</dt>
                <dd className="mt-0.5">{new Date(device.purchase_date).toLocaleDateString("it-IT")}</dd>
              </div>
            )}
            {device.warranty_type && (
              <div>
                <dt className="text-xs font-semibold text-muted-foreground uppercase">Tipo garanzia</dt>
                <dd className="mt-0.5 capitalize">{device.warranty_type}</dd>
              </div>
            )}
            {device.assigned_to && (
              <div>
                <dt className="text-xs font-semibold text-muted-foreground uppercase">Utente assegnato</dt>
                <dd className="mt-0.5">{device.assigned_to}</dd>
              </div>
            )}
          </dl>

          {/* Ticket history */}
          {device.ticketHistory?.length ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Storico ticket ({device.ticketHistory.length})</p>
              <div className="space-y-1">
                {device.ticketHistory.slice(0, 10).map((ticket) => (
                  <a
                    key={ticket.id}
                    href={`/portal/tickets/${ticket.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground shrink-0">{ticket.ticket_code}</span>
                      <span className="truncate">{ticket.model || "Ticket assistenza"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {fmtDateTime(ticket.created_at)}
                    </span>
                  </a>
                ))}
                {device.ticketHistory.length > 10 && (
                  <p className="text-xs text-muted-foreground px-2">
                    +{device.ticketHistory.length - 10} altri ticket
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Action buttons */}
      <div className="border-t px-4 py-3 flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <a href={`/portal/tickets/new?device=${device.id}`}>Segnala problema</a>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={`/portal/tickets/new?device=${device.id}&replace=1`} className="inline-flex items-center gap-1.5">
            <RotateCw className="h-3.5 w-3.5" />
            Richiedi sostituzione
          </a>
        </Button>
      </div>
    </div>
  );
}
