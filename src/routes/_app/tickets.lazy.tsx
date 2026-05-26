import { createLazyFileRoute, Link } from "@tanstack/react-router";
import i18n from "@/i18n";
import { TableSkeletonRows, PageFetchError } from "@/components/page-states";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useTickets } from "@/lib/use-tickets";
import { addTicketStatusHistory, loadClientOptions, useTicketsInfiniteList, fetchAllTicketsList } from "@/lib/queries/tickets";
import { ExportPdf } from "@/components/ExportPdf";
import { listTechnicians, type TechnicianOption } from "@/lib/technicians";
import { useAuth } from "@/lib/auth-context";
import { openTicketDetail } from "@/lib/use-detail";
import {
  STATUS_META,
  type TicketStatus,
  type TicketPriority,
  type TicketType,
  PRIORITY_LABEL,
  TICKET_TYPE_LABEL,
  fmtDate,
  fmtDateTime,
  formatOpenDuration,
  computeSlaStatus,
  formatSlaCountdown,
  slaConfigToLimits,
  type SlaLimits,
  DEFAULT_SLA_LIMITS,
} from "@/lib/pcready";
import {
  StatusBadge,
  PriorityLabel,
  AssigneeChip,
  TicketTypeBadge,
} from "@/components/pcready/StatusBadge";
import { toast } from "sonner";
import { ArrowUpDown, Columns3, FileDown } from "lucide-react";
import type { TicketPdfRow } from "@/components/pcready/pdf/TicketListPdf";
import { getPublicAppSettings } from "@/lib/app-settings";
import { buildDownloadFileName } from "@/lib/downloads";
import {
  AsyncAutocomplete,
  type AsyncAutocompleteOption,
} from "@/components/pcready/AsyncAutocomplete";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { insertActivity } from "@/lib/queries/activity";
import { LIST_PAGE_SIZE } from "@/lib/queries/list-config";

export const Route = createLazyFileRoute("/_app/tickets")({
  component: TicketsPage,
});

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
  due_date?: string | null;
  sla_deadline?: string | null;
  sla_breached?: boolean | null;
  sla_response_at?: string | null;
  assignee_id: string | null;
  client_ref?: { name: string } | null;
  device?: { model: string; serial: string | null; os: string | null } | null;
  assignee?: { full_name: string; initials: string } | null;
}

const PAGE_SIZE = LIST_PAGE_SIZE;
type BulkConfirmAction = { type: "archive" } | { type: "status"; status: TicketStatus };
type TicketTableView = "compact" | "extended";
type TicketColumnKey =
  | "id"
  | "model"
  | "serial"
  | "client"
  | "requester"
  | "priority"
  | "status"
  | "type"
  | "assignee"
  | "created_at"
  | "sla"
  | "time_open";

type TicketColumnDefinition = {
  key: TicketColumnKey;
  label: string;
  sortable?: boolean;
  className: string;
  render: (ticket: Row) => React.ReactNode;
};

const COMPACT_TICKET_COLUMNS: TicketColumnKey[] = [
  "id",
  "model",
  "client",
  "priority",
  "status",
  "assignee",
  "sla",
  "time_open",
];

const EXTENDED_TICKET_COLUMNS: TicketColumnKey[] = [
  "id",
  "model",
  "serial",
  "client",
  "requester",
  "priority",
  "status",
  "type",
  "assignee",
  "created_at",
  "sla",
  "time_open",
];

function TicketsPage() {
  const { t } = useTranslation("tickets");
  const { search } = useTickets();
  const { session, user, canEdit } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedClient, setSelectedClient] = useState<AsyncAutocompleteOption | null>(null);
  const [total, setTotal] = useState(0);
  const [fs, setFs] = useState("");
  const [fp, setFp] = useState("");
  const [ft, setFt] = useState("");
  const [fc, setFc] = useState("");
  const [fa, setFa] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "priority" | "status">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [slaLimits, setSlaLimits] = useState<SlaLimits>(DEFAULT_SLA_LIMITS);
  const [pdfBusy, setPdfBusy] = useState<"download" | "preview" | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<BulkConfirmAction | null>(null);
  const [pendingDays, setPendingDays] = useState(3);
  const [hasUpdates, setHasUpdates] = useState(false);
  const [tableView, setTableView] = useState<TicketTableView>("compact");
  const [visibleColumns, setVisibleColumns] = useState<Set<TicketColumnKey>>(
    () => new Set(COMPACT_TICKET_COLUMNS),
  );
  const loadSettings = useServerFn(getPublicAppSettings);
  const loadTechnicians = useServerFn(listTechnicians);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const listQuery = useTicketsInfiniteList({
    status: fs || undefined,
    priority: fp || undefined,
    ticket_type: ft || undefined,
    client_id: fc || undefined,
    assignee_id: fa || undefined,
    q: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortDir,
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    if (listQuery.data) {
      setRows(listQuery.data.pages.flatMap((p) => p.data) as Row[]);
      setTotal(listQuery.data.pages[0]?.count ?? 0);
    }
  }, [listQuery.data]);

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

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get("status");
      if (statusParam) setFs(statusParam);
    } catch {
      /* ignore in non-browser contexts */
    }
  }, [fs, fp, ft, fc, search]);

  useEffect(() => {
    const channel = supabase
      .channel("tickets-list-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () =>
        setHasUpdates(true),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Load technicians list for assignee filter
  useEffect(() => {
    if (session?.access_token) {
      loadTechnicians({ data: { accessToken: session.access_token } })
        .then(setTechnicians)
        .catch(() => {});
    }
  }, [session?.access_token, loadTechnicians]);

  // Load SLA limits from public settings
  useEffect(() => {
    if (session?.access_token) {
      loadSettings({ data: { accessToken: session.access_token } })
        .then((settings) => {
          if (settings?.sla_config) setSlaLimits(slaConfigToLimits(settings.sla_config));
          else if (settings?.sla_limits) setSlaLimits(settings.sla_limits);
        })
        .catch(() => {});
    }
  }, [session?.access_token, loadSettings]);

  const data = rows;
  const listLoading = listQuery.isLoading;
  const isFetchingMore = listQuery.isFetchingNextPage;
  const loadedCount = data.length;
  const ticketClient = (row: Row) => row.client_ref?.name || row.client || "-";
  const ticketModel = (row: Row) => row.device?.model || t("noAsset", "Nessun asset");
  const ticketSerial = (row: Row) => row.device?.serial || null;
  const visibleIds = useMemo(() => data.map((ticket) => ticket.id), [data]);
  const selectedRows = useMemo(
    () => data.filter((ticket) => selectedTicketIds.has(ticket.id)),
    [data, selectedTicketIds],
  );
  const selectedCount = selectedTicketIds.size;
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedTicketIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedTicketIds.has(id));

  useEffect(() => {
    setSelectedTicketIds((prev) => {
      if (!prev.size) return prev;
      const visible = new Set(visibleIds);
      const next = new Set(Array.from(prev).filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);

  async function loadClientOptsWrapper(q: string) {
    try {
      const data = await loadClientOptions(q);
      return (data ?? []).map((client: any) => ({
        value: client.id,
        label: client.company_name || client.name,
        description: client.email,
      }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("toasts.loadClientsError", "Errore caricamento clienti"));
      return [];
    }
  }

  function rowToPdf(t: Row): TicketPdfRow {
    return {
      ticket_code: t.ticket_code,
      model: ticketModel(t),
      serial: ticketSerial(t),
      client: ticketClient(t),
      requester: t.requester,
      ticket_type: t.ticket_type,
      priority: t.priority,
      status: t.status,
      assignee: t.assignee?.full_name || null,
      created_at: t.created_at,
    };
  }

  const activeFilterRecord: Record<string, any> = {
    status: fs || undefined,
    priority: fp || undefined,
    ticket_type: ft || undefined,
    client_id: fc || undefined,
    assignee_id: fa || undefined,
    q: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortDir,
  };

  async function exportSuccessToast() {
    toast.success(t("toasts.pdfExported", "PDF ticket esportato"));
  }

  function exportErrorHandler(error: Error) {
    toast.error(errorMessage(error, t("toasts.pdfExportError", "Errore esportazione PDF")));
  }

  function toggleTicketSelection(id: string) {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
      else visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearSelection() {
    setSelectedTicketIds(new Set());
  }

  function selectCompletedVisible() {
    setSelectedTicketIds(
      new Set(data.filter((ticket) => ticket.status === "completed").map((ticket) => ticket.id)),
    );
  }

  function selectPendingOlderThan(days: number) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    setSelectedTicketIds(
      new Set(
        data
          .filter(
            (ticket) =>
              ticket.status === "pending" && new Date(ticket.created_at).getTime() < cutoff,
          )
          .map((ticket) => ticket.id),
      ),
    );
  }

  function selectCurrentClientVisible() {
    if (!fc) return toast.error(t("toasts.selectClientFilterFirst", "Seleziona prima un filtro cliente"));
    setSelectedTicketIds(
      new Set(data.filter((ticket) => ticket.client_id === fc).map((ticket) => ticket.id)),
    );
  }

  function selectedCodesPreview() {
    const codes = selectedRows.map((ticket) => ticket.ticket_code);
    const visible = codes.slice(0, 8).join(", ");
    return codes.length > 8 ? `${visible}, ${t("ticketList.moreOthers", { count: codes.length - 8, defaultValue: "+{{count}} altri" })}` : visible;
  }

  async function exportSelectedPdf() {
    if (!selectedRows.length) return toast.error(t("toasts.noTicketsSelected", "Nessun ticket selezionato"));
    setPdfBusy("download");
    try {
      const settings = session?.access_token
        ? await loadSettings({ data: { accessToken: session.access_token } }).catch(() => null)
        : null;
      const [{ downloadPdf }, { TicketListPdf }] = await Promise.all([
        import("@/components/pcready/pdf/export"),
        import("@/components/pcready/pdf/TicketListPdf"),
      ]);
      await downloadPdf(
        <TicketListPdf
          rows={selectedRows.map(rowToPdf)}
          organizationName={settings?.organization_name}
        />,
        buildDownloadFileName("pcready-ticket-selezionati", "pdf", { dated: true }),
      );
      toast.success(t("toasts.pdfSelectedExported", "PDF ticket selezionati esportato"));
    } catch (error) {
      toast.error(errorMessage(error, t("toasts.pdfExportError", "Errore esportazione PDF")));
    } finally {
      setPdfBusy(null);
    }
  }

  async function logBulkOperation(action: string, patch: Record<string, unknown>, ids: string[]) {
    await insertActivity({
      type: "user",
      message: `${action}: ${ids.length} ticket (${selectedRows.map((ticket) => ticket.ticket_code).join(", ")})`,
      actor_id: user?.id ?? null,
      action_type: `bulk_${action}`,
      entity_type: "tickets",
      entity_id: "bulk",
      severity: action.includes("archivia") || action.includes("completa") ? "warning" : "info",
      new_value: { ticket_ids: ids, patch },
    }).catch((error) => console.error("Failed to write bulk audit log", error));
  }

  async function applyBulkPatch(patch: Partial<Row>, actionLabel: string) {
    if (!canEdit) return toast.error(t("toasts.insufficientPermissions", "Permessi insufficienti"));
    const ids = Array.from(selectedTicketIds);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const previousById = new Map(selectedRows.map((ticket) => [ticket.id, ticket]));
      const { error } = await supabase
        .from("tickets")
        .update(patch as any)
        .in("id", ids as any);
      if (error) throw error;

      if (patch.status) {
        await Promise.all(
          ids.map((ticketId) => {
            const previous = previousById.get(ticketId);
            return addTicketStatusHistory(ticketId, {
              from_status: previous?.status ?? null,
              to_status: patch.status,
              changed_by: user?.id ?? null,
              changed_at: new Date().toISOString(),
              note: `${t("toasts.bulkOperation", "Operazione bulk")}: ${actionLabel}`,
            });
          }),
        );
      }

      await logBulkOperation(actionLabel, patch as Record<string, unknown>, ids);
      toast.success(t("ticketList.bulkUpdated", { label: actionLabel, count: ids.length, defaultValue: "{{label}}: {{count}} ticket aggiornati" }));
      clearSelection();
      await listQuery.refetch();
    } catch (error) {
      toast.error(errorMessage(error, t("toasts.bulkError", "Operazione bulk non riuscita")));
    } finally {
      setBulkBusy(false);
    }
  }

  function requestBulkStatus(status: TicketStatus) {
    if (!status) return;
    if (status === "archived" || status === "completed") {
      setBulkConfirm({ type: "status", status });
      return;
    }
    void applyBulkPatch({ status }, `cambio stato a ${STATUS_META[status].label}`);
  }

  async function confirmBulkAction() {
    if (!bulkConfirm) return;
    if (bulkConfirm.type === "archive") {
      await applyBulkPatch({ status: "archived" }, t("toasts.bulkArchive", "archiviazione bulk"));
      return;
    }
    await applyBulkPatch(
      { status: bulkConfirm.status },
      bulkConfirm.status === "completed"
        ? "completamento bulk"
        : `cambio stato a ${STATUS_META[bulkConfirm.status].label}`,
    );
  }

  function setTicketTableView(view: TicketTableView) {
    setTableView(view);
    setVisibleColumns(
      new Set(view === "compact" ? COMPACT_TICKET_COLUMNS : EXTENDED_TICKET_COLUMNS),
    );
  }

  function toggleColumn(key: TicketColumnKey, checked: boolean) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else if (next.size > 1) next.delete(key);
      return next;
    });
  }

  function textCell(value: string | null | undefined, empty = "-") {
    const text = value?.trim() || empty;
    return (
      <div className="truncate" title={text}>
        {text}
      </div>
    );
  }

  const allTicketColumns: TicketColumnDefinition[] = [
    {
      key: "id",
      label: t("columns.id", "ID"),
      className: "w-[76px] min-w-[76px] max-w-[76px]",
      render: (t) => (
        <div className="truncate font-mono text-[11.5px] text-text3" title={t.ticket_code}>
          {t.ticket_code}
        </div>
      ),
    },
    {
      key: "model",
      label: t("columns.model", "Modello"),
      className: "w-[170px] min-w-[150px] max-w-[210px]",
      render: (t) => textCell(ticketModel(t)),
    },
    {
      key: "serial",
      label: t("columns.serial", "Seriale"),
      className: "w-[120px] min-w-[110px] max-w-[150px]",
      render: (t) => (
        <div className="truncate font-mono text-[11px] text-text3" title={ticketSerial(t) || "-"}>
          {ticketSerial(t) || "-"}
        </div>
      ),
    },
    {
      key: "client",
      label: t("columns.client", "Cliente"),
      className: "w-[180px] min-w-[150px] max-w-[230px]",
      render: (t) => textCell(ticketClient(t)),
    },
    {
      key: "requester",
      label: t("columns.requester", "Richiedente"),
      className: "w-[160px] min-w-[130px] max-w-[210px]",
      render: (t) => textCell(t.requester),
    },
    {
      key: "priority",
      label: t("columns.priority", "Priorità"),
      sortable: true,
      className: "w-[90px] min-w-[80px] max-w-[100px]",
      render: (t) => <PriorityLabel p={t.priority} />,
    },
    {
      key: "status",
      label: t("columns.status", "Stato"),
      sortable: true,
      className: "w-[130px] min-w-[120px] max-w-[150px]",
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: "type",
      label: t("columns.type", "Tipo"),
      className: "w-[125px] min-w-[110px] max-w-[145px]",
      render: (t) => <TicketTypeBadge type={t.ticket_type} />,
    },
    {
      key: "assignee",
      label: t("columns.assignee", "Assegnatario"),
      className: "w-[150px] min-w-[130px] max-w-[180px]",
      render: (t) => <AssigneeChip initials={t.assignee?.initials} name={t.assignee?.full_name} />,
    },
    {
      key: "created_at",
      label: t("columns.created", "Creato"),
      sortable: true,
      className: "w-[95px] min-w-[85px] max-w-[110px]",
      render: (t) => (
        <div className="truncate text-[11px] text-text3" title={fmtDateTime(t.created_at)}>
          {fmtDate(t.created_at)}
        </div>
      ),
    },
    {
      key: "sla",
      label: t("columns.sla", "SLA"),
      className: "w-[150px] min-w-[140px] max-w-[170px]",
      render: (t) => (
        <SlaBadge
          created_at={t.created_at}
          priority={t.priority}
          slaLimits={slaLimits}
          deadline={t.due_date || t.sla_deadline}
          breached={t.sla_breached}
        />
      ),
    },
    {
      key: "time_open",
      label: t("columns.timeOpen", "Tempo aperto"),
      className: "w-[150px] min-w-[135px] max-w-[170px]",
      render: (t) => (
        <TimeOpenBadge created_at={t.created_at} priority={t.priority} slaLimits={slaLimits} />
      ),
    },
  ];
  const visibleTableColumns = allTicketColumns.filter((column) => visibleColumns.has(column.key));

  return (
    <div className="flex flex-col gap-4">
      {hasUpdates ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
          style={{
            background: "color-mix(in oklab, var(--accent) 8%, var(--surface1))",
            borderColor: "var(--border)",
          }}
        >
          <span className="text-text2">{t("updatesAvailable", "Sono disponibili aggiornamenti alla lista ticket.")}</span>
          <button
            type="button"
            className="pc-btn pc-btn-primary pc-btn-sm shrink-0"
            onClick={() => {
              void listQuery.refetch().then(() => setHasUpdates(false));
            }}
          >
            {t("meta.updateButton", "Aggiorna")}
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="pc-input max-w-[180px]"
          value={fs}
          onChange={(e) => setFs(e.target.value)}
        >
          <option value="">{t("allStates", "Tutti gli stati")}</option>
          {Object.entries(STATUS_META)
            .filter(([k]) => k !== "archived")
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
        </select>
        <select
          className="pc-input max-w-[160px]"
          value={fp}
          onChange={(e) => setFp(e.target.value)}
        >
          <option value="">{t("allPriorities", "Tutte le priorità")}</option>
          {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="pc-input max-w-[190px]"
          value={ft}
          onChange={(e) => setFt(e.target.value)}
        >
          <option value="">{t("allTypes", "Tutti i tipi")}</option>
          {Object.entries(TICKET_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <AsyncAutocomplete
          className="w-[220px]"
          value={fc}
          selectedOption={selectedClient}
          placeholder={t("allClients", "Tutti i clienti")}
          emptyLabel={t("noClient", "Nessun cliente")}
          loadOptions={loadClientOptsWrapper}
          onChange={(value, option) => {
            setFc(value);
            setSelectedClient(option);
          }}
        />
        <input
          type="date"
          className="pc-input max-w-[155px]"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title={t("meta.dateFrom", "Data inizio")}
        />
        <input
          type="date"
          className="pc-input max-w-[155px]"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title={t("meta.dateTo", "Data fine")}
        />
        <select
          className="pc-input max-w-[180px]"
          value={fa}
          onChange={(e) => setFa(e.target.value)}
        >
          <option value="">{t("allTechs", "Tutti i tecnici")}</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name}
            </option>
          ))}
        </select>
          <span className="ml-auto text-xs text-text3 font-mono">
            {total
              ? `${loadedCount} ${t("meta.of", "di")} ${total}`
              : t("ticketList.zeroResults", "0 risultati")}
          </span>
        <Link to="/tickets/archive" className="pc-btn pc-btn-ghost pc-btn-sm">
          {t("meta.history", "Storico")}
        </Link>
        <button onClick={() => setExportModalOpen(true)} disabled={!data.length} className="pc-btn pc-btn-ghost pc-btn-sm">
          <FileDown className="w-3 h-3" />
          {t("exportPdf", "Esporta PDF")}
        </button>
      </div>

      {selectedCount > 0 ? (
        <div
          className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 shadow-sm"
          style={{ background: "var(--surface1)", borderColor: "var(--border)" }}
        >
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white">
            {t("meta.selected", { count: selectedCount, defaultValue: "{{count}} selezionati" })}
          </span>
          <select
            className="pc-input max-w-[170px]"
            value=""
            disabled={bulkBusy || !canEdit}
            onChange={(event) => requestBulkStatus(event.target.value as TicketStatus)}
          >
            <option value="">{t("changeStatus", "Cambia stato...")}</option>
            {Object.entries(STATUS_META).map(([status, meta]) => (
              <option key={status} value={status}>
                {meta.label}
              </option>
            ))}
          </select>
          <select
            className="pc-input max-w-[190px]"
            value=""
            disabled={bulkBusy || !canEdit}
            onChange={(event) => {
              const value = event.target.value;
              if (value)
                void applyBulkPatch(
                  { assignee_id: value === "unassigned" ? null : value },
                  t("toasts.bulkReassignment", "riassegnazione bulk"),
                );
            }}
          >
            <option value="">{t("reassign", "Riassegna...")}</option>
            <option value="unassigned">{t("unassigned", "Non assegnato")}</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.full_name}
              </option>
            ))}
          </select>
          <select
            className="pc-input max-w-[170px]"
            value=""
            disabled={bulkBusy || !canEdit}
            onChange={(event) => {
              const value = event.target.value as TicketPriority;
              if (value)
                void applyBulkPatch(
                  { priority: value },
                  t("toasts.priorityChange", { label: PRIORITY_LABEL[value], defaultValue: "cambio priorità a {{label}}" }),
                );
            }}
          >
            <option value="">{t("changePriority", "Cambia priorità...")}</option>
            {Object.entries(PRIORITY_LABEL).map(([priority, label]) => (
              <option key={priority} value={priority}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="pc-btn pc-btn-danger pc-btn-sm"
            disabled={bulkBusy || !canEdit}
            onClick={() => setBulkConfirm({ type: "archive" })}
          >
            {t("archive", "Archivia")}
          </button>
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm"
            disabled={!!pdfBusy}
            onClick={exportSelectedPdf}
          >
            <FileDown className="w-3 h-3" /> {t("exportSelected", "Esporta selezionati")}
          </button>
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm ml-auto"
            onClick={clearSelection}
          >
            {t("deselectAll", "X Deseleziona tutto")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs text-text3">
        <span className="font-semibold text-text2">{t("quickSelect", "Selezione rapida:")}</span>
        <button
          type="button"
          className="pc-btn pc-btn-ghost pc-btn-sm"
          onClick={selectCompletedVisible}
        >
          {t("completedVisible", "Completati visibili")}
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={() => selectPendingOlderThan(pendingDays)}
          >
            {t("pendingOlderThan", "In attesa da più di")}
          </button>
          <input
            type="number"
            min={1}
            max={365}
            className="pc-input w-16"
            value={pendingDays}
            onChange={(event) => setPendingDays(Math.max(1, Number(event.target.value) || 1))}
          />
          <span>{t("days", "giorni")}</span>
        </div>
        <button
          type="button"
          className="pc-btn pc-btn-ghost pc-btn-sm"
          disabled={!fc}
          onClick={selectCurrentClientVisible}
        >
          {t("filteredClient", "Cliente filtrato")}
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div
            className="inline-flex overflow-hidden rounded-lg border"
            style={{ borderColor: "var(--border)" }}
          >
            {(
              [
                ["compact", t("compactView", "Compatta")],
                ["extended", t("extendedView", "Estesa")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="px-3 py-1.5 text-[11px] font-semibold transition-colors"
                style={{
                  background: tableView === value ? "var(--accent)" : "var(--surface2)",
                  color: tableView === value ? "var(--accent-foreground)" : "var(--text2)",
                }}
                onClick={() => setTicketTableView(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <details className="relative">
            <summary className="pc-btn pc-btn-ghost pc-btn-sm cursor-pointer list-none">
              <Columns3 className="w-3 h-3" /> {t("columnsMenu", { count: visibleTableColumns.length, defaultValue: "Colonne ({{count}})" })}
            </summary>
            <div
              className="absolute right-0 z-30 mt-2 w-56 rounded-xl border p-2 shadow-lg"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wide text-text3">
                {t("visibleColumns", "Colonne visibili")}
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {allTicketColumns.map((column) => (
                  <label
                    key={column.key}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-text2 hover:bg-surface2"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(column.key)}
                      disabled={visibleColumns.size === 1 && visibleColumns.has(column.key)}
                      onChange={(event) => toggleColumn(column.key, event.target.checked)}
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>

      {listQuery.isError ? (
        <PageFetchError
          message={t("ticketList.loadError", "Impossibile caricare i ticket. Controlla la connessione e riprova.")}
          onRetry={() => listQuery.refetch()}
        />
      ) : (
        <div className="pc-card overflow-hidden">
          <div className="overflow-x-auto">
            <table
              className={
                tableView === "compact"
                  ? "w-full min-w-[980px] table-fixed"
                  : "w-full min-w-[1420px] table-fixed"
              }
            >
              <thead>
                <tr>
                  <th
                    className="w-10 px-[10px] py-[9px] text-left border-b"
                    style={{ background: "var(--surface2)", borderColor: "var(--border)" }}
                  >
                    <input
                      type="checkbox"
                      aria-label={t("ticketList.selectAllVisible", "Seleziona tutti i ticket visibili")}
                      checked={allVisibleSelected}
                      data-indeterminate={
                        someVisibleSelected && !allVisibleSelected ? "true" : undefined
                      }
                      onChange={toggleAllVisible}
                    />
                  </th>
                  {visibleTableColumns.map((h) => (
                    <th
                      key={h.key}
                      className={`text-left px-[14px] py-[9px] text-[10.5px] font-bold uppercase tracking-wider text-text3 border-b select-none ${h.className}`}
                      style={{
                        background: "var(--surface2)",
                        borderColor: "var(--border)",
                        cursor: h.sortable ? "pointer" : undefined,
                      }}
                      onClick={
                        h.sortable
                          ? () => {
                              const col = h.key as "created_at" | "priority" | "status";
                              if (sortBy === col) {
                                setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                              } else {
                                setSortBy(col);
                                setSortDir("desc");
                              }
                            }
                          : undefined
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {h.label}
                        {h.sortable && sortBy === h.key ? (
                          sortDir === "desc" ? (
                            <span className="text-[10px]">&#9660;</span>
                          ) : (
                            <span className="text-[10px]">&#9650;</span>
                          )
                        ) : h.sortable ? (
                          <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <TableSkeletonRows
                    rows={12}
                    columns={visibleTableColumns.length + 1}
                    cellClassName="px-[14px] py-[10px]"
                  />
                ) : (
                  <>
                    {data.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b cursor-pointer transition-colors hover:bg-surface2"
                        style={{
                          borderColor: "var(--border)",
                          background: selectedTicketIds.has(row.id)
                            ? "color-mix(in oklab, var(--accent) 8%, transparent)"
                            : undefined,
                        }}
                        onClick={() => openTicketDetail(row.id)}
                      >
                        <td
                          className="px-[10px] py-[10px]"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={t("ticketList.selectTicket", { code: row.ticket_code, defaultValue: "Seleziona ticket {{code}}" })}
                            checked={selectedTicketIds.has(row.id)}
                            onChange={() => toggleTicketSelection(row.id)}
                          />
                        </td>
                        {visibleTableColumns.map((column) => (
                          <td
                            key={column.key}
                            className={`px-[14px] py-[10px] align-middle text-[12.5px] ${column.className}`}
                          >
                            {column.render(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!data.length && (
                      <tr>
                        <td
                          colSpan={visibleTableColumns.length + 1}
                          className="text-center py-10 text-text3 text-sm"
                        >
{t("noTickets", "Nessun ticket")}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
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

      <DestructiveConfirmDialog
        open={!!bulkConfirm}
        onOpenChange={(open) => !open && setBulkConfirm(null)}
        title={bulkConfirmTitle(bulkConfirm, selectedCount)}
        description={`${bulkConfirmDescription(bulkConfirm, selectedCount)}\n${t("bulk.ticketsInvolved", "Ticket coinvolti")}: ${selectedCodesPreview()}`}
        confirmLabel={t("confirm", "Conferma")}
        loadingLabel={t("updating", "Aggiornamento...")}
        onConfirm={confirmBulkAction}
      />

      <ExportPdf<Row, TicketPdfRow>
        open={exportModalOpen}
        onOpenChange={setExportModalOpen}
        entityLabel="ticket"
        renderPdf={async (rows, orgName) => {
          const { TicketListPdf: Tlp } = await import("@/components/pcready/pdf/TicketListPdf");
          return <Tlp rows={rows} organizationName={orgName} />;
        }}
        mapRow={rowToPdf}
        fileName={buildDownloadFileName("pcready-ticket", "pdf", { dated: true })}
        fetchAll={async (filters) => {
          const result = await fetchAllTicketsList(filters as any);
          return result as unknown as { data: Row[]; count: number };
        }}
        currentPageRows={data as Row[]}
        activeFilters={activeFilterRecord}
        totalFilteredCount={total}
        onSuccess={exportSuccessToast}
        onError={exportErrorHandler}
      />
    </div>
  );
}

function bulkConfirmTitle(action: BulkConfirmAction | null, count: number) {
  if (!action) return i18n.t("tickets:bulk.confirmTitle", "Conferma operazione bulk");
  if (action.type === "archive") return i18n.t("tickets:bulk.archiveTitle", { count, defaultValue: "Stai per archiviare {{count}} ticket" });
  if (action.status === "completed") return i18n.t("tickets:bulk.completeTitle", { count, defaultValue: "Stai per completare {{count}} ticket" });
  if (action.status === "archived") return i18n.t("tickets:bulk.archiveTitle", { count, defaultValue: "Stai per archiviare {{count}} ticket" });
  return i18n.t("tickets:bulk.changeStatusTitle", { count, defaultValue: "Stai per cambiare stato a {{count}} ticket" });
}

function bulkConfirmDescription(action: BulkConfirmAction | null, count: number) {
  if (!action) return i18n.t("tickets:bulk.confirmDescription", "Conferma l'operazione sui ticket selezionati.");
  if (action.type === "archive") {
    return i18n.t("tickets:bulk.archiveDescription", { count, defaultValue: "Questa operazione imposta lo stato archived su {{count}} ticket selezionati." });
  }
  return i18n.t("tickets:bulk.changeStatusDescription", { status: STATUS_META[action.status].label, count, defaultValue: "Questa operazione imposta lo stato {{status}} su {{count}} ticket selezionati." });
}

function SlaBadge({
  created_at,
  priority,
  slaLimits,
  deadline,
  breached,
}: {
  created_at: string;
  priority: TicketPriority;
  slaLimits?: SlaLimits;
  deadline?: string | null;
  breached?: boolean | null;
}) {
  const sla = computeSlaStatus(created_at, priority, slaLimits, deadline, breached);
  const palette =
    sla.status === "overdue"
      ? {
          bg: "var(--badge-danger-bg)",
          fg: "var(--badge-danger-fg)",
          border: "var(--badge-danger-border)",
          label: i18n.t("tickets:ticketList.slaViolated", "SLA violato"),
        }
      : sla.status === "warning"
        ? {
            bg: "var(--badge-warning-bg)",
            fg: "var(--badge-warning-fg)",
            border: "var(--badge-warning-border)",
            label: i18n.t("tickets:ticketList.slaExpiring", "In scadenza"),
          }
        : {
            bg: "var(--badge-success-bg)",
            fg: "var(--badge-success-fg)",
            border: "var(--badge-success-border)",
            label: i18n.t("tickets:ticketList.slaOk", "SLA OK"),
          };

  return (
    <span
      className="inline-flex flex-col gap-0.5 rounded-lg border px-2 py-1 text-[11px] font-medium whitespace-nowrap"
      style={{ background: palette.bg, borderColor: palette.border, color: palette.fg }}
      title={i18n.t("tickets:ticketList.slaDeadline", { date: fmtDateTime(sla.deadline), defaultValue: "Deadline SLA: {{date}}" })}
    >
      <span className="font-semibold">{palette.label}</span>
      <span className="font-mono opacity-80">{formatSlaCountdown(sla.deadline)}</span>
    </span>
  );
}

function TimeOpenBadge({
  created_at,
  priority,
  slaLimits,
}: {
  created_at: string;
  priority: TicketPriority;
  slaLimits?: SlaLimits;
}) {
  const sla = computeSlaStatus(created_at, priority, slaLimits);
  const created = new Date(created_at);
  const hoursOpen = (Date.now() - created.getTime()) / (1000 * 60 * 60);

  let bg: string;
  let fg: string;
  let border: string;
  let label: string;
  if (sla.status === "overdue") {
    bg = "var(--badge-danger-bg)";
    fg = "var(--badge-danger-fg)";
    border = "var(--badge-danger-border)";
    label = i18n.t("tickets:ticketList.slaExpired", "SLA scaduto");
  } else if (hoursOpen > 72) {
    bg = "var(--badge-danger-bg)";
    fg = "var(--badge-danger-fg)";
    border = "var(--badge-danger-border)";
    label = i18n.t("tickets:ticketList.slaOver3d", "> 3gg");
  } else if (hoursOpen > 24) {
    bg = "var(--badge-warning-bg)";
    fg = "var(--badge-warning-fg)";
    border = "var(--badge-warning-border)";
    label = i18n.t("tickets:ticketList.slaBetween1and3d", "1-3gg");
  } else {
    bg = "var(--badge-success-bg)";
    fg = "var(--badge-success-fg)";
    border = "var(--badge-success-border)";
    label = i18n.t("tickets:ticketList.slaUnder24h", "< 24h");
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{
        background: bg,
        borderColor: border,
        color: fg,
      }}
      title={i18n.t("tickets:ticketList.createdTooltip", { date: fmtDateTime(created_at), defaultValue: "Creato: {{date}}" })}
    >
      {formatOpenDuration(created_at)}
      <span className="opacity-70">({label})</span>
    </span>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
