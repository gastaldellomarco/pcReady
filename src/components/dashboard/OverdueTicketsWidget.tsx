import OverflowTable from "@/components/ui/overflow-table";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { Clock, RefreshCw } from "lucide-react";
import { getOverdueTickets } from "@/lib/dashboard-analytics";
import { useAuth } from "@/lib/auth-context";
import { StatusBadge, AssigneeChip } from "@/components/pcready/StatusBadge";
import { formatSlaCountdown, type TicketStatus } from "@/lib/pcready";
import { openTicketDetail } from "@/lib/use-detail";

export function OverdueTicketsWidget() {
  const { t } = useTranslation("dashboard");
  const { session } = useAuth();
  const fetcher = useServerFn(getOverdueTickets);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const data = await fetcher({ data: { accessToken: session.access_token, thresholdDays: 5 } });
      setTickets(data ?? []);
    } catch (err) {
      console.error("Failed to load overdue tickets", err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [fetcher, session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="pc-card">
      <div className="pc-card-hd">
        <div className="flex items-center gap-2">
          <span className="pc-card-title">{t("widgets.overdueTickets", "Ticket scaduti / SLA violati")}</span>
          {tickets.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {tickets.length}
            </span>
          )}
        </div>
        <button onClick={load} className="pc-btn pc-btn-ghost pc-btn-sm" disabled={loading}>
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="pc-card-body">
        {loading ? (
          <div className="text-sm text-text3 py-4 text-center">{t("widgets.loading", "Caricamento...")}</div>
        ) : tickets.length === 0 ? (
          <div className="text-sm text-text3 py-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-2 opacity-40" />
            {t("widgets.noOverdueTickets", "Nessun ticket SLA violato o in scadenza")}
          </div>
        ) : (
          <OverflowTable>
            <table className="w-full">
              <thead>
                <tr>
                  {[t("widgets.tableId", "ID"), t("widgets.tableClient", "Cliente"), t("widgets.tableModel", "Modello"), t("widgets.tableStatus", "Stato"), t("widgets.tableAssignee", "Assegnatario"), t("widgets.tableSla", "SLA")].map((h) => (
                    <th
                      key={h}
                      className="text-left px-[10px] py-[7px] text-[10px] font-bold uppercase tracking-wider text-text3 border-b"
                      style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0, 8).map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="border-b cursor-pointer hover:bg-surface2 transition-colors"
                    style={{ borderColor: "var(--border)" }}
                    onClick={() => openTicketDetail(ticket.id)}
                  >
                    <td className="px-[10px] py-[8px] font-mono text-[11px] text-accent">
                      {ticket.ticket_code}
                    </td>
                    <td className="px-[10px] py-[8px] text-[12px]">{ticket.client ?? "—"}</td>
                    <td className="px-[10px] py-[8px] text-[12px] text-text3">{ticket.model ?? "—"}</td>
                    <td className="px-[10px] py-[8px]">
                      <StatusBadge status={ticket.status as TicketStatus} />
                    </td>
                    <td className="px-[10px] py-[8px]">
                      <AssigneeChip
                        initials={ticket.assignee_name?.charAt(0) ?? "?"}
                        name={ticket.assignee_name ?? t("widgets.unassigned", "Non assegnato")}
                      />
                    </td>
                    <td className="px-[10px] py-[8px]">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded ${
                          ticket.days_open > 10
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {ticket.sla_deadline ? formatSlaCountdown(ticket.sla_deadline) : `${ticket.days_open}g`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
          </OverflowTable>
        )}
      </div>
    </div>
  );
}
