import OverflowTable from "@/components/ui/overflow-table";

import { useEffect, useState } from "react";
import queries from "@/lib/queries/tickets";
import { LIST_PAGE_SIZE } from "@/lib/queries/list-config";
import { openTicketDetail } from "@/lib/use-detail";
import { type TicketStatus, type TicketPriority, type TicketType, fmtDate } from "@/lib/pcready";
import {
  StatusBadge,
  PriorityLabel,
  AssigneeChip,
  TicketTypeBadge,
} from "@/components/pcready/StatusBadge";
import { toast } from "sonner";
import { Eye, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Row {
  id: string;
  ticket_code: string;
  client: string | null;
  client_id: string | null;
  requester: string;
  ticket_type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  completed_at?: string | null;
  client_ref?: { name: string } | null;
  device?: { model: string; serial: string | null; os: string | null } | null;
  assignee?: { full_name: string; initials: string } | null;
}

const PAGE_SIZE = LIST_PAGE_SIZE;

export default function TicketsArchivePage() {
  const { t } = useTranslation("tickets");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const { useTicketsList, useUpdateTicket } = queries as any;
  const ticketsQuery = useTicketsList({ status: "archived", page, pageSize: PAGE_SIZE });
  const updateTicket = useUpdateTicket();

  useEffect(() => {
    if (ticketsQuery.data) {
      setRows(ticketsQuery.data.data as Row[]);
      setTotal(ticketsQuery.data.count ?? 0);
    }
  }, [ticketsQuery.data]);

  async function reopen(id: string) {
    try {
      await updateTicket.mutateAsync({ id, patch: { status: "pending" } });
      await (queries as any).addTicketStatusHistory(id, {
        from_status: "archived",
        to_status: "pending",
        changed_by: null,
        changed_at: new Date().toISOString(),
        note: t("reopenedByArchive", "Riaperto da archivio"),
      });
      toast.success(t("toasts.ticketReopened", "Ticket riaperto"));
      setRows((rs) => rs.filter((r) => r.id !== id));
    } catch (err: any) {
      toast.error(err?.message || t("toasts.ticketReopenError", "Errore riapertura ticket"));
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{t("archiveTitle", "Storico ticket")}</h2>
        <span className="ml-auto text-xs text-text3 font-mono">{total} {t("results", "risultati")}</span>
      </div>

      <div className="pc-card overflow-hidden">
        <OverflowTable>
            <table className="w-full">
            <thead>
              <tr>
                {[
                  t("columns.id", "Codice"),
                  t("columns.model", "Modello"),
                  t("columns.serial", "Seriale"),
                  t("columns.client", "Cliente"),
                  t("columns.requester", "Richiedente"),
                  t("columns.priority", "Priorità"),
                  t("columns.status", "Stato"),
                  t("columns.type", "Tipo"),
                  t("columns.assignee", "Assegnatario"),
                  t("columns.created", "Creato"),
                  t("actions", "Azioni"),
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b"
                    style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="border-b cursor-pointer transition-colors hover:bg-surface2"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-[14px] py-[10px] font-mono text-[11.5px] text-text3">
                    {ticket.ticket_code}
                  </td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">
                    {ticket.device?.model || t("noAsset", "Nessun asset")}
                  </td>
                  <td className="px-[14px] py-[10px] font-mono text-[11px] text-text3">
                    {ticket.device?.serial || "-"}
                  </td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">
                    {ticket.client_ref?.name || ticket.client || "-"}
                  </td>
                  <td className="px-[14px] py-[10px] text-[12.5px]">{ticket.requester}</td>
                  <td className="px-[14px] py-[10px]">
                    <PriorityLabel p={ticket.priority} />
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={ticket.status} />
                    </div>
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <TicketTypeBadge type={ticket.ticket_type} />
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <AssigneeChip initials={ticket.assignee?.initials} name={ticket.assignee?.full_name} />
                  </td>
                  <td className="px-[14px] py-[10px] text-[11px] text-text3">
                    {fmtDate(ticket.created_at)}
                  </td>
                  <td className="px-[14px] py-[10px]">
                    <div className="flex items-center gap-2">
                      <button
                        className="pc-btn pc-btn-ghost pc-btn-sm"
                        onClick={() => openTicketDetail(ticket.id)}
                      >
                        <Eye className="w-3 h-3" /> {t("details", "Dettagli")}
                      </button>
                      <button
                        className="pc-btn pc-btn-ghost pc-btn-sm"
                        onClick={() => reopen(ticket.id)}
                      >
                        <RotateCw className="w-3 h-3" /> {t("reopen", "Riapri")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-text3 text-sm">
                    {t("noArchivedTickets", "Nessun ticket archiviato")}
                  </td>
                </tr>
              )}
            </tbody>
            </table>
        </OverflowTable>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          className="pc-btn pc-btn-ghost pc-btn-sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          {t("prevPage", "Precedente")}
        </button>
        <span className="text-xs text-text3 font-mono">
          {t("page", "Pagina")} {page + 1} {t("of", "di")} {pageCount}
        </span>
        <button
          className="pc-btn pc-btn-ghost pc-btn-sm"
          disabled={page + 1 >= pageCount}
          onClick={() => setPage((p) => p + 1)}
        >
          {t("nextPage", "Successiva")}
        </button>
      </div>
    </div>
  );
}
