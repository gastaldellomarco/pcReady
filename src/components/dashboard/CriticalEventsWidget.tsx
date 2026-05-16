import { useState, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { XCircle, AlertTriangle, RefreshCw, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getCriticalEvents } from "@/lib/audit-log";
import { getOverdueTickets } from "@/lib/dashboard-analytics";
import { fmtDateTime, formatSlaCountdown } from "@/lib/pcready";
import type { ActivityLogEntry } from "@/lib/audit-log";

interface CriticalEventsWidgetProps {
  accessToken: string | undefined;
}

export function CriticalEventsWidget({ accessToken }: CriticalEventsWidgetProps) {
  const [events, setEvents] = useState<ActivityLogEntry[]>([]);
  const [slaTickets, setSlaTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const loadCritical = useServerFn(getCriticalEvents);
  const loadSlaTickets = useServerFn(getOverdueTickets);

  const refresh = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    Promise.all([
      loadCritical({ data: { accessToken, limit: 5 } }),
      loadSlaTickets({ data: { accessToken, thresholdDays: 5 } }),
    ])
      .then(([critical, sla]) => {
        setEvents(critical);
        setSlaTickets((sla ?? []).slice(0, 3));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, loadCritical, loadSlaTickets]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="pc-card">
      <div className="pc-card-hd">
        <div className="flex items-center gap-2">
          <span className="pc-card-title">Eventi critici recenti</span>
          {events.length + slaTickets.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {events.length + slaTickets.length}
            </span>
          )}
        </div>
        <button onClick={refresh} className="pc-btn pc-btn-ghost pc-btn-sm" disabled={loading}>
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="pc-card-body">
        {loading ? (
          <div className="text-sm text-text3 py-4 text-center">Caricamento...</div>
        ) : events.length === 0 && slaTickets.length === 0 ? (
          <div className="text-sm text-text3 py-4 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-2 opacity-40" />
            Nessun evento critico nelle ultime 24h
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {slaTickets.map((ticket) => (
              <div
                key={`sla-${ticket.id}`}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50"
              >
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-text2 truncate">
                    {ticket.ticket_code}: {ticket.sla_breached ? "SLA violato" : "SLA in scadenza"}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10.5px] text-text3">
                      {ticket.client ?? "Cliente n/d"}
                    </span>
                    <span className="text-[10.5px] text-text3 font-mono">
                      {formatSlaCountdown(ticket.sla_deadline)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-[12.5px] bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50"
              >
                <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-text2 truncate">{event.message}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10.5px] text-text3">{event.actor_name}</span>
                    <span className="text-[10.5px] text-text3 font-mono">
                      {fmtDateTime(event.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <Link
              to="/admin"
              search={{} as any}
              className="flex items-center justify-center gap-1 text-[11px] text-accent hover:underline mt-1"
            >
              Vedi tutti i log <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
