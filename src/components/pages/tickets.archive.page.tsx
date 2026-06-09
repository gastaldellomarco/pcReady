import { Eye, RotateCw } from "lucide-react";
import { useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  StatusBadge,
  PriorityLabel,
  AssigneeChip,
  TicketTypeBadge,
} from "@/components/pcready/StatusBadge";
import { useVirtualList } from "@/hooks/useVirtualList";
import { openTicketDetail } from "@/lib/detail-navigation";
import { type TicketStatus, type TicketPriority, type TicketType, fmtDate } from "@/lib/pcready";
import { LIST_PAGE_SIZE } from "@/lib/queries/list-config";
import {
  useArchivedTicketsInfiniteList,
  useUpdateTicket,
  addTicketStatusHistory,
} from "@/lib/queries/tickets";

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

/**
 *
 */
export default function TicketsArchivePage() {
  const { t } = useTranslation("tickets");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const listQuery = useArchivedTicketsInfiniteList({ pageSize: PAGE_SIZE });
  const updateTicket = useUpdateTicket();

  const rows = useMemo(
    () => (listQuery.data?.pages.flatMap((p) => p.data) as Row[]) ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.pages[0]?.count ?? 0;
  const loadedCount = rows.length;
  const isFetchingMore = listQuery.isFetchingNextPage;

  const colSpan = 11;
  const {
    containerRef: tableContainerRef,
    virtualizer: rowVirtualizer,
    virtualItems,
    totalSize: virtualTotalSize,
  } = useVirtualList({
    count: rows.length,
    estimateSize: 40,
    overscan: 15,
    threshold: 50,
  });
  const {
    containerRef: mobileContainerRef,
    virtualizer: mobileVirtualizer,
    virtualItems: mobileVirtualItems,
    totalSize: mobileVirtualTotalSize,
  } = useVirtualList({
    count: rows.length,
    estimateSize: 200,
    overscan: 5,
    threshold: 20,
  });

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
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("toasts.ticketReopenError", "Errore riapertura ticket"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{t("archiveTitle", "Storico ticket")}</h2>
        <span className="ml-auto text-xs text-text3 font-mono">
          {total} {t("results", "risultati")}
        </span>
      </div>

      <div
        ref={mobileContainerRef}
        className="md:hidden"
        style={{
          maxHeight: rows.length > 20 ? "calc(100vh - 200px)" : undefined,
          overflow: rows.length > 20 ? "auto" : undefined,
        }}
      >
        {listQuery.isLoading ? (
          <div className="pc-card pc-card-body text-sm text-text3">
            {t("loading", "Caricamento...")}
          </div>
        ) : !rows.length ? (
          <div className="pc-card pc-card-body text-center text-sm text-text3">
            {t("noArchivedTickets", "Nessun ticket archiviato")}
          </div>
        ) : rows.length > 20 ? (
          <div style={{ position: "relative", height: mobileVirtualTotalSize }}>
            {mobileVirtualItems.map((virtualItem) => {
              const ticket = rows[virtualItem.index];
              return (
                <div
                  key={ticket.id}
                  ref={mobileVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    transform: `translateY(${virtualItem.start}px)`,
                    left: 0,
                    right: 0,
                    marginBottom: "12px",
                  }}
                >
                  <TicketArchiveMobileCard
                    ticket={ticket}
                    onOpen={() => openTicketDetail(ticket.id)}
                    onReopen={() => reopen(ticket.id)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((ticket) => (
              <TicketArchiveMobileCard
                key={ticket.id}
                ticket={ticket}
                onOpen={() => openTicketDetail(ticket.id)}
                onReopen={() => reopen(ticket.id)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="hidden md:block pc-card overflow-hidden">
        <div
          ref={tableContainerRef}
          className="max-w-full overflow-x-auto rounded-md border overscroll-x-contain"
          style={{
            maxHeight: "calc(100vh - 180px)",
            overflow: "auto",
          }}
          tabIndex={0}
          role="region"
          aria-label={t("archiveTableLabel", "Tabella ticket archiviati")}
        >
          <div className="min-w-full">
            <table className="w-full">
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
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
                {listQuery.isLoading ? (
                  <tr>
                    <td colSpan={colSpan} className="text-center py-10 text-text3 text-sm">
                      {t("loading", "Caricamento...")}
                    </td>
                  </tr>
                ) : !rows.length ? (
                  <tr>
                    <td colSpan={colSpan} className="text-center py-10 text-text3 text-sm">
                      {t("noArchivedTickets", "Nessun ticket archiviato")}
                    </td>
                  </tr>
                ) : rows.length > 50 ? (
                  <>
                    {virtualItems.length > 0 && virtualItems[0].start > 0 && (
                      <tr style={{ height: virtualItems[0].start, visibility: "hidden" }}>
                        <td colSpan={colSpan} />
                      </tr>
                    )}
                    {virtualItems.map((virtualItem) => {
                      const ticket = rows[virtualItem.index];
                      return (
                        <tr
                          key={ticket.id}
                          ref={rowVirtualizer.measureElement}
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
                            <AssigneeChip
                              initials={ticket.assignee?.initials}
                              name={ticket.assignee?.full_name}
                            />
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
                                <Eye className="size-3" /> {t("details", "Dettagli")}
                              </button>
                              <button
                                className="pc-btn pc-btn-ghost pc-btn-sm"
                                onClick={() => reopen(ticket.id)}
                              >
                                <RotateCw className="size-3" /> {t("reopen", "Riapri")}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {virtualItems.length > 0 &&
                      (() => {
                        const lastItem = virtualItems[virtualItems.length - 1];
                        const bottomHeight = virtualTotalSize - lastItem.start - lastItem.size;
                        return bottomHeight > 0 ? (
                          <tr style={{ height: bottomHeight, visibility: "hidden" }}>
                            <td colSpan={colSpan} />
                          </tr>
                        ) : null;
                      })()}
                  </>
                ) : (
                  rows.map((ticket) => (
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
                        <AssigneeChip
                          initials={ticket.assignee?.initials}
                          name={ticket.assignee?.full_name}
                        />
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
                            <Eye className="size-3" /> {t("details", "Dettagli")}
                          </button>
                          <button
                            className="pc-btn pc-btn-ghost pc-btn-sm"
                            onClick={() => reopen(ticket.id)}
                          >
                            <RotateCw className="size-3" /> {t("reopen", "Riapri")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={loadMoreRef} className="flex items-center justify-center py-3">
        {isFetchingMore && (
          <span className="text-sm text-text3">{t("loadingMore", "Caricamento altri...")}</span>
        )}
        {!listQuery.hasNextPage && loadedCount > 0 && (
          <span className="text-xs text-text3 font-mono">
            {t("allLoaded", {
              count: loadedCount,
              total,
              defaultValue: "Tutti {{count}} di {{total}} caricati",
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function TicketArchiveMobileCard({
  ticket,
  onOpen,
  onReopen,
}: {
  ticket: Row;
  onOpen: () => void;
  onReopen: () => void;
}) {
  const { t } = useTranslation("tickets");
  const ticketClient = ticket.client_ref?.name || ticket.client || "-";
  const ticketSerial = ticket.device?.serial || null;

  return (
    <article
      className="pc-card pc-card-body flex flex-col transition-all duration-200"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="flex items-start gap-2.5">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="break-anywhere text-sm font-semibold">{ticket.ticket_code}</div>
          <div className="mt-1 font-mono text-[11px] text-text3">
            {ticket.device?.model || t("noAsset", "Nessun asset")}
            {ticketSerial ? ` · ${ticketSerial}` : ""}
          </div>
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <div>
          <div className="pc-label">{t("columns.client", "Cliente")}</div>
          <div className="break-anywhere">{ticketClient}</div>
        </div>
        <div>
          <div className="pc-label">{t("columns.requester", "Richiedente")}</div>
          <div>{ticket.requester}</div>
        </div>
        <div>
          <div className="pc-label">{t("columns.type", "Tipo")}</div>
          <TicketTypeBadge type={ticket.ticket_type} />
        </div>
        <div>
          <div className="pc-label">{t("columns.assignee", "Assegnatario")}</div>
          <AssigneeChip initials={ticket.assignee?.initials} name={ticket.assignee?.full_name} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityLabel p={ticket.priority} />
        <StatusBadge status={ticket.status} />
      </div>
      <div className="mt-2 text-[11px] text-text3">
        {t("columns.created", "Creato")}: {fmtDate(ticket.created_at)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onOpen}>
          <Eye className="size-3" /> {t("details", "Dettagli")}
        </button>
        <button type="button" className="pc-btn pc-btn-ghost pc-btn-sm" onClick={onReopen}>
          <RotateCw className="size-3" /> {t("reopen", "Riapri")}
        </button>
      </div>
    </article>
  );
}
