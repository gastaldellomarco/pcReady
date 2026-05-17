import { createFileRoute } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { fetchTicketsList, loadClientOptions } from "@/lib/queries/tickets";
import queries from "@/lib/queries/tickets";
import activityQueries from "@/lib/queries/activity";
import { useAuth } from "@/lib/auth-context";
import { useTickets } from "@/lib/use-tickets";
import {
  STATUS_META,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  PRIORITY_LABEL,
  TICKET_TYPE_LABEL,
  computeSlaStatus,
  formatSlaCountdown,
} from "@/lib/pcready";
import { openTicketDetail } from "@/lib/use-detail";
import { supabase } from "@/integrations/supabase/client";
import { PriorityLabel, AssigneeChip } from "@/components/pcready/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SwimLaneView } from "@/components/kanban/SwimLaneView";
import { cn } from "@/lib/utils";
import {
  DEFAULT_WIP_LIMITS,
  getKanbanAppSettings,
  updateKanbanAppSettings,
  type KanbanColumnColors,
  type WipLimits,
} from "@/lib/app-settings";
import { listTechnicians, type TechnicianOption } from "@/lib/technicians";
import { createNotification } from "@/lib/notifications";
import { sendTicketAssignedEmail } from "@/lib/email-events";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import {
  AsyncAutocomplete,
  type AsyncAutocompleteOption,
} from "@/components/pcready/AsyncAutocomplete";
import { Rows3, ChevronDown, ChevronRight, LayoutList, Clock, Settings2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/kanban")({
  head: () => ({
    meta: [
      { title: "Kanban — PCReady" },
      { name: "description", content: "Vista Kanban dei ticket per stato di preparazione." },
    ],
  }),
  component: KanbanPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

interface Card {
  id: string;
  ticket_code: string;
  client: string;
  client_id?: string | null;
  ticket_type?: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  assignee_id: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  due_date?: string | null;
  sla_deadline?: string | null;
  sla_breached?: boolean | null;
  device?: { model: string; serial: string | null } | null;
  assignee?: { id: string; full_name: string; initials: string } | null;
  completed_at?: string | null;
}

type ViewMode = "columns" | "swimlanes";
const KANBAN_STATUSES: TicketStatus[] = ["pending", "in-progress", "testing", "ready", "completed"];
const KANBAN_VIEW_MODE_KEY = "pcready:kanban:view-mode";
const KANBAN_FILTERS_KEY = "pcready:kanban:filters";
const KANBAN_COLLAPSED_COLUMNS_KEY = "pcready:kanban:collapsed-columns";

type SlaFilter = "all" | "warning" | "overdue";
type ClientOption = AsyncAutocompleteOption;

type KanbanFilters = {
  assignee: string;
  priority: string;
  type: string;
  clientId: string;
  clientLabel: string;
  sla: SlaFilter;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_KANBAN_FILTERS: KanbanFilters = {
  assignee: "all",
  priority: "all",
  type: "all",
  clientId: "",
  clientLabel: "",
  sla: "all",
  dateFrom: "",
  dateTo: "",
};

function loadStoredFilters(): KanbanFilters {
  if (typeof window === "undefined") return DEFAULT_KANBAN_FILTERS;
  try {
    return {
      ...DEFAULT_KANBAN_FILTERS,
      ...JSON.parse(window.localStorage.getItem(KANBAN_FILTERS_KEY) || "{}"),
    };
  } catch {
    return DEFAULT_KANBAN_FILTERS;
  }
}

function KanbanPage() {
  useTickets();
  const { canEdit, isAdmin, user, profile, session } = useAuth();
  const loadKanbanSettings = useServerFn(getKanbanAppSettings);
  const saveKanbanSettings = useServerFn(updateKanbanAppSettings);
  const loadTechnicians = useServerFn(listTechnicians);
  const notify = useServerFn(createNotification);
  const sendAssignedEmail = useServerFn(sendTicketAssignedEmail);

  const [rows, setRows] = useState<Card[]>([]);
  const [archiveDays, setArchiveDays] = useState<number>(7);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [wipLimits, setWipLimits] = useState<WipLimits>(DEFAULT_WIP_LIMITS);
  const [columnColors, setColumnColors] = useState<KanbanColumnColors>({});
  const [wipDialogOpen, setWipDialogOpen] = useState(false);
  const [wipDraft, setWipDraft] = useState<WipLimits>(DEFAULT_WIP_LIMITS);
  const [colorDraft, setColorDraft] = useState<KanbanColumnColors>({});
  const [savingWip, setSavingWip] = useState(false);
  const [filters, setFilters] = useState<KanbanFilters>(() => loadStoredFilters());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TicketStatus | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<TicketStatus>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(window.localStorage.getItem(KANBAN_COLLAPSED_COLUMNS_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkConfirmStatus, setBulkConfirmStatus] = useState<TicketStatus | null>(null);
  const [compactView, setCompactView] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KANBAN_VIEW_MODE_KEY + ":compact") === "true";
  });

  const toggleCollapseColumn = useCallback((status: TicketStatus) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }, []);

  useEffect(() => {
    window.localStorage.setItem(KANBAN_VIEW_MODE_KEY + ":compact", String(compactView));
  }, [compactView]);

  useEffect(() => {
    window.localStorage.setItem(KANBAN_FILTERS_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    window.localStorage.setItem(
      KANBAN_COLLAPSED_COLUMNS_KEY,
      JSON.stringify(Array.from(collapsedColumns)),
    );
  }, [collapsedColumns]);

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "columns";
    return window.localStorage.getItem(KANBAN_VIEW_MODE_KEY) === "swimlanes"
      ? "swimlanes"
      : "columns";
  });

  useEffect(() => {
    window.localStorage.setItem(KANBAN_VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const { useUpdateTicket } = queries as any;
  const updateTicket = useUpdateTicket();
  const { data: liveTickets, loading: ticketsLoading } = useRealtimeTable<Card>(
    "tickets",
    async () => {
      const { data } = await fetchTicketsList({ pageSize: 2000 });
      return (Array.isArray(data) ? data : []) as Card[];
    },
    [],
  );
  useEffect(() => {
    setRows(Array.isArray(liveTickets) ? liveTickets : []);
  }, [liveTickets]);

  useEffect(() => {
    if (!session?.access_token) return;
    loadKanbanSettings({ data: { accessToken: session.access_token } })
      .then((settings) => {
        const loadedWip = settings?.wip_limits ?? DEFAULT_WIP_LIMITS;
        const loadedColors = settings?.kanban_column_colors ?? {};
        setWipLimits(loadedWip);
        setWipDraft(loadedWip);
        setColumnColors(loadedColors);
        setColorDraft(loadedColors);
        setArchiveDays(settings?.archive_after_days ?? 7);
      })
      .catch((error) => toast.error(errorMessage(error, "Impossibile caricare i limiti WIP")));
    loadTechnicians({ data: { accessToken: session.access_token } })
      .then((t) => setTechnicians(Array.isArray(t) ? t : []))
      .catch((error) => toast.error(errorMessage(error, "Impossibile caricare i tecnici")));
  }, [session?.access_token, loadKanbanSettings, loadTechnicians]);

  function setFilter<K extends keyof KanbanFilters>(key: K, value: KanbanFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const loadClientFilterOptions = useCallback(async (query: string): Promise<ClientOption[]> => {
    const rows = await loadClientOptions(query);
    return rows.map((client) => ({
      value: client.id,
      label: client.company_name || client.name,
      description: client.email || client.name,
    }));
  }, []);

  async function saveWipSettings() {
    if (!session?.access_token || !isAdmin) return toast.error("Solo admin");
    setSavingWip(true);
    try {
      const result = await saveKanbanSettings({
        data: {
          accessToken: session.access_token,
          wip_limits: wipDraft,
          kanban_column_colors: colorDraft,
        },
      });
      setWipLimits(result.wip_limits);
      setColumnColors(result.kanban_column_colors ?? {});
      setWipDialogOpen(false);
      toast.success("Configurazione Kanban salvata");
    } catch (error) {
      toast.error(errorMessage(error, "Impossibile salvare configurazione Kanban"));
    } finally {
      setSavingWip(false);
    }
  }

  async function updatePriority(id: string, priority: TicketPriority) {
    if (!canEdit) return toast.error("Permessi insufficienti");
    const card = rows.find((r) => r.id === id);
    if (!card || card.priority === priority) return;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, priority } : row)));
    try {
      await updateTicket.mutateAsync({ id, patch: { priority } });
      toast.success(`Priorita aggiornata: ${PRIORITY_LABEL[priority]}`);
    } catch (err: any) {
      setRows((current) => current.map((row) => (row.id === id ? card : row)));
      toast.error(err?.message || "Errore aggiornamento priorita");
    }
  }

  async function moveTo(id: string, status: TicketStatus, assigneeId?: string | null) {
    if (!canEdit) return toast.error("Permessi insufficienti");
    const card = rows.find((r) => r.id === id);
    if (!card) return;
    const nextAssigneeId = assigneeId === undefined ? card.assignee_id : assigneeId;
    if (card.status === status && card.assignee_id === nextAssigneeId) return;
    const nextAssignee = nextAssigneeId
      ? technicians.find((technician) => technician.id === nextAssigneeId)
      : null;
    setRows((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              assignee_id: nextAssigneeId,
              assignee: nextAssignee
                ? {
                    id: nextAssignee.id,
                    full_name: nextAssignee.full_name,
                    initials: nextAssignee.initials,
                  }
                : null,
            }
          : r,
      ),
    );
    try {
      await updateTicket.mutateAsync({ id, patch: { status, assignee_id: nextAssigneeId } });
    } catch (err: any) {
      toast.error(err?.message || "Errore aggiornamento ticket");
      setRows((rs) => rs.map((r) => (r.id === id ? card : r)));
      return;
    }
    // Insert status history record when status changes
    if (card.status !== status) {
      await (queries as any).addTicketStatusHistory(id, {
        from_status: card.status,
        to_status: status,
        changed_by: user!.id,
        changed_at: new Date().toISOString(),
        note:
          nextAssigneeId !== card.assignee_id
            ? `Assegnato a ${nextAssignee?.full_name || "Non assegnato"}`
            : null,
      });
    }

    // Trigger completion workflow when status changes to 'completed'
    if (status === "completed" && card.status !== "completed" && session?.access_token) {
      const { completeTicketServer } = await import("@/lib/ticket-completion");
      void completeTicketServer({
        data: {
          ticketId: id,
          changedBy: user!.id,
          accessToken: session.access_token,
          template: "customer",
        },
      }).catch((err) => {
        console.error("Failed to complete ticket:", err);
        toast.error("Ticket completato, ma errore invio email/verbale");
      });
    }
    await (activityQueries.insertActivity as any)({
      type: "user",
      message: `${card.ticket_code}: stato → "${STATUS_META[status].label}" (kanban)`,
      ticket_id: card.id,
      actor_id: user!.id,
    });
    if (nextAssigneeId && session?.access_token) {
      await notify({
        data: {
          accessToken: session.access_token,
          notification: {
            userId: nextAssigneeId,
            type: "ticket_status_changed",
            title: `${card.ticket_code}: ${STATUS_META[status].label}`,
            body: `${card.client} - ${card.device?.model || "Nessun asset"}`,
            payload: { ticket_id: card.id, status, assignee_id: nextAssigneeId },
            link: "/kanban",
          },
        },
      });
    }
    if (nextAssigneeId && nextAssigneeId !== card.assignee_id) {
      void sendAssignedEmail({ data: { ticketId: card.id, assigneeId: nextAssigneeId } }).catch(
        (err) => {
          console.error("Failed to send ticket assigned email:", err);
        },
      );
    }
    toast.success(
      nextAssigneeId !== card.assignee_id
        ? `Spostato in ${STATUS_META[status].label} (${nextAssignee?.full_name || "Non assegnato"})`
        : `Spostato in ${STATUS_META[status].label}`,
    );
    // React Query invalidation handles refreshing lists
  }

  function handleKanbanCardClick(event: MouseEvent, ticketId: string) {
    if (event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      setSelectedTicketIds((prev) => {
        const next = new Set(prev);
        if (next.has(ticketId)) next.delete(ticketId);
        else next.add(ticketId);
        return next;
      });
      return;
    }
    openTicketDetail(ticketId);
  }

  function selectedKanbanCodesPreview() {
    const codes = selectedCards.map((ticket) => ticket.ticket_code);
    const visible = codes.slice(0, 8).join(", ");
    return codes.length > 8 ? `${visible}, +${codes.length - 8} altri` : visible;
  }

  function requestKanbanBulkStatus(status: TicketStatus) {
    if (status === "archived" || status === "completed") {
      setBulkConfirmStatus(status);
      return;
    }
    void applyKanbanBulkPatch({ status }, `cambio stato a ${STATUS_META[status].label}`);
  }

  async function applyKanbanBulkPatch(patch: Partial<Card>, actionLabel: string) {
    if (!canEdit) return toast.error("Permessi insufficienti");
    const ids = Array.from(selectedTicketIds);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const previousById = new Map(rows.map((ticket) => [ticket.id, ticket]));
      const { error } = await supabase
        .from("tickets")
        .update(patch as any)
        .in("id", ids as any);
      if (error) throw error;

      if (patch.status) {
        await Promise.all(
          ids.map((ticketId) =>
            (queries as any).addTicketStatusHistory(ticketId, {
              from_status: previousById.get(ticketId)?.status ?? null,
              to_status: patch.status,
              changed_by: user!.id,
              changed_at: new Date().toISOString(),
              note: `Operazione bulk Kanban: ${actionLabel}`,
            }),
          ),
        );
      }

      await (activityQueries.insertActivity as any)({
        type: "user",
        message: `${actionLabel}: ${ids.length} ticket da Kanban`,
        actor_id: user!.id,
        action_type: `bulk_kanban_${actionLabel}`,
        entity_type: "tickets",
        entity_id: "bulk",
        severity: patch.status === "archived" ? "warning" : "info",
        new_value: { ticket_ids: ids, patch },
      });
      setRows((current) =>
        current.map((ticket) =>
          selectedTicketIds.has(ticket.id) ? { ...ticket, ...patch } : ticket,
        ),
      );
      setSelectedTicketIds(new Set());
      toast.success(`${actionLabel}: ${ids.length} ticket aggiornati`);
    } catch (error) {
      toast.error(errorMessage(error, "Operazione bulk non riuscita"));
    } finally {
      setBulkBusy(false);
    }
  }

  const filteredRows = useMemo(() => {
    const baseRows = Array.isArray(rows) ? rows : [];
    return baseRows.filter((row) => {
      const matchesAssignee =
        filters.assignee === "all" ||
        (filters.assignee === "me" && row.assignee_id === profile?.id) ||
        (filters.assignee === "unassigned" && !row.assignee_id) ||
        row.assignee_id === filters.assignee;
      const matchesPriority = filters.priority === "all" || row.priority === filters.priority;
      const matchesType = filters.type === "all" || row.ticket_type === filters.type;
      const matchesClient = !filters.clientId || row.client_id === filters.clientId;
      const slaStatus = slaIndicator(row).status;
      const matchesSla = filters.sla === "all" || slaStatus === filters.sla;
      const createdAt = row.created_at ? new Date(row.created_at).getTime() : null;
      const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTime() : null;
      const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTime() : null;
      const matchesDateFrom = !from || (createdAt != null && createdAt >= from);
      const matchesDateTo = !to || (createdAt != null && createdAt <= to);
      return (
        matchesAssignee &&
        matchesPriority &&
        matchesType &&
        matchesClient &&
        matchesSla &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [filters, profile?.id, rows]);

  const selectedCards = useMemo(
    () => rows.filter((row) => selectedTicketIds.has(row.id)),
    [rows, selectedTicketIds],
  );

  const visibleStatuses = useMemo(
    () => KANBAN_STATUSES.filter((s) => !collapsedColumns.has(s)),
    [collapsedColumns],
  );

  const hasActiveFilters =
    filters.assignee !== "all" ||
    filters.priority !== "all" ||
    filters.type !== "all" ||
    !!filters.clientId ||
    filters.sla !== "all" ||
    !!filters.dateFrom ||
    !!filters.dateTo;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.assignee} onValueChange={(value) => setFilter("assignee", value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tutti i tecnici" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tecnici</SelectItem>
            <SelectItem value="me">Solo i miei</SelectItem>
            <SelectItem value="unassigned">Non assegnati</SelectItem>
            {(Array.isArray(technicians) ? technicians : []).map((technician) => (
              <SelectItem key={technician.id} value={technician.id}>
                {technician.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.priority} onValueChange={(value) => setFilter("priority", value)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Priorita" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={(value) => setFilter("type", value)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo ticket" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {Object.entries(TICKET_TYPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <AsyncAutocomplete<ClientOption>
          className="w-full sm:w-56"
          value={filters.clientId}
          selectedOption={
            filters.clientId
              ? { value: filters.clientId, label: filters.clientLabel || "Cliente" }
              : null
          }
          placeholder="Cliente"
          emptyLabel="Nessun cliente"
          loadOptions={loadClientFilterOptions}
          onChange={(value, option) =>
            setFilters((current) => ({
              ...current,
              clientId: value,
              clientLabel: option?.label ?? "",
            }))
          }
        />

        <Select value={filters.sla} onValueChange={(value) => setFilter("sla", value as SlaFilter)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="SLA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti SLA</SelectItem>
            <SelectItem value="warning">In scadenza</SelectItem>
            <SelectItem value="overdue">Violati</SelectItem>
          </SelectContent>
        </Select>

        <input
          className="pc-input w-full sm:w-36"
          type="date"
          value={filters.dateFrom}
          onChange={(event) => setFilter("dateFrom", event.target.value)}
          title="Ticket aperti da"
        />
        <input
          className="pc-input w-full sm:w-36"
          type="date"
          value={filters.dateTo}
          onChange={(event) => setFilter("dateTo", event.target.value)}
          title="Ticket aperti entro"
        />

        {hasActiveFilters && (
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={() => setFilters(DEFAULT_KANBAN_FILTERS)}
          >
            <X className="h-3.5 w-3.5" /> Azzera filtri
          </button>
        )}

        <button
          type="button"
          className={cn("pc-btn pc-btn-sm", compactView ? "pc-btn-primary" : "pc-btn-ghost")}
          onClick={() => setCompactView((prev) => !prev)}
          title="Vista compatta — nascondi colonne vuote"
        >
          <LayoutList className="h-3.5 w-3.5" />
          Compatta
        </button>

        <span className="ml-auto text-xs text-text3 font-mono flex items-center gap-2">
          {ticketsLoading ? (
            <span className="text-[10px] uppercase tracking-wide">Sincronizzazione…</span>
          ) : null}
          {filteredRows.length} di {rows.length} ticket
        </span>
        {isAdmin && (
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={() => {
              setWipDraft(wipLimits ?? DEFAULT_WIP_LIMITS);
              setColorDraft(columnColors ?? {});
              setWipDialogOpen(true);
            }}
          >
            <Settings2 className="h-3.5 w-3.5" /> WIP
          </button>
        )}
        <button
          type="button"
          className={cn(
            "pc-btn pc-btn-sm",
            viewMode === "swimlanes" ? "pc-btn-primary" : "pc-btn-ghost",
          )}
          onClick={() => setViewMode((mode) => (mode === "columns" ? "swimlanes" : "columns"))}
        >
          <Rows3 className="h-3.5 w-3.5" />
          Swim Lanes
        </button>
      </div>

      {viewMode === "swimlanes" ? (
        <SwimLaneView
          cards={filteredRows}
          technicians={Array.isArray(technicians) ? technicians : []}
          wipLimits={wipLimits ?? DEFAULT_WIP_LIMITS}
          statuses={KANBAN_STATUSES}
          visibleStatuses={visibleStatuses}
          collapsedColumns={collapsedColumns}
          compactView={compactView}
          onToggleCollapseColumn={toggleCollapseColumn}
          canEdit={canEdit}
          dragId={dragId}
          overCell={overCell}
          onDragStart={setDragId}
          onDragEnd={() => {
            setDragId(null);
            setOverCol(null);
            setOverCell(null);
          }}
          onDragOverCell={setOverCell}
          onDragLeaveCell={(cellId) => setOverCell((cell) => (cell === cellId ? null : cell))}
          onMove={(id, status, assigneeId) => void moveTo(id, status, assigneeId)}
          onPriorityChange={(id, priority) => void updatePriority(id, priority)}
          selectedCardIds={selectedTicketIds}
          onCardClick={handleKanbanCardClick}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {KANBAN_STATUSES.map((s) => {
            let items = filteredRows.filter((r) => r.status === s);
            if (s === "completed") {
              try {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - (archiveDays ?? 7));
                items = items.filter((r) => r.completed_at && new Date(r.completed_at) >= cutoff);
              } catch {
                // ignore date parse issues
              }
            }
            const count = items.length;
            const limit = (wipLimits ?? DEFAULT_WIP_LIMITS)[s];
            const isOverLimit = limit > 0 && count > limit;
            const wipPct = limit > 0 ? (count / limit) * 100 : 0;
            const isHidden = collapsedColumns.has(s);
            if (isHidden) {
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleCollapseColumn(s)}
                  className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-2 py-4 transition-all hover:border-text3"
                  style={{ background: columnColors[s] || undefined }}
                  title={`Espandi ${STATUS_META[s].label}`}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: STATUS_META[s].color }}
                  />
                  <span className="writing-mode-vertical text-[10px] font-bold uppercase tracking-wider text-text3 [writing-mode:vertical-rl]">
                    {STATUS_META[s].label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-text3" />
                  <span
                    className={cn(
                      "text-[10px] font-mono",
                      isOverLimit ? "text-red-600 font-bold" : "text-text3",
                    )}
                  >
                    {limit > 0 ? `${count}/${limit}` : count}
                  </span>
                </button>
              );
            }

            const isOver = overCol === s;
            return (
              <div
                key={s}
                className="flex flex-col gap-2 rounded-xl p-1"
                onDragOver={(e) => {
                  if (dragId) {
                    e.preventDefault();
                    setOverCol(s);
                  }
                }}
                onDragLeave={() => setOverCol((c) => (c === s ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) void moveTo(dragId, s);
                  setOverCol(null);
                  setDragId(null);
                  setOverCell(null);
                }}
              >
                <div className="flex items-center gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => toggleCollapseColumn(s)}
                    className="flex items-center gap-1 text-left"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: STATUS_META[s].color }}
                    />
                    <span className="text-[12px] font-bold uppercase tracking-wider">
                      {STATUS_META[s].label}
                    </span>
                    {!count && !compactView ? (
                      <ChevronDown className="h-3 w-3 text-text3 ml-0.5" />
                    ) : null}
                  </button>
                  {limit > 0 ? (
                    <div className="ml-auto flex items-center gap-1.5">
                      <WipProgressBar pct={wipPct} />
                      <span
                        className={cn(
                          "text-[10px] font-mono",
                          isOverLimit ? "text-red-600 font-bold" : "text-text3",
                        )}
                      >
                        {count}/{limit}
                      </span>
                    </div>
                  ) : (
                    <span className="ml-auto text-[10px] font-mono text-text3">{count}</span>
                  )}
                </div>

                <div
                  className="flex flex-col gap-2 min-h-[120px] p-2 rounded-[10px] transition-all"
                  style={{
                    background: isOver
                      ? `color-mix(in oklab, ${STATUS_META[s].color} 10%, transparent)`
                      : columnColors[s] || "transparent",
                    border: "1.5px dashed " + (isOver ? STATUS_META[s].color : "transparent"),
                  }}
                >
                  {items.map((c) => (
                    <div
                      key={c.id}
                      draggable={canEdit}
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                        setOverCell(null);
                      }}
                      onClick={(event) => handleKanbanCardClick(event, c.id)}
                      className={cn(
                        "pc-card group text-left hover:shadow-md transition-all select-none",
                        compactView ? "p-2" : "p-3",
                        selectedTicketIds.has(c.id) && "ring-2 ring-accent",
                      )}
                      style={{
                        cursor: canEdit ? "grab" : "pointer",
                        opacity: dragId === c.id ? 0.4 : 1,
                        transform: dragId === c.id ? "scale(0.98)" : undefined,
                        borderLeft: `4px solid ${slaIndicator(c).color}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10.5px] text-text3">{c.ticket_code}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: slaIndicator(c).color }}
                            title={slaIndicator(c).label}
                          />
                          <PriorityLabel p={c.priority} />
                        </div>
                      </div>
                      <div
                        className={cn(
                          "font-semibold",
                          compactView ? "text-[11.5px]" : "text-[12.5px] mb-0.5",
                        )}
                      >
                        {c.device?.model || "Nessun asset"}
                      </div>
                      {!compactView && (
                        <div className="text-[11px] text-text3 mb-2">{c.client}</div>
                      )}
                      {canEdit && (
                        <div
                          className="mt-2 hidden grid-cols-1 gap-1 group-hover:grid"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="grid grid-cols-3 gap-1">
                            <select
                              className="pc-input h-7 min-w-0 px-2 py-0 text-[10px] leading-none"
                              value={c.assignee_id ?? "unassigned"}
                              onChange={(event) =>
                                void moveTo(
                                  c.id,
                                  c.status,
                                  event.target.value === "unassigned" ? null : event.target.value,
                                )
                              }
                              title="Assegna"
                            >
                              <option value="unassigned">Non assegnato</option>
                              {technicians.map((technician) => (
                                <option key={technician.id} value={technician.id}>
                                  {technician.full_name}
                                </option>
                              ))}
                            </select>
                            <select
                              className="pc-input h-7 min-w-0 px-2 py-0 text-[10px] leading-none"
                              value={c.priority}
                              onChange={(event) =>
                                void updatePriority(c.id, event.target.value as TicketPriority)
                              }
                              title="Priorità"
                            >
                              {Object.entries(PRIORITY_LABEL).map(([priority, label]) => (
                                <option key={priority} value={priority}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <select
                              className="pc-input h-7 min-w-0 px-2 py-0 text-[10px] leading-none"
                              value={c.status}
                              onChange={(event) =>
                                void moveTo(c.id, event.target.value as TicketStatus)
                              }
                              title="Sposta a"
                            >
                              {KANBAN_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {STATUS_META[status].label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            className="pc-btn pc-btn-ghost pc-btn-sm h-7"
                            onClick={() => openTicketDetail(c.id)}
                          >
                            Apri dettaglio
                          </button>
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex items-center justify-between",
                          compactView ? "mt-2" : "",
                        )}
                      >
                        <div>
                          {c.assignee ? (
                            <AssigneeChip
                              initials={c.assignee.initials}
                              name={c.assignee.full_name}
                            />
                          ) : (
                            <UnassignedBadge />
                          )}
                        </div>
                        {!compactView && (
                          <div className="flex flex-col items-end gap-1">
                            <SlaMiniLabel card={c} />
                            <TimeInColumnLabel updatedAt={c.updated_at} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {!items.length && (
                    <div
                      className="text-center py-6 text-[11px] text-text3 rounded-[7px]"
                      style={{ border: "1.5px dashed var(--border2)" }}
                    >
                      Trascina qui
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedCards.length > 0 ? (
        <div
          className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border px-3 py-2 shadow-lg"
          style={{ background: "var(--surface1)", borderColor: "var(--border)" }}
        >
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white">
            {selectedCards.length} selezionati
          </span>
          <select
            className="pc-input h-8 max-w-[170px] px-3 py-0 text-[12px] leading-none"
            value=""
            disabled={bulkBusy || !canEdit}
            onChange={(event) => {
              const status = event.target.value as TicketStatus;
              if (status) requestKanbanBulkStatus(status);
            }}
          >
            <option value="">Cambia stato...</option>
            {KANBAN_STATUSES.concat("archived").map((status) => (
              <option key={status} value={status}>
                {STATUS_META[status].label}
              </option>
            ))}
          </select>
          <select
            className="pc-input h-8 max-w-[180px] px-3 py-0 text-[12px] leading-none"
            value=""
            disabled={bulkBusy || !canEdit}
            onChange={(event) => {
              const value = event.target.value;
              if (value)
                void applyKanbanBulkPatch(
                  { assignee_id: value === "unassigned" ? null : value },
                  "riassegnazione bulk",
                );
            }}
          >
            <option value="">Riassegna...</option>
            <option value="unassigned">Non assegnato</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.full_name}
              </option>
            ))}
          </select>
          <select
            className="pc-input h-8 max-w-[170px] px-3 py-0 text-[12px] leading-none"
            value=""
            disabled={bulkBusy || !canEdit}
            onChange={(event) => {
              const priority = event.target.value as TicketPriority;
              if (priority)
                void applyKanbanBulkPatch(
                  { priority },
                  `cambio priorita a ${PRIORITY_LABEL[priority]}`,
                );
            }}
          >
            <option value="">Priorita...</option>
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
            onClick={() => setBulkConfirmStatus("archived")}
          >
            Archivia
          </button>
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={() => setSelectedTicketIds(new Set())}
          >
            X Deseleziona
          </button>
          <span className="text-[10px] text-text3">Shift+click sulle card per selezionare</span>
        </div>
      ) : null}

      {wipDialogOpen && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setWipDialogOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border bg-surface p-5 shadow-lg"
            style={{ borderColor: "var(--border)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-bold">Configura Kanban</h3>
                <p className="text-[12px] text-text3">
                  Limiti WIP e colori sfondo colonne. 0 = nessun limite.
                </p>
              </div>
              <button className="pc-btn-icon" onClick={() => setWipDialogOpen(false)}>
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {KANBAN_STATUSES.map((status) => (
                <div
                  key={status}
                  className="rounded-lg border p-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: STATUS_META[status].color }}
                    />
                    <span className="text-[12px] font-bold uppercase tracking-wide">
                      {STATUS_META[status].label}
                    </span>
                  </div>
                  <label className="mb-2 block text-[11px] font-semibold text-text2">
                    Limite WIP
                    <input
                      type="number"
                      min={0}
                      max={999}
                      className="pc-input mt-1 w-full"
                      value={wipDraft[status] ?? 0}
                      onChange={(event) =>
                        setWipDraft((current) => ({
                          ...current,
                          [status]: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label className="block text-[11px] font-semibold text-text2">
                    Colore sfondo
                    <div className="mt-1 flex gap-2">
                      <input
                        type="color"
                        className="h-9 w-12 rounded border border-border bg-transparent"
                        value={normalizeColor(colorDraft[status] || STATUS_META[status].color)}
                        onChange={(event) =>
                          setColorDraft((current) => ({
                            ...current,
                            [status]: `${event.target.value}18`,
                          }))
                        }
                      />
                      <input
                        className="pc-input flex-1"
                        value={colorDraft[status] || ""}
                        onChange={(event) =>
                          setColorDraft((current) => ({ ...current, [status]: event.target.value }))
                        }
                        placeholder="#1B4FD818"
                      />
                    </div>
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="pc-btn pc-btn-ghost"
                onClick={() => {
                  setWipDraft(DEFAULT_WIP_LIMITS);
                  setColorDraft({});
                }}
              >
                Reset default
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-ghost"
                onClick={() => setWipDialogOpen(false)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-primary"
                disabled={savingWip}
                onClick={saveWipSettings}
              >
                {savingWip ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </div>
        </div>
      )}

      <DestructiveConfirmDialog
        open={!!bulkConfirmStatus}
        onOpenChange={(open) => !open && setBulkConfirmStatus(null)}
        title={
          bulkConfirmStatus === "completed"
            ? `Stai per completare ${selectedCards.length} ticket`
            : `Stai per archiviare ${selectedCards.length} ticket`
        }
        description={`Operazione bulk Kanban sui ticket: ${selectedKanbanCodesPreview()}`}
        confirmLabel="Conferma"
        loadingLabel="Aggiornamento..."
        onConfirm={async () => {
          if (!bulkConfirmStatus) return;
          await applyKanbanBulkPatch(
            { status: bulkConfirmStatus },
            bulkConfirmStatus === "completed"
              ? "completamento bulk"
              : `cambio stato a ${STATUS_META[bulkConfirmStatus].label}`,
          );
        }}
      />
    </div>
  );
}

function slaIndicator(card: Card) {
  const sla = computeSlaStatus(
    card.created_at || card.updated_at || new Date().toISOString(),
    card.priority,
    undefined,
    card.due_date || card.sla_deadline,
    card.sla_breached,
  );
  if (sla.status === "overdue")
    return { color: "#DC2626", label: "SLA violato", status: "overdue" as const };
  if (sla.status === "warning")
    return { color: "#CA8A04", label: "In scadenza", status: "warning" as const };
  return { color: "#16A34A", label: "SLA OK", status: "ok" as const };
}

function normalizeColor(value: string) {
  const match = value.match(/^#[0-9a-fA-F]{6}/);
  return match ? match[0] : "#ffffff";
}

function SlaMiniLabel({ card }: { card: Card }) {
  const indicator = slaIndicator(card);
  const deadline = card.due_date || card.sla_deadline;
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold"
      style={{
        background: `${indicator.color}22`,
        color: indicator.color,
      }}
      title={deadline ? formatSlaCountdown(deadline) : indicator.label}
    >
      {indicator.label}
    </span>
  );
}

function UnassignedBadge() {
  return (
    <span className="inline-flex items-center w-fit rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      Non assegnato
    </span>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** WIP progress bar with color thresholds: green <70%, yellow 70-90%, red >=90% */
function WipProgressBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "#DC2626" : pct >= 70 ? "#CA8A04" : "#16A34A";
  const bgColor = pct >= 90 ? "#FEE2E2" : pct >= 70 ? "#FEF9C3" : "#DCFCE7";
  return (
    <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: bgColor }}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  );
}

/** Shows how long a ticket has been in its current status column */
function TimeInColumnLabel({ updatedAt }: { updatedAt?: string | null }) {
  if (!updatedAt) return null;
  try {
    const d = new Date(updatedAt);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let label: string;
    if (hours < 1) label = `${minutes}m`;
    else if (hours < 24) label = `${hours}h`;
    else {
      const days = Math.floor(hours / 24);
      label = `${days}g`;
    }

    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-text3 font-mono"
        title={`In questa colonna da ${hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`}`}
      >
        <Clock className="h-2.5 w-2.5" />
        {label}
      </span>
    );
  } catch {
    return null;
  }
}
