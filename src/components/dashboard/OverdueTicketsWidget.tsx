import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Clock, RefreshCw } from "lucide-react";
import { getOverdueTickets } from "@/lib/dashboard-analytics";
import { useAuth } from "@/lib/auth-context";
import { StatusBadge, AssigneeChip } from "@/components/pcready/StatusBadge";
import type { TicketStatus } from "@/lib/pcready";
import { openTicketDetail } from "@/lib/use-detail";

export function OverdueTicketsWidget() {
  const { session } = useAuth();
  const fetcher = useServerFn(getOverdueTickets);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
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
  };

  useEffect(() => {
    void load();
  }, [session?.access_token]);

  return (
    <div className="pc-card">
      <div className="pc-card-hd">
        <div className="flex items-center gap-2">
          <span className="pc-card-title">Ticket scaduti / SLA violati</span>
          {tickets.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {tickets.length}
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="pc-btn pc-btn-ghost pc-btn-sm"
          disabled={loading}
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="pc-card-body">
        {loading ? (
          <div className="text-sm text-text3 py-4 text-center">Caricamento...</div>
        ) : tickets.length === 0 ? (
          <div className="text-sm text-text3 py-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-2 opacity-40" />
            Nessun ticket oltre la soglia SLA (5gg)
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {["ID", "Cliente", "Modello", "Stato", "Assegnatario", "Giorni aperto"].map((h) => (
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
                {tickets.slice(0, 8).map((t) => (
                  <tr
                    key={t.id}
                    className="border-b cursor-pointer hover:bg-surface2 transition-colors"
                    style={{ borderColor: "var(--border)" }}
                    onClick={() => openTicketDetail(t.id)}
                  >
                    <td className="px-[10px] py-[8px] font-mono text-[11px] text-accent">
                      {t.ticket_code}
                    </td>
                    <td className="px-[10px] py-[8px] text-[12px]">{t.client ?? "—"}</td>
                    <td className="px-[10px] py-[8px] text-[12px] text-text3">{t.model ?? "—"}</td>
                    <td className="px-[10px] py-[8px]">
                      <StatusBadge status={t.status as TicketStatus} />
                    </td>
                    <td className="px-[10px] py-[8px]">
                      <AssigneeChip
                        initials={t.assignee_name?.charAt(0) ?? "?"}
                        name={t.assignee_name ?? "Non assegnato"}
                      />
                    </td>
                    <td className="px-[10px] py-[8px]">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded ${
                          t.days_open > 10
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {t.days_open}g
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
