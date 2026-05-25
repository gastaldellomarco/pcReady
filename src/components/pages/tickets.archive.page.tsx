import OverflowTable from "@/components/ui/overflow-table";

import { useEffect, useRef, useMemo } from "react";
import { useArchivedTicketsInfiniteList, useUpdateTicket, addTicketStatusHistory } from "@/lib/queries/tickets";
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
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const listQuery = useArchivedTicketsInfiniteList({ pageSize: PAGE_SIZE });
  const updateTicket = useUpdateTicket();

  const rows = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.data) as Row[] ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.pages[0]?.count ?? 0;
  const loadedCount = rows.length;
  const isFetchingMore = listQuery.isFetchingNextPage;

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !listQuery.hasNextPage || listQuery.isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void listQuery.fetchNextPage();
        }
      },
      { threshold: 0.1, rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [listQuery.hasNextPage, listQuery.isFetchingNextPage, listQuery.fetchNextPage]);

  async function reopen(id: string) {
    try {
      await updateTicket.mutateAsync({ id, patch: { status: "pending" } });
      await addTicketStatusHistory(id, {
        from_status: "archived",
        to_status: "pending",
        changed_by: null,
        changed_at: new Date().toISOString(),
        note: t("reopenedByArchive", "Riaperto da archivio"),
      });
      toast.success(t("toasts.ticketReopened", "Ticket riaperto"));
      await listQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || t("toasts.ticketReopenError", "Errore riapertura ticket"));
    }
  }

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
              {!rows.length && !listQuery.isLoading && (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-text3 text-sm">
                    {t("noArchivedTickets", "Nessun ticket archiviato")}
                  </td>
                </tr>
              )}
              {listQuery.isLoading && (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-text3 text-sm">
                    {t("loading", "Caricamento...")}
                  </td>
                </tr>
              )}
            </tbody>
            </table>
        </OverflowTable>
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={loadMoreRef} className="flex items-center justify-center py-3">
        {isFetchingMore && (
          <span className="text-sm text-text3">{t("loadingMore", "Caricamento altri...")}</span>
        )}
        {!listQuery.hasNextPage && loadedCount > 0 && (
          <span className="text-xs text-text3 font-mono">
            {t("allLoaded", { count: loadedCount, total, defaultValue: "Tutti {{count}} di {{total}} caricati" })}
          </span>
        )}
      </div>
    </div>
  );
}
