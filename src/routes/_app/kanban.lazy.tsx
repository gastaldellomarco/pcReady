import { createLazyFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Rows3, LayoutList, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { KanbanColumnsView } from "@/components/kanban/KanbanColumnsView";
import { SwimLaneView, type SwimLaneGroupMode } from "@/components/kanban/SwimLaneView";
import {
  AsyncAutocomplete,
  type AsyncAutocompleteOption,
} from "@/components/pcready/AsyncAutocomplete";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTickets } from "@/hooks/use-tickets";
import { useKanbanPresence } from "@/hooks/useKanbanPresence";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_WIP_LIMITS,
  getKanbanAppSettings,
  updateKanbanAppSettings,
  type KanbanColumnColors,
  type KanbanColumnNotes,
  type WipLimits,
} from "@/lib/app-settings";
import { useAuth } from "@/lib/auth-context";
import { setTicketContext } from "@/lib/detail-navigation";
import { sendTicketAssignedEmail } from "@/lib/email-events";
import { errorMessage } from "@/lib/errors";
import { createNotification } from "@/lib/notifications";
import {
  STATUS_META,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  PRIORITY_LABEL,
  TICKET_TYPE_LABEL,
  computeSlaStatus,
} from "@/lib/pcready";
import activityQueries from "@/lib/queries/activity";
import { fetchTicketsList, fetchStatusChangeTimestamps, loadClientOptions } from "@/lib/queries/tickets";
import queries from "@/lib/queries/tickets";
import { listTechnicians, type TechnicianOption } from "@/lib/technicians";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/_app/kanban")({
  component: KanbanPage,
});

/**
 *
 */
export interface Card {
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
const KANBAN_GROUP_MODE_KEY = "pcready:kanban:group-mode";

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
  const { t } = useTranslation(["kanban", "tickets"]);
  const isMobile = useIsMobile();
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
  const [columnNotes, setColumnNotes] = useState<KanbanColumnNotes>({
    pending: "", "in-progress": "", testing: "", ready: "", completed: "", archived: "",
  });
  const [noteSaving, setNoteSaving] = useState<TicketStatus | null>(null);
  const [wipDialogOpen, setWipDialogOpen] = useState(false);
  const [wipDraft, setWipDraft] = useState<WipLimits>(DEFAULT_WIP_LIMITS);
  const [colorDraft, setColorDraft] = useState<KanbanColumnColors>({});
  const [savingWip, setSavingWip] = useState(false);
  const [filters, setFilters] = useState<KanbanFilters>(() => loadStoredFilters());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TicketStatus | null>(null);
  const [overLimitCol, setOverLimitCol] = useState<TicketStatus | null>(null);
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
  const { cardViewers, setCurrentCard } = useKanbanPresence(
    profile?.id,
    profile?.initials ?? "",
    profile?.full_name ?? "",
  );

  const [statusChangedAtMap, setStatusChangedAtMap] = useState<Map<string, string>>(new Map());

  // Fetch latest status-change timestamps for visible tickets
  useEffect(() => {
    if (dragId) return; // skip while dragging to avoid churn
    const ids = rows.map((r) => r.id);
    if (!ids.length) return;
    fetchStatusChangeTimestamps(ids)
      .then(setStatusChangedAtMap)
      .catch(() => {/* best-effort */});
  }, [rows, dragId]);

  const [groupMode, setGroupMode] = useState<SwimLaneGroupMode>(() => {
    if (typeof window === "undefined") return "technician";
    const stored = window.localStorage.getItem(KANBAN_GROUP_MODE_KEY);
    if (stored === "client" || stored === "priority") return stored;
    return "technician";
  });

  useEffect(() => {
    window.localStorage.setItem(KANBAN_GROUP_MODE_KEY, groupMode);
  }, [groupMode]);

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
        const loadedNotes = settings?.kanban_column_notes ?? {};
        setWipLimits(loadedWip);
        setWipDraft(loadedWip);
        setColumnColors(loadedColors);
        setColorDraft(loadedColors);
        setColumnNotes((prev) => ({ ...prev, ...loadedNotes }));
        setArchiveDays(settings?.archive_after_days ?? 7);
      })
      .catch((error) => toast.error(errorMessage(error, t("toasts.wipLoadError", "Impossibile caricare i limiti WIP"))));
    loadTechnicians({ data: { accessToken: session.access_token } })
      .then((t) => setTechnicians(Array.isArray(t) ? t : []))
      .catch((error) => toast.error(errorMessage(error, t("toasts.techsLoadError", "Impossibile caricare i tecnici"))));
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

  async function saveColumnNote(status: TicketStatus, text: string) {
    if (!session?.access_token || !isAdmin) return;
    setNoteSaving(status);
    try {
      const updated = { ...columnNotes, [status]: text };
      const result = await saveKanbanSettings({
        data: {
          accessToken: session.access_token,
          wip_limits: wipLimits,
          kanban_column_colors: columnColors,
          kanban_column_notes: updated,
        },
      });
      setColumnNotes(result.kanban_column_notes ?? updated);
    } catch (err) {
      toast.error(errorMessage(err, "Impossibile salvare la nota"));
    } finally {
      setNoteSaving(null);
    }
  }

  async function saveWipSettings() {
    if (!session?.access_token || !isAdmin) return toast.error(t("tickets:toasts.adminOnly", "Solo admin"));
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
      toast.success(t("toasts.wipSaveSuccess", "Configurazione Kanban salvata"));
    } catch (error) {
      toast.error(errorMessage(error, t("toasts.wipSaveError", "Impossibile salvare configurazione Kanban")));
    } finally {
      setSavingWip(false);
    }
  }

  async function updatePriority(id: string, priority: TicketPriority) {
    if (!canEdit) return toast.error(t("tickets:toasts.unauthorized", "Permessi insufficienti"));
    const card = rows.find((r) => r.id === id);
    if (!card || card.priority === priority) return;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, priority } : row)));
    try {
      await updateTicket.mutateAsync({ id, patch: { priority } });
      toast.success(t("toasts.prioritySuccess", "Priorità aggiornata: {{priority}}", { priority: t("tickets:priority." + priority, PRIORITY_LABEL[priority]) }));
    } catch (err: any) {
      setRows((current) => current.map((row) => (row.id === id ? card : row)));
      toast.error(err?.message || t("toasts.priorityError", "Errore aggiornamento priorità"));
    }
  }

  async function moveTo(id: string, status: TicketStatus, assigneeId?: string | null) {
    if (!canEdit) return toast.error(t("tickets:toasts.unauthorized", "Permessi insufficienti"));
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
      toast.error(err?.message || t("toasts.ticketUpdateError", "Errore aggiornamento ticket"));
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
            ? t("tickets:history.assignedTo", "Assegnato a {{name}}", { name: nextAssignee?.full_name || t("tickets:unassigned", "Non assegnato") })
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
        toast.error(t("toasts.completeEmailError", "Ticket completato, ma errore invio email/verbale"));
      });
    }
    await (activityQueries.insertActivity as any)({
      type: "user",
      message: `${card.ticket_code}: stato → "${t("tickets:status." + status, STATUS_META[status].label)}" (kanban)`,
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
            title: `${card.ticket_code}: ${t("tickets:status." + status, STATUS_META[status].label)}`,
            body: `${card.client} - ${card.device?.model || t("tickets:noAsset", "Nessun asset")}`,
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
        ? t("toasts.movedToWithAssignee", "Spostato in {{status}} ({{assignee}})", { status: t("tickets:status." + status, STATUS_META[status].label), assignee: nextAssignee?.full_name || t("tickets:unassigned", "Non assegnato") })
        : t("toasts.movedTo", "Spostato in {{status}}", { status: t("tickets:status." + status, STATUS_META[status].label) }),
    );
    // React Query invalidation handles refreshing lists
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

  const columnCounts = useMemo(() => {
    const counts: Partial<Record<TicketStatus, number>> = {};
    for (const card of filteredRows) {
      counts[card.status] = (counts[card.status] || 0) + 1;
    }
    return counts as Record<TicketStatus, number>;
  }, [filteredRows]);

  const isWipBlocked = useCallback(
    (targetStatus: TicketStatus, currentDragId: string | null): boolean => {
      if (!currentDragId) return false;
      const draggedCard = rows.find((r) => r.id === currentDragId);
      if (!draggedCard || draggedCard.status === targetStatus) return false;
      const limit = (wipLimits ?? DEFAULT_WIP_LIMITS)[targetStatus];
      if (!limit || limit <= 0) return false;
      const currentCount = columnCounts[targetStatus] ?? 0;
      return currentCount >= limit;
    },
    [columnCounts, rows, wipLimits],
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

  const handleOpenTicket = useCallback(
    (ticketId: string) => {
      const orderedIds = filteredRows.map((r) => r.id);
      setTicketContext(ticketId, orderedIds);
    },
    [filteredRows],
  );

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
    handleOpenTicket(ticketId);
  }

  function selectedKanbanCodesPreview() {
    const codes = selectedCards.map((ticket) => ticket.ticket_code);
    const visible = codes.slice(0, 8).join(", ");
    return codes.length > 8 ? `${visible}, +${codes.length - 8} ${t("tickets:bulk.others", "altri")}` : visible;
  }

  function requestKanbanBulkStatus(status: TicketStatus) {
    if (status === "archived" || status === "completed") {
      setBulkConfirmStatus(status);
      return;
    }
    void applyKanbanBulkPatch({ status }, t("bulk.changeStatusTo", "cambio stato a {{status}}", { status: t("tickets:status." + status, STATUS_META[status].label) }));
  }

  async function applyKanbanBulkPatch(patch: Partial<Card>, actionLabel: string) {
    if (!canEdit) return toast.error(t("tickets:toasts.unauthorized", "Permessi insufficienti"));
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
              note: t("bulk.historyNote", "Operazione bulk Kanban: {{action}}", { action: actionLabel }),
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
      toast.success(t("toasts.bulkSuccess", "{{action}}: {{count}} ticket aggiornati", { action: actionLabel, count: ids.length }));
    } catch (error) {
      toast.error(errorMessage(error, t("toasts.bulkError", "Operazione bulk non riuscita")));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.assignee} onValueChange={(value) => setFilter("assignee", value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t("filters.allTechs", "Tutti i tecnici")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allTechs", "Tutti i tecnici")}</SelectItem>
            <SelectItem value="me">{t("filters.myTickets", "Solo i miei")}</SelectItem>
            <SelectItem value="unassigned">{t("filters.unassigned", "Non assegnati")}</SelectItem>
            {(Array.isArray(technicians) ? technicians : []).map((technician) => (
              <SelectItem key={technician.id} value={technician.id}>
                {technician.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.priority} onValueChange={(value) => setFilter("priority", value)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder={t("tickets:columns.priority", "Priorità")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allPriorities", "Tutte le priorità")}</SelectItem>
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {t("tickets:priority." + value, label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.type} onValueChange={(value) => setFilter("type", value)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder={t("tickets:columns.type", "Tipo")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allTypes", "Tutti i tipi")}</SelectItem>
            {Object.entries(TICKET_TYPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {t("tickets:type." + value, label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <AsyncAutocomplete<ClientOption>
          className="w-full sm:w-56"
          value={filters.clientId}
          selectedOption={
            filters.clientId
              ? { value: filters.clientId, label: filters.clientLabel || t("tickets:columns.client", "Cliente") }
              : null
          }
          placeholder={t("tickets:columns.client", "Cliente")}
          emptyLabel={t("filters.noClient", "Nessun cliente")}
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
            <SelectValue placeholder={t("tickets:columns.sla", "SLA")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allSla", "Tutti SLA")}</SelectItem>
            <SelectItem value="warning">{t("tickets:status.expiring", "In scadenza")}</SelectItem>
            <SelectItem value="overdue">{t("filters.breached", "Violati")}</SelectItem>
          </SelectContent>
        </Select>

        <DatePickerInput
          className="w-full sm:w-36"
          value={filters.dateFrom}
          onChange={(v) => setFilter("dateFrom", v)}
          title={t("tickets:dateFrom", "Data inizio")}
        />
        <DatePickerInput
          className="w-full sm:w-36"
          value={filters.dateTo}
          onChange={(v) => setFilter("dateTo", v)}
          title={t("tickets:dateTo", "Data fine")}
        />

        {hasActiveFilters && (
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={() => setFilters(DEFAULT_KANBAN_FILTERS)}
          >
            <X className="h-3.5 w-3.5" /> {t("filters.clear", "Azzera filtri")}
          </button>
        )}

        <button
          type="button"
          className={cn("pc-btn pc-btn-sm", compactView ? "pc-btn-primary" : "pc-btn-ghost")}
          onClick={() => setCompactView((prev) => !prev)}
          title={t("compactTitle", "Vista compatta — nascondi colonne vuote")}
        >
          <LayoutList className="h-3.5 w-3.5" />
          {t("compact", "Compatta")}
        </button>

        <span className="ml-auto text-xs text-text3 font-mono flex items-center gap-2">
          {ticketsLoading ? (
            <span className="text-[10px] uppercase tracking-wide">{t("syncing", "Sincronizzazione…")}</span>
          ) : null}
          {filteredRows.length} {t("tickets:of", "di")} {rows.length} {t("ticketCount", "ticket")}
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
        )}          <button
            type="button"
            className={cn(
              "pc-btn pc-btn-sm",
              viewMode === "swimlanes" ? "pc-btn-primary" : "pc-btn-ghost",
            )}
            onClick={() => setViewMode((mode) => (mode === "columns" ? "swimlanes" : "columns"))}
          >
            <Rows3 className="h-3.5 w-3.5" />
            {t("swimlanes", "Swim Lanes")}
          </button>

          {viewMode === "swimlanes" && [
            <button
              key="group-tech"
              type="button"
              className={cn("pc-btn pc-btn-sm", groupMode === "technician" ? "pc-btn-primary" : "pc-btn-ghost")}
              onClick={() => setGroupMode("technician")}
            >
              {t("groupByTech", "Tecnico")}
            </button>,
            <button
              key="group-client"
              type="button"
              className={cn("pc-btn pc-btn-sm", groupMode === "client" ? "pc-btn-primary" : "pc-btn-ghost")}
              onClick={() => setGroupMode("client")}
            >
              {t("groupByClient", "Cliente")}
            </button>,
            <button
              key="group-priority"
              type="button"
              className={cn("pc-btn pc-btn-sm", groupMode === "priority" ? "pc-btn-primary" : "pc-btn-ghost")}
              onClick={() => setGroupMode("priority")}
            >
              {t("groupByPriority", "Priorità")}
            </button>,
          ]}
      </div>

      {viewMode === "swimlanes" ? (
        <SwimLaneView
          cards={filteredRows}
          technicians={Array.isArray(technicians) ? technicians : []}
          groupMode={groupMode}
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
          cardViewers={cardViewers}
          setCurrentCard={setCurrentCard}
          statusChangedAtMap={statusChangedAtMap}
        />
      ) : (
        <KanbanColumnsView
          cards={filteredRows}
          archiveDays={archiveDays}
          wipLimits={wipLimits ?? DEFAULT_WIP_LIMITS}
          columnColors={columnColors}
          columnNotes={columnNotes}
          noteSaving={noteSaving}
          collapsedColumns={collapsedColumns}
          compactView={compactView}
          isMobile={isMobile}
          dragId={dragId}
          overCol={overCol}
          overLimitCol={overLimitCol}
          canEdit={canEdit}
          isAdmin={isAdmin}
          technicians={Array.isArray(technicians) ? technicians : []}
          selectedTicketIds={selectedTicketIds}
          cardViewers={cardViewers}
          statusChangedAtMap={statusChangedAtMap}
          isWipBlocked={isWipBlocked}
          onToggleCollapseColumn={toggleCollapseColumn}
          onDragStart={setDragId}
          onDragEnd={() => {
            setDragId(null);
            setOverCol(null);
            setOverCell(null);
          }}
          onOverCol={setOverCol}
          onOverLimitCol={setOverLimitCol}
          onOverCell={setOverCell}
          onMove={(id, status, assigneeId) => void moveTo(id, status, assigneeId)}
          onPriorityChange={(id, priority) => void updatePriority(id, priority)}
          onCardClick={handleKanbanCardClick}
          onSaveColumnNote={saveColumnNote}
          onSetCurrentCard={setCurrentCard}
        />
      )}

      {selectedCards.length > 0 ? (
        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 z-40 flex flex-wrap items-center gap-1.5 rounded-t-xl border px-2 py-2 shadow-lg",
            isMobile ? "pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]" : "bottom-4 left-1/2 max-w-[calc(100vw-2rem)] -translate-x-1/2",
            !isMobile && "rounded-xl",
          )}
          style={{ background: "var(--surface1)", borderColor: "var(--border)" }}
        >
          {isMobile && (
            <div className="flex w-full items-center justify-between gap-1">
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
                {selectedCards.length} {t("bulk.selected", "selezionati")}
              </span>
              <button
                type="button"
                className="pc-btn pc-btn-ghost pc-btn-xs"
                onClick={() => setSelectedTicketIds(new Set())}
              >
                <X className="h-3 w-3" /> {t("bulk.deselect", "Deseleziona")}
              </button>
            </div>
          )}
          {!isMobile && (
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white">
              {selectedCards.length} {t("bulk.selected", "selezionati")}
            </span>
          )}
          <select
            className="pc-input h-8 max-w-[170px] px-3 py-0 text-[12px] leading-none"
            value=""
            disabled={bulkBusy || !canEdit}
            onChange={(event) => {
              const status = event.target.value as TicketStatus;
              if (status) requestKanbanBulkStatus(status);
            }}
          >
            <option value="">{t("bulk.changeStatus", "Cambia stato...")}</option>
            {KANBAN_STATUSES.concat("archived").map((status) => (
              <option key={status} value={status}>
                {t("tickets:status." + status, STATUS_META[status].label)}
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
                  t("bulk.reassignAction", "riassegnazione bulk"),
                );
            }}
          >
            <option value="">{t("bulk.reassign", "Riassegna...")}</option>
            <option value="unassigned">{t("tickets:unassigned", "Non assegnato")}</option>
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
                  t("bulk.changePriorityAction", "cambio priorità a {{priority}}", { priority: t("tickets:priority." + priority, PRIORITY_LABEL[priority]) }),
                );
            }}
          >
            <option value="">{t("bulk.priority", "Priorità...")}</option>
            {Object.entries(PRIORITY_LABEL).map(([priority, label]) => (
              <option key={priority} value={priority}>
                {t("tickets:priority." + priority, label)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="pc-btn pc-btn-danger pc-btn-sm"
            disabled={bulkBusy || !canEdit}
            onClick={() => setBulkConfirmStatus("archived")}
          >
            {t("bulk.archive", "Archivia")}
          </button>
          <button
            type="button"
            className="pc-btn pc-btn-ghost pc-btn-sm"
            onClick={() => setSelectedTicketIds(new Set())}
          >
            X {t("bulk.deselect", "Deseleziona")}
          </button>
          {!isMobile && (
            <span className="text-[10px] text-text3">{t("bulk.shiftClickHint", "Shift+click sulle card per selezionare")}</span>
          )}
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
                <h3 className="text-[15px] font-bold">{t("wipConfig.title", "Configura Kanban")}</h3>
                <p className="text-[12px] text-text3">
                  {t("wipConfig.desc", "Limiti WIP e colori sfondo colonne. 0 = nessun limite.")}
                </p>
              </div>
              <button className="pc-btn-icon touch-target" onClick={() => setWipDialogOpen(false)}>
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
                      {t("tickets:status." + status, STATUS_META[status].label)}
                    </span>
                  </div>
                  <label className="mb-2 block text-[11px] font-semibold text-text2">
                    {t("wipConfig.wipLimitLabel", "Limite WIP")}
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
                    {t("wipConfig.bgColorLabel", "Colore sfondo")}
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
                {t("wipConfig.reset", "Reset default")}
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-ghost"
                onClick={() => setWipDialogOpen(false)}
              >
                {t("wipConfig.cancel", "Annulla")}
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-primary"
                disabled={savingWip}
                onClick={saveWipSettings}
              >
                {savingWip ? t("wipConfig.saving", "Salvataggio...") : t("wipConfig.save", "Salva")}
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
            ? t("bulk.confirmTitleComplete", "Stai per completare {{count}} ticket", { count: selectedCards.length })
            : t("bulk.confirmTitleArchive", "Stai per archiviare {{count}} ticket", { count: selectedCards.length })
        }
        description={t("bulk.confirmDesc", "Operazione bulk Kanban sui ticket: {{preview}}", { preview: selectedKanbanCodesPreview() })}
        confirmLabel={t("tickets:confirm", "Conferma")}
        loadingLabel={t("tickets:updating", "Aggiornamento...")}
        onConfirm={async () => {
          if (!bulkConfirmStatus) return;
          await applyKanbanBulkPatch(
            { status: bulkConfirmStatus },
            bulkConfirmStatus === "completed"
              ? t("bulk.completeAction", "completamento bulk")
              : t("bulk.changeStatusTo", "cambio stato a {{status}}", { status: t("tickets:status." + bulkConfirmStatus, STATUS_META[bulkConfirmStatus].label) }),
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

