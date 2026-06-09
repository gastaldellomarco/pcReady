import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  GitBranch,
  History,
  Link as LinkIcon,
  ListChecks,
  Paperclip,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BundleUsageBar } from "@/components/bundles/BundleBadges";
import { TicketAttachments } from "@/components/tickets/TicketAttachments";
import { TicketDeviceCheckout } from "@/components/tickets/TicketDeviceCheckout";
import { TicketNotes } from "@/components/tickets/TicketNotes";
import { TicketRelations } from "@/components/tickets/TicketRelations";
import { TicketTimeTracking } from "@/components/tickets/TicketTimeTracking";
import { DestructiveConfirmDialog } from "@/components/ui/destructive-confirm-dialog";
import { useTicketDetail } from "@/hooks/use-detail";
import { useTickets } from "@/hooks/use-tickets";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { fetchTicketBundleInfo, formatBundleHours, formatBundleMoney } from "@/lib/bundles";
import { openDeviceDetail } from "@/lib/detail-navigation";
import { sendChecklistCompletedEmail } from "@/lib/email-events";
import { parseCostNumber, formatMoney, formatRelativeTime } from "@/lib/format";
import { createNotification } from "@/lib/notifications";
import {
  type ChecklistState,
  STATUS_META,
  PRIORITY_LABEL,
  type TicketStatus,
  fmtDate,
  fmtDateTime,
  type ChecklistItemDef,
  type ChecklistStructure,
  DEFAULT_STRUCTURE,
  structureProgress,
  structureOverallProgress,
  computeSlaStatus,
  formatSlaCountdown,
} from "@/lib/pcready";
import { insertActivity } from "@/lib/queries/activity";
import {
  useChecklistTemplates,
  useTicketChecklistInstances,
  useCreateTicketChecklistInstance,
  useUpsertTicketChecklistResponse,
  useCompleteTicketChecklistInstance,
  type TicketChecklistInstanceRow,
} from "@/lib/queries/checklist";
import { QUERY_KEYS } from "@/lib/queries/keys";
import {
  loadDeviceOptions,
  useTicketQuery,
  useTicketAssignmentsQuery,
  useTicketHistoryQuery,
  useTicketStatusHistoryQuery,
  useUpdateTicket,
  useDeleteTicket,
  addTicketStatusHistory,
  type TicketDetailRow,
  type TicketDeviceAssignmentRow,
  type TicketMaterialItem,
  type TicketMaterialDraft,
  type DetailTab,
  type TicketTimelineItem,
} from "@/lib/queries/tickets";
import { formatDuration, useTicketTimeSummary } from "@/lib/queries/ticketTimeEntries";
import { listTechnicians, type TechnicianOption } from "@/lib/technicians";
import { parseChecklistStructure } from "@/types/checklist-structure";
import { Modal } from "./Modal";
import { AssigneeChip, PriorityLabel, StatusBadge, TicketTypeBadge } from "./StatusBadge";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";

type TimelineItem = TicketTimelineItem;

const DETAIL_TABS: { key: DetailTab; labelKey: string; icon: typeof ListChecks }[] = [
  { key: "detail", labelKey: "detail.tabs.detail", icon: ListChecks },
  { key: "checklists", labelKey: "detail.tabs.checklists", icon: CheckCircle2 },
  { key: "notes", labelKey: "detail.tabs.notes", icon: GitBranch },
  { key: "history", labelKey: "detail.tabs.history", icon: History },
  { key: "attachments", labelKey: "detail.tabs.attachments", icon: Paperclip },
];

const emptyMaterialDraft: TicketMaterialDraft = {
  description: "",
  supplier: "",
  sku: "",
  quantity: "1",
  unitCost: "0",
  resaleMarginPercent: "30",
};

/**
 *
 */
export function TicketDetailModal() {
  const { t } = useTranslation("tickets");
  const {
    id,
    close,
    prevId,
    nextId,
    index,
    total,
    navigatePrev: navPrev,
    navigateNext: navNext,
  } = useTicketDetail();
  const { canEdit, user, session, hasPermission } = useAuth();
  const notify = useServerFn(createNotification);
  const sendChecklistEmail = useServerFn(sendChecklistCompletedEmail);
  const loadTechnicians = useServerFn(listTechnicians);
  useTickets();

  const [assignments, setAssignments] = useState<TicketDeviceAssignmentRow[]>([]);
  const [mainTab, setMainTab] = useState<DetailTab>("detail");
  const [checklistTab, setChecklistTab] = useState<string>("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceOptions, setDeviceOptions] = useState<any[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [checklistTemplateToAttach, setChecklistTemplateToAttach] = useState("");
  const [costDraft, setCostDraft] = useState({
    billable_hours: "0",
    hourly_rate: "0",
    material_cost: "0",
    cost_notes: "",
  });
  const [materialDraft, setMaterialDraft] = useState<TicketMaterialDraft>(emptyMaterialDraft);
  const [materialBusy, setMaterialBusy] = useState(false);

  const ticketQuery = useTicketQuery(id);
  const assignmentsQuery = useTicketAssignmentsQuery(id);
  const deviceHistoryQuery = useTicketHistoryQuery(id);
  const statusHistoryQuery = useTicketStatusHistoryQuery(id);
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const qc = useQueryClient();
  const timeSummaryQuery = useTicketTimeSummary(id, user?.id);
  const { data: materialItemsData, isLoading: materialItemsLoading } = useQuery({
    queryKey: ["tickets", id, "material-items"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ticket_material_items")
        .select(
          "id, description, supplier, sku, quantity, unit_cost, resale_margin_percent, unit_price, total_cost, total_price, created_at",
        )
        .eq("ticket_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TicketMaterialItem[];
    },
    enabled: !!id,
  });
  const { data: bundleInfoData } = useQuery({
    queryKey: ["ticket", id, "bundle-info"],
    queryFn: () => fetchTicketBundleInfo(id as string),
    enabled: !!id,
  });
  const checklistTemplatesQuery = useChecklistTemplates();
  const checklistInstancesQuery = useTicketChecklistInstances(id);
  const createChecklistInstance = useCreateTicketChecklistInstance();
  const upsertChecklistResponse = useUpsertTicketChecklistResponse(id || "");
  const completeChecklistInstance = useCompleteTicketChecklistInstance(id || "");
  const materialItems = materialItemsData ?? [];
  const materialItemsCost = materialItems.reduce(
    (sum, item) => sum + parseCostNumber(item.total_cost),
    0,
  );
  const materialItemsRevenue = materialItems.reduce(
    (sum, item) => sum + parseCostNumber(item.total_price),
    0,
  );
  const materialQuantity = parseCostNumber(materialDraft.quantity) || 1;
  const materialUnitCost = parseCostNumber(materialDraft.unitCost);
  const materialMargin = parseCostNumber(materialDraft.resaleMarginPercent);
  const materialPreviewUnitPrice = materialUnitCost * (1 + materialMargin / 100);
  const materialPreviewTotalPrice = materialPreviewUnitPrice * materialQuantity;

  useEffect(() => {
    if (assignmentsQuery.data) setAssignments(assignmentsQuery.data as TicketDeviceAssignmentRow[]);
  }, [assignmentsQuery.data]);

  useEffect(() => {
    setMaterialDraft(emptyMaterialDraft);
  }, [id]);

  useEffect(() => {
    const ticket = ticketQuery.data as TicketDetailRow | null | undefined;
    if (ticket) {
      setTitleDraft(ticket.model || ticket.device?.model || ticket.ticket_code);
      setCostDraft({
        billable_hours: String(ticket.billable_hours ?? 0),
        hourly_rate: String(ticket.hourly_rate ?? 0),
        material_cost: String(ticket.material_cost ?? 0),
        cost_notes: ticket.cost_notes ?? "",
      });
    }
  }, [ticketQuery.data]);

  useEffect(() => {
    if (!session?.access_token) return;
    loadTechnicians({ data: { accessToken: session.access_token } })
      .then(setTechnicians)
      .catch((err) => {
        console.error("Failed to load technicians", err);
        toast.error(t("detail.toasts.techniciansLoadError", "Errore caricamento tecnici"));
        setTechnicians([]);
      });
  }, [session?.access_token, loadTechnicians]);

  useEffect(() => {
    const ticket = ticketQuery.data as TicketDetailRow | null | undefined;
    if (!ticket?.client_id || !deviceSearch.trim()) {
      setDeviceOptions([]);
      return;
    }
    let cancelled = false;
    setDeviceLoading(true);
    loadDeviceOptions(deviceSearch, ticket.client_id)
      .then((rows) => {
        if (!cancelled) setDeviceOptions(rows.filter((device) => device.id !== ticket.device_id));
      })
      .catch((err) => {
        console.error("Failed to load device options", err);
        if (!cancelled) setDeviceOptions([]);
      })
      .finally(() => {
        if (!cancelled) setDeviceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceSearch, ticketQuery.data]);

  // Keyboard navigation: ArrowLeft / ArrowRight when modal is open
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't navigate when user is typing in an input
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((event.target as HTMLElement)?.isContentEditable) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navPrev();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navNext();
      }
    },
    [navPrev, navNext],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!id || ticketQuery.isLoading || !ticketQuery.data) return null;
  const ticket = ticketQuery.data as TicketDetailRow;
  const struct: ChecklistStructure =
    ticket.checklist_structure && Object.keys(ticket.checklist_structure).length
      ? parseChecklistStructure(ticket.checklist_structure)
      : DEFAULT_STRUCTURE;
  const tabKeys = Object.keys(struct);
  const currentChecklistTab = checklistTab && struct[checklistTab] ? checklistTab : tabKeys[0];
  const asset = assetInfo(ticket);
  const meta = STATUS_META[ticket.status];
  const overallProgress = structureOverallProgress(ticket.checklist || {}, struct);
  const openedAgo = formatRelativeTime(ticket.created_at);
  const sla = computeSlaStatus(
    ticket.created_at,
    ticket.priority,
    undefined,
    ticket.due_date || ticket.sla_deadline,
    ticket.sla_breached,
  );
  const statusHistory = (statusHistoryQuery.data ?? []) as any[];
  const deviceHistory = (deviceHistoryQuery.data ?? []) as any[];
  const timeline = buildTimeline(statusHistory, deviceHistory, assignments);
  const totalWorked = formatDuration(timeSummaryQuery.data?.totalMinutes ?? 0);

  async function update(patch: Partial<TicketDetailRow> & { checklist?: ChecklistState }) {
    const dbPatch: TablesUpdate<"tickets"> = {
      ...patch,
      checklist: patch.checklist as unknown as Json | undefined,
    } as any;
    try {
      await updateTicket.mutateAsync({ id: ticket.id, patch: dbPatch });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("detail.toasts.updateError", "Errore aggiornamento");
      toast.error(message);
      throw err;
    }
  }

  async function saveCosts() {
    if (!canEdit) return;
    const patch = {
      billable_hours: parseCostNumber(costDraft.billable_hours),
      hourly_rate: parseCostNumber(costDraft.hourly_rate),
      material_cost: parseCostNumber(costDraft.material_cost),
      cost_notes: costDraft.cost_notes.trim() || null,
    };
    await update(patch as any);
    toast.success(t("detail.toasts.costsSaved", "Costi ticket aggiornati"));
  }

  function useTrackedHoursAsBillable() {
    const hours = ((timeSummaryQuery.data?.totalMinutes ?? 0) / 60).toFixed(2);
    setCostDraft((current) => ({ ...current, billable_hours: hours }));
  }

  async function saveMaterialItem() {
    if (!canEdit) return;
    if (!materialDraft.description.trim())
      return toast.error(t("detail.toasts.materialDescRequired", "Inserisci una descrizione"));
    const quantity = parseCostNumber(materialDraft.quantity);
    const unitCost = parseCostNumber(materialDraft.unitCost);
    const margin = parseCostNumber(materialDraft.resaleMarginPercent);
    if (quantity <= 0)
      return toast.error(t("detail.toasts.materialQtyInvalid", "La quantità deve essere > 0"));
    const totalCost = unitCost * quantity;
    setMaterialBusy(true);
    try {
      const { error } = await (supabase as any).from("ticket_material_items").insert({
        ticket_id: ticket.id,
        description: materialDraft.description.trim(),
        supplier: materialDraft.supplier.trim() || null,
        sku: materialDraft.sku.trim() || null,
        quantity,
        unit_cost: unitCost,
        resale_margin_percent: margin,
      });
      if (error) throw error;
      setMaterialDraft(emptyMaterialDraft);
      qc.invalidateQueries({ queryKey: ["tickets", ticket.id, "material-items"] });
      const newTotal = materialItemsCost + totalCost;
      void update({ material_cost: newTotal } as any);
      toast.success(t("detail.toasts.materialAdded", "Materiale aggiunto"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("detail.toasts.materialAddError", "Errore salvataggio materiale");
      toast.error(message);
    } finally {
      setMaterialBusy(false);
    }
  }

  async function deleteMaterialItem(itemId: string) {
    if (!canEdit) return;
    if (!window.confirm(t("detail.section.materialDeleteConfirm", "Eliminare questo materiale?"))) return;
    const item = materialItems.find((i) => i.id === itemId);
    setMaterialBusy(true);
    try {
      const { error } = await (supabase as any).from("ticket_material_items").delete().eq("id", itemId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["tickets", ticket.id, "material-items"] });
      if (item) {
        const newTotal = Math.max(0, materialItemsCost - parseCostNumber(item.total_cost));
        void update({ material_cost: newTotal } as any);
      }
      toast.success(t("detail.toasts.materialDeleted", "Materiale eliminato"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("detail.toasts.materialDeleteError", "Errore eliminazione materiale");
      toast.error(message);
    } finally {
      setMaterialBusy(false);
    }
  }

  async function saveTitle() {
    if (!canEdit) return;
    const nextTitle = titleDraft.trim();
    if (!nextTitle)
      return toast.error(t("detail.toasts.titleEmpty", "Il titolo non può essere vuoto"));
    await update({ model: nextTitle } as any);
    setEditingTitle(false);
    toast.success(t("detail.toasts.titleSaved", "Titolo aggiornato"));
  }

  async function toggleItem(itemId: string) {
    if (!canEdit)
      return toast.error(t("detail.toasts.insufficientPermissions", "Permessi insufficienti"));
    const cur = { ...(ticket.checklist || {}) } as ChecklistState;
    cur[currentChecklistTab] = {
      ...(cur[currentChecklistTab] || {}),
      [itemId]: !cur[currentChecklistTab]?.[itemId],
    };
    await update({ checklist: cur });
    const prog = structureProgress(cur, struct, currentChecklistTab);
    if (prog.pct === 100) {
      if (ticket.assignee_id && session?.access_token) {
        await notify({
          data: {
            accessToken: session.access_token,
            notification: {
              userId: ticket.assignee_id,
              type: "checklist_completed",
              title: `${ticket.ticket_code}: checklist completata`,
              body: struct[currentChecklistTab]?.label || "Sezione checklist completata",
              payload: { ticket_id: ticket.id, checklist_key: currentChecklistTab },
              link: "/tickets",
            },
          },
        });
      }
      void sendChecklistEmail({
        data: {
          ticketId: ticket.id,
          checklistName: struct[currentChecklistTab]?.label || "Checklist completata",
        },
      }).catch((err) => {
        console.error("Failed to send checklist completed email:", err);
        toast.error(t("detail.toasts.checklistEmailError", "Errore invio email checklist"));
      });
      if (currentChecklistTab === "os" && ticket.status === "pending")
        await advance("in-progress", true);
      if (currentChecklistTab === "software" && ticket.status === "in-progress")
        await advance("testing", true);
    }
  }

  async function advance(next: TicketStatus, auto = false) {
    if (!canEdit)
      return toast.error(t("detail.toasts.insufficientPermissions", "Permessi insufficienti"));
    const previousStatus = ticket.status;
    await update({ status: next });
    try {
      await addTicketStatusHistory(ticket.id, {
        from_status: previousStatus,
        to_status: next,
        changed_by: user!.id,
        changed_at: new Date().toISOString(),
        note: auto
          ? t("detail.toasts.autoAdvancement", "Avanzamento automatico via checklist")
          : null,
      });
      await insertActivity({
        type: auto ? "auto" : "user",
        message: `${ticket.ticket_code}: ${t("detail.statusChange", "Cambio stato")} -> "${STATUS_META[next].label}"${auto ? ` ${t("detail.toasts.autoAdvancement", "automaticamente")}` : ""}`,
        ticket_id: ticket.id,
        actor_id: user!.id,
      });
      qc.invalidateQueries({ queryKey: [...QUERY_KEYS.ticket(ticket.id), "status-history"] });
    } catch (err) {
      console.error("Failed to write status history/activity log", err);
      toast.error(t("detail.toasts.statusHistoryError", "Errore salvataggio storico"));
    }
    if (ticket.assignee_id && session?.access_token) {
      await notify({
        data: {
          accessToken: session.access_token,
          notification: {
            userId: ticket.assignee_id,
            type: "ticket_status_changed",
            title: `${ticket.ticket_code}: ${STATUS_META[next].label}`,
            body: auto
              ? t("detail.toasts.autoAdvancement", "Stato avanzato automaticamente")
              : t("detail.toasts.manualUpdate", "Stato aggiornato manualmente"),
            payload: { ticket_id: ticket.id, status: next },
            link: "/tickets",
          },
        },
      });
    }
    toast.success(
      t("detail.toasts.statusUpdated", {
        label: STATUS_META[next].label,
        defaultValue: "Stato aggiornato: {{label}}",
      }),
    );

    if (next === "completed" && session?.access_token) {
      const { completeTicketServer } = await import("@/lib/ticket-completion");
      void completeTicketServer({
        data: {
          ticketId: ticket.id,
          changedBy: user!.id,
          accessToken: session.access_token,
          template: "customer",
        },
      }).catch((err) => {
        console.error("Failed to complete ticket:", err);
        toast.error(
          t("detail.toasts.completeEmailError", "Ticket completato, ma errore invio email/verbale"),
        );
      });
    }
  }

  async function changeAssignee(nextAssigneeId: string) {
    await update({ assignee_id: nextAssigneeId || null } as any);
    toast.success(
      nextAssigneeId
        ? t("detail.toasts.techReassigned", "Tecnico riassegnato")
        : t("detail.toasts.assignmentRemoved", "Assegnazione rimossa"),
    );
  }

  async function exportCompletionPdf(template: "customer" | "technical") {
    if (!session?.access_token || !user)
      return toast.error(t("detail.toasts.sessionNotAvailable", "Sessione non disponibile"));
    try {
      const { completeTicketServer } = await import("@/lib/ticket-completion");
      const result = await completeTicketServer({
        data: {
          ticketId: ticket.id,
          changedBy: user.id,
          accessToken: session.access_token,
          template,
          notifyClient: false,
        },
      });
      if (!result.success || !result.pdfUrl)
        throw new Error(
          result.error || t("detail.toasts.pdfExportError", "Export PDF non riuscito"),
        );
      window.open(result.pdfUrl, "_blank", "noopener,noreferrer");
      toast.success(
        template === "customer"
          ? t("detail.toasts.customerReportGenerated", "Verbale cliente generato")
          : t("detail.toasts.technicalReportGenerated", "Report tecnico generato"),
      );
    } catch (err) {
      console.error("Failed to export completion PDF:", err);
      toast.error(
        err instanceof Error ? err.message : t("detail.toasts.pdfExportError", "Errore export PDF"),
      );
    }
  }

  async function changeDevice(nextDeviceId: string | null) {
    if (!canEdit)
      return toast.error(t("detail.toasts.insufficientPermissions", "Permessi insufficienti"));
    await update({ device_id: nextDeviceId } as any);
    setDeviceSearch("");
    toast.success(
      nextDeviceId
        ? t("detail.toasts.deviceConnected", "Dispositivo collegato")
        : t("detail.toasts.deviceDisconnected", "Dispositivo scollegato"),
    );
  }

  async function attachChecklistTemplate() {
    if (!canEdit || !user)
      return toast.error(t("detail.toasts.insufficientPermissions", "Permessi insufficienti"));
    if (!checklistTemplateToAttach)
      return toast.error(t("detail.toasts.selectTemplate", "Seleziona un template checklist"));
    const template = (checklistTemplatesQuery.data ?? []).find(
      (item: any) => item.id === checklistTemplateToAttach,
    );
    try {
      const instance = await createChecklistInstance.mutateAsync({
        ticketId: ticket.id,
        templateId: checklistTemplateToAttach,
        assignedTo: ticket.assignee_id,
      });
      await insertActivity({
        type: "user",
        message: `${ticket.ticket_code}: checklist "${instance.title}" collegata`,
        ticket_id: ticket.id,
        actor_id: user.id,
      });
      const sectionAssignees = new Map<string, string[]>();
      Object.values(template?.structure || instance.structure || {}).forEach((section: any) => {
        const assignedTo = section.assigned_to || instance.section_assignments?.[section.key];
        if (assignedTo) {
          const labels = sectionAssignees.get(assignedTo) ?? [];
          labels.push(`${instance.title}: ${section.label}`);
          sectionAssignees.set(assignedTo, labels);
        }
      });
      if (session?.access_token) {
        await Promise.all(
          Array.from(sectionAssignees.entries()).map(([userId, labels]) =>
            notify({
              data: {
                accessToken: session.access_token,
                notification: {
                  userId,
                  type: "checklist_section_assigned",
                  title: `${ticket.ticket_code}: sezioni checklist assegnate`,
                  body: labels.join(", "),
                  payload: { ticket_id: ticket.id, checklist_instance_id: instance.id },
                  link: "/tickets",
                },
              },
            }),
          ),
        );
      }
      setChecklistTemplateToAttach("");
      toast.success(t("detail.toasts.checklistLinked", "Checklist collegata al ticket"));
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("detail.toasts.checklistLinkError", "Errore collegamento checklist");
      toast.error(message);
    }
  }

  async function saveChecklistResponse(
    instance: TicketChecklistInstanceRow,
    sectionKey: string,
    itemId: string,
    value: string | null,
  ) {
    if (!canEdit || !user)
      return toast.error(t("detail.toasts.insufficientPermissions", "Permessi insufficienti"));
    if (instance.status === "completed")
      return toast.error(t("detail.toasts.checklistAlreadyCompleted", "Checklist già completata"));
    const assignedTo =
      instance.section_assignments?.[sectionKey] ||
      (instance.structure as any)[sectionKey]?.assigned_to;
    if (assignedTo && assignedTo !== user.id && !hasPermission("can_manage_checklist_templates")) {
      return toast.error(
        t(
          "detail.toasts.checklistSectionAssigned",
          "Questa sezione è assegnata a un altro tecnico",
        ),
      );
    }
    try {
      await upsertChecklistResponse.mutateAsync({
        instanceId: instance.id,
        itemKey: `${sectionKey}:${itemId}`,
        value,
        compiledBy: user.id,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("detail.toasts.responseSaveError", "Errore salvataggio risposta");
      toast.error(message);
    }
  }

  async function completeChecklist(instance: TicketChecklistInstanceRow) {
    if (!canEdit || !user)
      return toast.error(t("detail.toasts.insufficientPermissions", "Permessi insufficienti"));
    const progress = computeInstanceProgress(instance);
    if (progress.requiredMissing > 0) {
      return toast.error(
        t("detail.toasts.filledRequired", {
          count: progress.requiredMissing,
          defaultValue: "Compila prima {{count}} elementi obbligatori",
        }),
      );
    }
    if (
      !window.confirm(
        t(
          "detail.section.confirmChecklist",
          "Confermo di aver verificato tutti gli elementi della checklist.",
        ),
      )
    )
      return;
    const signatureName =
      window.prompt(
        t("detail.section.optionalSignature", "Firma opzionale: nome da mostrare nel report PDF"),
        "",
      ) || null;
    try {
      const completed = await completeChecklistInstance.mutateAsync({
        instanceId: instance.id,
        completedBy: user.id,
        signatureName,
      });
      await insertActivity({
        type: "user",
        message: `${ticket.ticket_code}: ${t("detail.section.completed", "completata")} "${completed.title}"`,
        ticket_id: ticket.id,
        actor_id: user.id,
        entity_type: "ticket_checklist_instance",
        entity_id: completed.id,
      });
      if (ticket.assignee_id && session?.access_token) {
        await notify({
          data: {
            accessToken: session.access_token,
            notification: {
              userId: ticket.assignee_id,
              type: "checklist_completed",
              title: `${ticket.ticket_code}: ${t("detail.section.completed", "checklist completata")}`,
              body: completed.title,
              payload: { ticket_id: ticket.id, checklist_instance_id: completed.id },
              link: "/tickets",
            },
          },
        });
      }
      void sendChecklistEmail({
        data: { ticketId: ticket.id, checklistName: completed.title },
      }).catch((err) => {
        console.error("Failed to send checklist completed email:", err);
        toast.error(t("detail.toasts.checklistEmailError", "Errore invio email checklist"));
      });
      qc.invalidateQueries({ queryKey: [...QUERY_KEYS.ticket(ticket.id), "status-history"] });
      toast.success(t("detail.toasts.checklistCompleted", "Checklist completata"));
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("detail.toasts.checklistCompleteError", "Errore completamento checklist");
      toast.error(message);
    }
  }

  async function duplicateTicket() {
    try {
      const payload = {
        client: ticket.client,
        client_id: ticket.client_id,
        requester: ticket.requester,
        ticket_type: ticket.ticket_type,
        priority: ticket.priority,
        status: "pending",
        assignee_id: ticket.assignee_id,
        software: ticket.software,
        notes: ticket.notes,
        checklist: {},
        checklist_structure: ticket.checklist_structure as any,
        device_id: ticket.device_id,
        model: ticket.model,
      };
      const { data, error } = await (supabase as any)
        .from("tickets")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      toast.success(t("detail.toasts.ticketDuplicated", "Ticket duplicato"));
      qc.invalidateQueries({ queryKey: QUERY_KEYS.tickets });
      if (data?.id) close();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("detail.toasts.duplicateError", "Errore duplicazione ticket");
      toast.error(message);
    }
  }

  async function del() {
    try {
      await deleteTicket.mutateAsync(ticket.id);
      toast.success(t("detail.toasts.ticketDeleted", "Ticket eliminato"));
      close();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("detail.toasts.deleteError", "Errore cancellazione");
      toast.error(message);
    }
  }

  return (
    <Modal
      open={true}
      onClose={close}
      size="xl"
      title={`${ticket.ticket_code} - ${titleDraft || asset.model}`}
      footer={
        <>
          {canEdit && (
            <button
              className="pc-btn pc-btn-danger pc-btn-sm mr-auto"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-3" /> {t("detail.btn.delete", "Elimina")}
            </button>
          )}
          <button className="pc-btn pc-btn-ghost" onClick={close}>
            {t("detail.btn.close", "Chiudi")}
          </button>
          {canEdit && meta.next && (
            <button className="pc-btn pc-btn-primary" onClick={() => advance(meta.next!)}>
              {t("detail.btn.advanceTo", {
                label: STATUS_META[meta.next].label,
                defaultValue: "Avanzo -> {{label}}",
              })}
            </button>
          )}
        </>
      }
    >
      <div
        className="sticky top-0 z-10 -mx-[22px] -mt-[20px] mb-4 border-b bg-surface px-[22px] py-4"
        style={{ borderColor: "var(--border)" }}
      >
        {total > 1 && (
          <div className="mb-2 flex items-center gap-1">
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              disabled={!prevId}
              onClick={navPrev}
              title={t("detail.nav.prev", "Ticket precedente")}
            >
              <ArrowLeft className="size-3.5" />
            </button>
            <span className="mx-1 text-[11px] font-mono font-semibold text-text2 tabular-nums">
              {index}/{total}
            </span>
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              disabled={!nextId}
              onClick={navNext}
              title={t("detail.nav.next", "Ticket successivo")}
            >
              <ArrowRight className="size-3.5" />
            </button>
            <span className="ml-1 text-[10px] text-text3">
              {t("detail.nav.useArrows", "Usa ← → da tastiera")}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] font-bold text-accent">
                {ticket.ticket_code}
              </span>
              <span className="text-[11px] text-text3">
                {t("detail.subtitle.openedAgo", { time: openedAgo })}
              </span>
              <span className="text-[11px] text-text3">
                {t("detail.subtitle.workedHours", { hours: totalWorked })}
              </span>
            </div>
            {editingTitle ? (
              <div className="flex gap-2">
                <input
                  className="pc-input w-full text-[18px] font-bold"
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && void saveTitle()}
                />
                <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={saveTitle}>
                  {t("detail.btn.saveTitle", "Salva")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="block max-w-full truncate text-left text-[20px] font-bold hover:text-accent"
                onClick={() => canEdit && setEditingTitle(true)}
              >
                {titleDraft || asset.model}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canEdit ? (
              <select
                className="pc-input h-8 min-w-[120px] w-auto px-3 py-0 text-[12px] leading-none"
                value={ticket.status}
                onChange={(event) => advance(event.target.value as TicketStatus)}
                aria-label={t("detail.statusLabel", "Stato ticket")}
              >
                {Object.entries(STATUS_META).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            ) : (
              <StatusBadge status={ticket.status} />
            )}
            <PriorityLabel p={ticket.priority} />
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => advance("completed")}
              disabled={!canEdit || ticket.status === "completed"}
            >
              <CheckCircle2 className="size-3" /> {t("detail.btn.closeTicket", "Chiudi ticket")}
            </button>
            <select
              className="pc-input h-8 min-w-[150px] w-auto px-3 py-0 text-[12px] leading-none"
              value={ticket.assignee_id ?? ""}
              disabled={!canEdit}
              onChange={(event) => changeAssignee(event.target.value)}
              aria-label={t("detail.assigneeLabel", "Assegna tecnico")}
            >
              <option value="">{t("detail.btn.reassign", "Riassegna...")}</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.full_name}
                </option>
              ))}
            </select>
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={duplicateTicket}
              disabled={!canEdit}
            >
              <Copy className="size-3" /> {t("detail.btn.duplicate", "Duplica")}
            </button>
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => exportCompletionPdf("customer")}
            >
              <Printer className="size-3" /> {t("detail.btn.customerPdf", "PDF cliente")}
            </button>
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => exportCompletionPdf("technical")}
            >
              <Printer className="size-3" /> {t("detail.btn.technicalPdf", "PDF tecnico")}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Metric
          label={t("detail.metrics.status", "Stato")}
          value={<StatusBadge status={ticket.status} />}
        />
        <Metric
          label={t("detail.metrics.priority", "Priorità")}
          value={PRIORITY_LABEL[ticket.priority]}
        />
        <Metric
          label={t("detail.metrics.checklist", "Checklist")}
          value={`${overallProgress.done}/${overallProgress.total}`}
          hint={`${overallProgress.pct}%`}
        />
        <Metric
          label={t("detail.metrics.sla", "SLA")}
          value={
            sla.status === "overdue"
              ? t("detail.sla.violated", "Violato")
              : sla.status === "warning"
                ? t("detail.sla.expiring", "In scadenza")
                : t("detail.sla.ok", "OK")
          }
          hint={formatSlaCountdown(sla.deadline)}
        />
      </div>

      <div className="mb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap gap-1">
          {DETAIL_TABS.map(({ key, labelKey, icon: Icon }) => {
            const active = mainTab === key;
            return (
              <button
                key={key}
                onClick={() => setMainTab(key)}
                className="flex items-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold transition-colors -mb-px border-b-2"
                style={{
                  color: active ? "var(--accent)" : "var(--text3)",
                  borderColor: active ? "var(--accent)" : "transparent",
                }}
              >
                <Icon className="size-3.5" /> {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {mainTab === "detail" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1.4fr_.9fr]">
            <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="mb-3 text-[13px] font-bold">
                {t("detail.section.ticketInfo", "Informazioni ticket")}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Info
                  label={t("detail.section.description", "Descrizione")}
                  value={<span className="whitespace-pre-line">{ticket.notes || "-"}</span>}
                />
                <Info
                  label={t("detail.section.type", "Tipo")}
                  value={<TicketTypeBadge type={ticket.ticket_type} />}
                />
                <Info label={t("detail.section.client", "Cliente")} value={ticket.client} />
                <Info
                  label={t("detail.section.requester", "Richiedente")}
                  value={ticket.requester}
                />
                <Info
                  label={t("detail.section.openDate", "Data apertura")}
                  value={fmtDate(ticket.created_at)}
                />
                <Info
                  label={t("detail.section.firstResponse", "Prima risposta")}
                  value={fmtDateTime(ticket.sla_response_at)}
                />
                <Info
                  label={t("detail.section.software", "Software")}
                  value={<span className="text-xs">{ticket.software || "-"}</span>}
                />
              </div>
            </section>
            <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <h3 className="mb-3 text-[13px] font-bold">
                {t("detail.section.technicianActions", "Tecnico e azioni")}
              </h3>
              <div className="mb-3 rounded-lg p-3" style={{ background: "var(--surface2)" }}>
                <AssigneeChip
                  initials={ticket.assignee?.initials}
                  name={ticket.assignee?.full_name}
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="pc-btn pc-btn-primary pc-btn-sm"
                  onClick={() => setMainTab("notes")}
                >
                  <GitBranch className="size-3" /> {t("detail.section.addNote", "Aggiungi nota")}
                </button>
                <button
                  className="pc-btn pc-btn-ghost pc-btn-sm"
                  onClick={() => setMainTab("attachments")}
                >
                  <Paperclip className="size-3" />{" "}
                  {t("detail.section.uploadAttachment", "Carica allegato")}
                </button>
                <button
                  className="pc-btn pc-btn-ghost pc-btn-sm"
                  onClick={() => setMainTab("history")}
                >
                  <History className="size-3" /> {t("detail.section.viewHistory", "Vedi storico")}
                </button>
              </div>
            </section>
          </div>

          <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-bold">
                {t("detail.section.connectedDevices", "Dispositivi collegati")}
              </h3>
              <span className="text-[11px] text-text3">
                {ticket.device_id
                  ? t("detail.device.activeCount", "1 dispositivo attivo")
                  : t("detail.device.noDevice", "Nessun dispositivo")}
              </span>
            </div>
            {ticket.device_id && (
              <div
                className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-2.5"
                style={{ borderColor: "var(--border)" }}
              >
                <button
                  className="font-semibold text-accent hover:underline"
                  onClick={() => ticket.device_id && openDeviceDetail(ticket.device_id)}
                >
                  {asset.model}
                </button>
                <span className="font-mono text-[11px] text-text3">{asset.serial}</span>
                <span className="text-[11px] text-text3">{asset.os}</span>
                {canEdit && (
                  <button
                    className="pc-btn pc-btn-ghost pc-btn-sm ml-auto"
                    onClick={() => changeDevice(null)}
                  >
                    <X className="size-3" /> {t("detail.btn.unlink", "Scollega")}
                  </button>
                )}
              </div>
            )}
            {canEdit && (
              <div className="relative">
                <input
                  className="pc-input w-full"
                  value={deviceSearch}
                  onChange={(event) => setDeviceSearch(event.target.value)}
                  placeholder={t(
                    "detail.section.searchDevice",
                    "Collega dispositivo: cerca per nome, seriale o assegnatario...",
                  )}
                />
                {deviceSearch && (
                  <div
                    className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-background shadow-lg"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {deviceLoading && (
                      <div className="p-3 text-[12px] text-text3">
                        {t("detail.section.searching", "Ricerca...")}
                      </div>
                    )}
                    {!deviceLoading && deviceOptions.length === 0 && (
                      <div className="p-3 text-[12px] text-text3">
                        {t("detail.section.noDeviceFound", "Nessun dispositivo trovato")}
                      </div>
                    )}
                    {deviceOptions.map((device) => (
                      <button
                        key={device.id}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] hover:bg-surface2"
                        onClick={() => changeDevice(device.id)}
                      >
                        <span>
                          <span className="font-semibold">{device.model}</span>{" "}
                          <span className="font-mono text-text3">{device.serial || "-"}</span>
                        </span>
                        <LinkIcon className="size-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {ticket.device_id && (
            <TicketDeviceCheckout
              ticketId={ticket.id}
              deviceId={ticket.device_id}
              canEdit={canEdit}
              technicianId={user?.id ?? ""}
            />
          )}

          <TicketRelations ticketId={ticket.id} />

          <TicketTimeTracking ticketId={ticket.id} />

          <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold">
                  {t("detail.section.costsBilling", "Costi e fatturazione")}
                </h3>
                <p className="text-[11px] text-text3">
                  {formatMoney(ticket.labor_cost)} · {formatMoney(ticket.material_cost)} ·{" "}
                  {formatMoney(ticket.total_cost)}
                </p>
              </div>
              {canEdit && (
                <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={saveCosts}>
                  {t("detail.btn.saveCosts", "Salva costi")}
                </button>
              )}
            </div>
            {bundleInfoData?.assignment?.bundle && (
              <div
                className="mb-3 rounded-lg border bg-surface2/40 p-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-bold text-text2">
                      {t("detail.section.bundleActive", {
                        name: bundleInfoData.assignment.bundle.name,
                        defaultValue: "Bundle attivo: {{name}}",
                      })}
                    </div>
                    <div className="text-[11px] text-text3">
                      {t("detail.section.bundleSla", {
                        response: bundleInfoData.assignment.bundle.sla_response_hours,
                        resolution: bundleInfoData.assignment.bundle.sla_resolution_hours,
                        cost: formatBundleMoney(Number(ticket.bundle_extra_amount ?? 0)),
                        defaultValue:
                          "SLA risposta {{response}}h · risoluzione {{resolution}}h · extra ticket {{cost}}",
                      })}
                    </div>
                  </div>
                  <span className="rounded-full bg-accent/10 px-2 py-1 text-[11px] font-bold text-accent">
                    {t("detail.section.extraHours", {
                      hours: formatBundleHours(ticket.bundle_extra_hours ?? 0),
                      defaultValue: "{{hours}} extra",
                    })}
                  </span>
                </div>
                <BundleUsageBar
                  used={bundleInfoData.usageSummary?.used_hours}
                  total={
                    bundleInfoData.usageSummary?.effective_included_hours ??
                    bundleInfoData.assignment.custom_included_hours ??
                    bundleInfoData.assignment.bundle.included_hours
                  }
                  label={t("detail.section.hourlyConsumption", "Consumo ore bundle cliente")}
                />
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-[12px] font-semibold text-text2">
                {t("detail.section.billableHours", "Ore fatturabili")}
                <input
                  className="pc-input mt-1"
                  type="number"
                  min="0"
                  step="0.25"
                  disabled={!canEdit}
                  value={costDraft.billable_hours}
                  onChange={(event) =>
                    setCostDraft((current) => ({ ...current, billable_hours: event.target.value }))
                  }
                />
              </label>
              <label className="text-[12px] font-semibold text-text2">
                {t("detail.section.hourlyRate", "Tariffa oraria")}
                <input
                  className="pc-input mt-1"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!canEdit}
                  value={costDraft.hourly_rate}
                  onChange={(event) =>
                    setCostDraft((current) => ({ ...current, hourly_rate: event.target.value }))
                  }
                />
              </label>
              <label className="text-[12px] font-semibold text-text2">
                {t("detail.section.materials", "Materiali / ricambi")}
                <input
                  className="pc-input mt-1"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!canEdit}
                  value={costDraft.material_cost}
                  onChange={(event) =>
                    setCostDraft((current) => ({ ...current, material_cost: event.target.value }))
                  }
                />
              </label>
              <div className="rounded-lg bg-surface2 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-text3">
                  {t("detail.section.estimatedTotal", "Totale stimato")}
                </div>
                <div className="mt-1 text-lg font-bold">
                  {formatMoney(
                    parseCostNumber(costDraft.billable_hours) *
                      parseCostNumber(costDraft.hourly_rate) +
                      parseCostNumber(costDraft.material_cost),
                  )}
                </div>
                <button
                  className="mt-2 text-[11px] font-semibold text-accent"
                  disabled={!canEdit}
                  onClick={useTrackedHoursAsBillable}
                >
                  {t("detail.btn.useTrackedHours", {
                    hours: totalWorked,
                    defaultValue: "Usa ore tracciate ({{hours}})",
                  })}
                </button>
              </div>
            </div>
            <label className="mt-3 block text-[12px] font-semibold text-text2">
              {t("detail.section.costNotes", "Note costi")}
              <textarea
                className="pc-input mt-1 min-h-[70px]"
                disabled={!canEdit}
                value={costDraft.cost_notes}
                onChange={(event) =>
                  setCostDraft((current) => ({ ...current, cost_notes: event.target.value }))
                }
                placeholder={t(
                  "detail.section.costNotesPlaceholder",
                  "Dettagli materiali, ricambi, accordi di fatturazione...",
                )}
              />
            </label>
          </section>

          <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold">
                  {t("detail.section.materialItems", "Materiali / Ricambi")}
                </h3>
                <p className="text-[11px] text-text3">
                  {materialItemsLoading
                    ? t("detail.section.loading", "Caricamento...")
                    : materialItems.length
                      ? t("detail.section.materialSummary", {
                          count: materialItems.length,
                          cost: formatMoney(materialItemsCost),
                          revenue: formatMoney(materialItemsRevenue),
                          defaultValue: "{{count}} voci · Costo {{cost}} · Ricavo {{revenue}}",
                        })
                      : t("detail.section.noMaterials", "Nessun materiale registrato")}
                </p>
              </div>
            </div>

            {/* Add form */}
            {canEdit && (
              <div className="mb-4 grid gap-2 rounded-lg bg-surface2 p-3 md:grid-cols-6">
                <label className="text-[12px] font-semibold text-text2 md:col-span-2">
                  {t("detail.section.materialDesc", "Descrizione")}
                  <input
                    className="pc-input mt-1"
                    value={materialDraft.description}
                    onChange={(e) => setMaterialDraft((d) => ({ ...d, description: e.target.value }))}
                    placeholder={t("detail.section.materialDescPlaceholder", "es. SSD NVMe 1TB")}
                  />
                </label>
                <label className="text-[12px] font-semibold text-text2">
                  {t("detail.section.materialSupplier", "Fornitore")}
                  <input
                    className="pc-input mt-1"
                    value={materialDraft.supplier}
                    onChange={(e) => setMaterialDraft((d) => ({ ...d, supplier: e.target.value }))}
                    placeholder={t("detail.section.materialSupplierPlaceholder", "Amazon")}
                  />
                </label>
                <label className="text-[12px] font-semibold text-text2">
                  {t("detail.section.materialSku", "SKU")}
                  <input
                    className="pc-input mt-1"
                    value={materialDraft.sku}
                    onChange={(e) => setMaterialDraft((d) => ({ ...d, sku: e.target.value }))}
                    placeholder={t("detail.section.materialSkuPlaceholder", "WD40EZAX")}
                  />
                </label>
                <label className="text-[12px] font-semibold text-text2">
                  {t("detail.section.materialQty", "Qtà")}
                  <input
                    className="pc-input mt-1"
                    type="number"
                    min="1"
                    step="1"
                    value={materialDraft.quantity}
                    onChange={(e) => setMaterialDraft((d) => ({ ...d, quantity: e.target.value }))}
                  />
                </label>
                <label className="text-[12px] font-semibold text-text2">
                  {t("detail.section.materialUnitCost", "Costo unit.")}
                  <input
                    className="pc-input mt-1"
                    type="number"
                    min="0"
                    step="0.01"
                    value={materialDraft.unitCost}
                    onChange={(e) => setMaterialDraft((d) => ({ ...d, unitCost: e.target.value }))}
                  />
                </label>
                <label className="text-[12px] font-semibold text-text2">
                  {t("detail.section.materialMargin", "Ricarico %")}
                  <input
                    className="pc-input mt-1"
                    type="number"
                    min="0"
                    step="1"
                    value={materialDraft.resaleMarginPercent}
                    onChange={(e) => setMaterialDraft((d) => ({ ...d, resaleMarginPercent: e.target.value }))}
                  />
                </label>

                {/* Live preview */}
                <div className="md:col-span-3">
                  <div className="rounded-lg bg-background p-2">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-text3">
                      {t("detail.section.materialPreview", "Anteprima prezzo finale")}
                    </div>
                    <div className="mt-1 flex items-center gap-4">
                      <div>
                        <div className="text-[11px] text-text3">
                          {t("detail.section.materialUnitPrice", "Prezzo unitario")}
                        </div>
                        <div className="font-mono text-sm font-bold text-success">
                          {formatMoney(materialPreviewUnitPrice)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-text3">
                          {t("detail.section.materialTotalPrice", "Prezzo totale")}
                        </div>
                        <div className="font-mono text-base font-bold">
                          {formatMoney(materialPreviewTotalPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-end md:col-span-3">
                  <button
                    className="pc-btn pc-btn-primary pc-btn-sm w-full"
                    onClick={saveMaterialItem}
                    disabled={materialBusy}
                  >
                    <Plus className="size-3" /> {t("detail.section.materialAddBtn", "Aggiungi materiale")}
                  </button>
                </div>
              </div>
            )}

            {/* Materials list */}
            {materialItems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-[12px]">
                  <thead style={{ background: "var(--surface2)" }}>
                    <tr>
                      <th className="px-2 py-1.5 text-left text-[10.5px] font-bold uppercase text-text3">
                        {t("detail.section.materialDesc", "Descrizione")}
                      </th>
                      <th className="px-2 py-1.5 text-left text-[10.5px] font-bold uppercase text-text3">
                        {t("detail.section.materialSupplier", "Fornitore")}
                      </th>
                      <th className="px-2 py-1.5 text-right text-[10.5px] font-bold uppercase text-text3">
                        {t("detail.section.materialQty", "Qtà")}
                      </th>
                      <th className="px-2 py-1.5 text-right text-[10.5px] font-bold uppercase text-text3">
                        {t("detail.section.materialCost", "Costo")}
                      </th>
                      <th className="px-2 py-1.5 text-right text-[10.5px] font-bold uppercase text-text3">
                        {t("detail.section.materialMargin", "Ricarico")}
                      </th>
                      <th className="px-2 py-1.5 text-right text-[10.5px] font-bold uppercase text-text3">
                        {t("detail.section.materialTotalPrice", "Prezzo tot.")}
                      </th>
                      <th className="px-2 py-1.5 text-right text-[10.5px] font-bold uppercase text-text3">
                        {t("detail.section.materialActions", "Azioni")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialItems.map((item) => (
                      <tr key={item.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-2 py-1.5 max-w-[180px] truncate" title={item.description}>
                          {item.description}
                        </td>
                        <td className="px-2 py-1.5 text-text2">{item.supplier || "-"}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{item.quantity}</td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {formatMoney(item.total_cost)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">{item.resale_margin_percent}%</td>
                        <td className="px-2 py-1.5 text-right font-mono font-bold text-success">
                          {formatMoney(item.total_price)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {canEdit && (
                            <button
                              className="pc-btn pc-btn-ghost pc-btn-xs text-destructive"
                              onClick={() => deleteMaterialItem(item.id)}
                              disabled={materialBusy}
                              title={t("detail.section.materialDeleteBtn", "Elimina materiale")}
                            >
                              <Trash2 className="size-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-bold">
                  {t("detail.section.inlineChecklist", "Checklist inline")}
                </h3>
                <p className="text-[11px] text-text3">
                  {t("detail.section.itemsCompleted", {
                    done: overallProgress.done,
                    total: overallProgress.total,
                    defaultValue: "{{done}}/{{total}} elementi completati",
                  })}
                </p>
              </div>
              <div
                className="h-2 w-44 overflow-hidden rounded-full"
                style={{ background: "var(--surface2)" }}
              >
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${overallProgress.pct}%` }}
                />
              </div>
            </div>
            <div
              className="mb-3 flex flex-wrap gap-1 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              {tabKeys.map((key) => {
                const p = structureProgress(ticket.checklist || {}, struct, key);
                const on = currentChecklistTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setChecklistTab(key)}
                    className="px-3 py-2 text-[12px] font-semibold border-b-2 -mb-px"
                    style={{
                      color: on ? "var(--accent)" : "var(--text3)",
                      borderColor: on ? "var(--accent)" : "transparent",
                    }}
                  >
                    {struct[key].label}{" "}
                    <span className="font-mono text-[10px] opacity-70">
                      {p.done}/{p.total}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-1.5">
              {((struct[currentChecklistTab] as any)?.items || []).map((item: ChecklistItemDef) => {
                const done = ticket.checklist?.[currentChecklistTab]?.[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleItem(item.id)}
                    className="flex items-center gap-2.5 rounded-[7px] px-3 py-2 text-left text-[13px] transition-all"
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      color: done ? "var(--text3)" : "var(--text)",
                      textDecoration: done ? "line-through" : "none",
                    }}
                  >
                    <span
                      className="flex h-[17px] w-[17px] flex-shrink-0 items-center justify-center rounded"
                      style={{
                        background: done ? "var(--success)" : "transparent",
                        border: "1.5px solid " + (done ? "var(--success)" : "var(--border2)"),
                      }}
                    >
                      {done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </span>
                    {item.text}
                  </button>
                );
              })}
              {!((struct[currentChecklistTab] as any)?.items as any[])?.length && (
                <div className="py-6 text-center text-[12px] text-text3">
                  {t("detail.section.noItems", "Nessuna voce in questa sezione")}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {mainTab === "checklists" && (
        <TicketChecklistPanel
          instances={(checklistInstancesQuery.data ?? []) as TicketChecklistInstanceRow[]}
          instancesLoading={checklistInstancesQuery.isLoading}
          templates={(checklistTemplatesQuery.data ?? []) as any[]}
          selectedTemplateId={checklistTemplateToAttach}
          onSelectedTemplateIdChange={setChecklistTemplateToAttach}
          onAttachTemplate={attachChecklistTemplate}
          onSaveResponse={saveChecklistResponse}
          onComplete={completeChecklist}
          technicians={technicians}
          currentUserId={user?.id ?? null}
          canEdit={canEdit}
          canManageChecklists={hasPermission("can_manage_checklist_templates")}
        />
      )}

      {mainTab === "notes" && (
        <TicketNotes
          ticketId={ticket.id}
          onChanged={() => {
            qc.invalidateQueries(QUERY_KEYS.ticket(ticket.id) as any);
            qc.invalidateQueries(QUERY_KEYS.tickets as any);
          }}
        />
      )}
      {mainTab === "history" && (
        <TicketHistory
          timeline={timeline}
          loading={statusHistoryQuery.isLoading || deviceHistoryQuery.isLoading}
        />
      )}
      {mainTab === "attachments" && <TicketAttachments ticketId={ticket.id} />}

      <DestructiveConfirmDialog
        open={deleteOpen}
        title={t("detail.deleteTitle", "Eliminare questo ticket?")}
        description={t("detail.deleteDescription", {
          code: ticket.ticket_code,
          defaultValue:
            "Il ticket {{code}} verrà rimosso definitivamente. L'azione non può essere annullata.",
        })}
        confirmLabel={t("detail.deleteConfirm", "Elimina ticket")}
        loadingLabel={t("detail.deleteLoading", "Eliminazione...")}
        onOpenChange={setDeleteOpen}
        onConfirm={del}
      />
    </Modal>
  );
}

function TicketChecklistPanel({
  instances,
  instancesLoading,
  templates,
  selectedTemplateId,
  onSelectedTemplateIdChange,
  onAttachTemplate,
  onSaveResponse,
  onComplete,
  technicians,
  currentUserId,
  canEdit,
  canManageChecklists,
}: {
  instances: TicketChecklistInstanceRow[];
  instancesLoading: boolean;
  templates: Array<{ id: string; name: string; is_default?: boolean }>;
  selectedTemplateId: string;
  onSelectedTemplateIdChange: (value: string) => void;
  onAttachTemplate: () => void;
  onSaveResponse: (
    instance: TicketChecklistInstanceRow,
    sectionKey: string,
    itemId: string,
    value: string | null,
  ) => void;
  onComplete: (instance: TicketChecklistInstanceRow) => void;
  technicians: TechnicianOption[];
  currentUserId: string | null;
  canEdit: boolean;
  canManageChecklists: boolean;
}) {
  const { t } = useTranslation("tickets");
  return (
    <div className="space-y-4">
      <section className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-bold">
              {t("detail.section.linkedChecklists", "Checklist collegate")}
            </h3>
            <p className="text-[11px] text-text3">
              {t(
                "detail.section.linkedChecklistsDesc",
                "Le checklist vengono istanziate come snapshot indipendente dal template.",
              )}
            </p>
          </div>
          {canEdit && (
            <div className="flex min-w-[320px] flex-1 justify-end gap-2">
              <select
                className="pc-input max-w-[320px] text-[12px]"
                value={selectedTemplateId}
                onChange={(event) => onSelectedTemplateIdChange(event.target.value)}
                aria-label={t("detail.checklistTemplateLabel", "Seleziona template checklist")}
              >
                <option value="">{t("detail.btn.attachChecklist", "— Collega checklist —")}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.is_default ? t("createTicket.templateDefault", " (predefinito)") : ""}
                  </option>
                ))}
              </select>
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                disabled={!selectedTemplateId}
                onClick={onAttachTemplate}
              >
                {t("detail.btn.addChecklist", "Collega")}
              </button>
            </div>
          )}
        </div>
        {instancesLoading && (
          <div className="text-[12px] text-text3">
            {t("detail.section.checklistLoading", "Caricamento checklist...")}
          </div>
        )}
        {!instancesLoading && !instances.length && (
          <div
            className="rounded-lg border p-6 text-center text-[12px] text-text3"
            style={{ borderColor: "var(--border)" }}
          >
            {t("detail.section.noChecklistsLinked", "Nessuna checklist collegata a questo ticket.")}
          </div>
        )}
        <div className="space-y-3">
          {instances.map((instance) => {
            const progress = computeInstanceProgress(instance);
            return (
              <div
                key={instance.id}
                className="rounded-lg border p-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-[13px] font-bold">{instance.title}</h4>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background:
                            instance.status === "completed" ? "var(--success)" : "var(--surface2)",
                          color: instance.status === "completed" ? "white" : "var(--text3)",
                        }}
                      >
                        {instance.status === "completed"
                          ? t("detail.section.completed", "Completata")
                          : instance.status === "in_progress"
                            ? t("detail.section.inProgress", "In corso")
                            : t("detail.section.toFill", "Da compilare")}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-text3">
                      {t("detail.section.itemsCount", {
                        done: progress.done,
                        total: progress.total,
                        defaultValue: "{{done}}/{{total}} elementi",
                      })}{" "}
                      · {progress.pct}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-40 overflow-hidden rounded-full"
                      style={{ background: "var(--surface2)" }}
                    >
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${progress.pct}%` }}
                      />
                    </div>
                    <button
                      className="pc-btn pc-btn-ghost pc-btn-sm"
                      onClick={() => window.print()}
                    >
                      <Printer className="size-3" /> {t("detail.btn.exportPdf", "Esporta PDF")}
                    </button>
                    {canEdit && instance.status !== "completed" && (
                      <button
                        className="pc-btn pc-btn-primary pc-btn-sm"
                        disabled={progress.requiredMissing > 0}
                        title={
                          progress.requiredMissing > 0
                            ? t(
                                "detail.section.fillRequiredItems",
                                "Compila prima tutti gli elementi obbligatori",
                              )
                            : t("detail.section.completeChecklistHint", "Completa checklist")
                        }
                        onClick={() => onComplete(instance)}
                      >
                        <CheckCircle2 className="size-3" />{" "}
                        {t("detail.btn.completeChecklist", "Completa checklist")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(instance.structure as Record<string, any>).map(
                    ([groupKey, group]) => {
                      const sections = (group as any).sections;
                      if (!sections) {
                        // Old flat format: group is actually a section
                        const section = group as unknown as {
                          label: string;
                          items: ChecklistItemDef[];
                          assigned_to?: string | null;
                        };
                        const assignedTo =
                          instance.section_assignments?.[groupKey] || section.assigned_to || null;
                        const assignedTech = technicians.find((tech) => tech.id === assignedTo);
                        const sectionLocked =
                          !!assignedTo && assignedTo !== currentUserId && !canManageChecklists;
                        const responses = responseMap(instance.responses);
                        return (
                          <div
                            key={groupKey}
                            className="rounded-lg border p-3"
                            style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
                          >
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-[12.5px] font-bold">{section.label}</div>
                                <div className="text-[11px] text-text3">
                                  {assignedTech
                                    ? t("detail.section.assignedTo", {
                                        name: assignedTech.full_name,
                                        defaultValue: "Assegnata a {{name}}",
                                      })
                                    : t(
                                        "detail.section.noTechnicianAssigned",
                                        "Nessun tecnico specifico",
                                      )}
                                  {sectionLocked
                                    ? ` · ${t("detail.section.readOnly", "sola lettura per te")}`
                                    : ""}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              {(section.items || []).map((item) => {
                                const key = `${groupKey}:${item.id}`;
                                const response = responses.get(key);
                                const disabled =
                                  !canEdit || sectionLocked || instance.status === "completed";
                                return (
                                  <ChecklistResponseInput
                                    key={item.id}
                                    item={item}
                                    value={response?.value ?? ""}
                                    response={response}
                                    disabled={disabled}
                                    compiledByLabel={
                                      technicians.find((tech) => tech.id === response?.compiled_by)
                                        ?.full_name
                                    }
                                    onSave={(value) =>
                                      onSaveResponse(instance, groupKey, item.id, value)
                                    }
                                  />
                                );
                              })}
                              {!section.items?.length && (
                                <div className="text-[12px] text-text3">
                                  {t("detail.section.noItems", "Nessuna voce in questa sezione")}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      // New two-level format: iterate sections within group
                      return Object.entries(sections as Record<string, any>).map(
                        ([sectionKey, section]) => {
                          const assignedTo =
                            instance.section_assignments?.[sectionKey] ||
                            section.assigned_to ||
                            null;
                          const assignedTech = technicians.find((tech) => tech.id === assignedTo);
                          const sectionLocked =
                            !!assignedTo && assignedTo !== currentUserId && !canManageChecklists;
                          const responses = responseMap(instance.responses);
                          return (
                            <div
                              key={sectionKey}
                              className="rounded-lg border p-3"
                              style={{
                                borderColor: "var(--border)",
                                background: "var(--surface2)",
                              }}
                            >
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <div className="text-[12.5px] font-bold">{section.label}</div>
                                  <div className="text-[11px] text-text3">
                                    {assignedTech
                                      ? t("detail.section.assignedTo", {
                                          name: assignedTech.full_name,
                                          defaultValue: "Assegnata a {{name}}",
                                        })
                                      : t(
                                          "detail.section.noTechnicianAssigned",
                                          "Nessun tecnico specifico",
                                        )}
                                    {sectionLocked
                                      ? ` · ${t("detail.section.readOnly", "sola lettura per te")}`
                                      : ""}
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                {(section.items || []).map((item) => {
                                  const key = `${sectionKey}:${item.id}`;
                                  const response = responses.get(key);
                                  const disabled =
                                    !canEdit || sectionLocked || instance.status === "completed";
                                  return (
                                    <ChecklistResponseInput
                                      key={item.id}
                                      item={item}
                                      value={response?.value ?? ""}
                                      response={response}
                                      disabled={disabled}
                                      compiledByLabel={
                                        technicians.find(
                                          (tech) => tech.id === response?.compiled_by,
                                        )?.full_name
                                      }
                                      onSave={(value) =>
                                        onSaveResponse(instance, sectionKey, item.id, value)
                                      }
                                    />
                                  );
                                })}
                                {!section.items?.length && (
                                  <div className="text-[12px] text-text3">
                                    {t("detail.section.noItems", "Nessuna voce in questa sezione")}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        },
                      );
                    },
                  )}
                </div>
                {instance.status === "completed" && (
                  <div
                    className="mt-3 rounded-lg border p-2 text-[11px] text-text3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {t("detail.section.completedAt", {
                      date: fmtDateTime(instance.completed_at),
                      defaultValue: "Completata {{date}}",
                    })}
                    {instance.signature_name
                      ? ` · ${t("detail.section.signedBy", { name: instance.signature_name, defaultValue: "Firma: {{name}}" })}`
                      : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ChecklistResponseInput({
  item,
  value,
  response,
  disabled,
  compiledByLabel,
  onSave,
}: {
  item: ChecklistItemDef;
  value: string;
  response?: TicketChecklistInstanceRow["responses"][number];
  disabled: boolean;
  compiledByLabel?: string;
  onSave: (value: string | null) => void;
}) {
  const { t } = useTranslation("tickets");
  const itemType = item.type || "checkbox";
  const done = isResponseComplete(item, value);
  const commonMeta = response ? (
    <span className="text-[10.5px] text-text3">
      {t("detail.section.savedBy", {
        name: compiledByLabel || response.compiled_by || "utente",
        defaultValue: "salvato da {{name}}",
      })}{" "}
      ·{" "}
      {t("detail.section.atTime", {
        date: fmtDateTime(response.compiled_at),
        defaultValue: "{{date}}",
      })}
    </span>
  ) : null;

  if (itemType === "text" || itemType === "number") {
    return (
      <label
        className="block rounded-md border bg-background p-2"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] font-semibold">
            {item.text} {item.required && <span className="text-red-500">*</span>}
          </span>
          {commonMeta}
        </div>
        <input
          className="pc-input"
          type={itemType === "number" ? "number" : "text"}
          defaultValue={value}
          disabled={disabled}
          onChange={(event) => onSave(event.target.value)}
          placeholder={itemType === "number" ? "0" : ""}
        />
      </label>
    );
  }

  return (
    <label
      className="flex items-center gap-2 rounded-md border bg-background p-2"
      style={{ borderColor: "var(--border)", color: done ? "var(--text3)" : "var(--text)" }}
    >
      <input
        type="checkbox"
        checked={value === "checked"}
        disabled={disabled}
        onChange={(event) => onSave(event.target.checked ? "checked" : "unchecked")}
      />
      <span className="flex-1 text-[12px]">
        {item.text} {item.required && <span className="text-red-500">*</span>}
      </span>
      {commonMeta}
    </label>
  );
}

function responseMap(responses: TicketChecklistInstanceRow["responses"]) {
  return new Map(responses.map((response) => [response.item_key, response]));
}

function isResponseComplete(item: ChecklistItemDef, value?: string | null) {
  const itemType = item.type || "checkbox";
  if (itemType === "checkbox") return value === "checked";
  return !!value?.trim();
}

function computeInstanceProgress(instance: TicketChecklistInstanceRow) {
  const responses = responseMap(instance.responses);
  let done = 0;
  let total = 0;
  let requiredMissing = 0;
  const struct = instance.structure as Record<string, any>;
  for (const [groupKey, group] of Object.entries(struct)) {
    const sections = (group as any).sections;
    if (sections) {
      // New two-level format
      for (const [sectionKey, section] of Object.entries(sections as Record<string, any>)) {
        for (const item of ((section as any).items as ChecklistItemDef[]) || []) {
          total += 1;
          const response = responses.get(`${sectionKey}:${item.id}`);
          const completed = isResponseComplete(item, response?.value);
          if (completed) done += 1;
          if (item.required && !completed) requiredMissing += 1;
        }
      }
    } else {
      // Old flat format: groupKey IS the section key
      const items = ((group as any).items as ChecklistItemDef[]) || [];
      for (const item of items) {
        total += 1;
        const response = responses.get(`${groupKey}:${item.id}`);
        const completed = isResponseComplete(item, response?.value);
        if (completed) done += 1;
        if (item.required && !completed) requiredMissing += 1;
      }
    }
  }
  return { done, total, requiredMissing, pct: total ? Math.round((done / total) * 100) : 0 };
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="pc-label">{label}</div>
      <div className="text-[13px]">{value}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="pc-label">{label}</div>
      <div className="text-[13px] font-bold">{value}</div>
      {hint && <div className="mt-1 font-mono text-[11px] text-text3">{hint}</div>}
    </div>
  );
}

function TicketHistory({ timeline, loading }: { timeline: TimelineItem[]; loading: boolean }) {
  const { t } = useTranslation("tickets");
  if (loading)
    return (
      <div className="text-[12px] text-text3">{t("detail.relative.loading", "Caricamento")}...</div>
    );
  if (!timeline.length)
    return (
      <div
        className="rounded-lg border p-6 text-center text-[12px] text-text3"
        style={{ borderColor: "var(--border)" }}
      >
        {t("detail.section.noHistory", "Nessun evento storico disponibile")}
      </div>
    );
  return (
    <div className="relative space-y-0 pl-5 before:absolute before:bottom-0 before:left-[9px] before:top-0 before:w-px before:bg-border">
      {timeline.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.id} className="relative pb-5">
            <span className="absolute -left-5 top-0 flex size-5 items-center justify-center rounded-full bg-background ring-4 ring-surface">
              <Icon className="size-3.5 text-accent" />
            </span>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[13px] font-semibold">{item.title}</div>
                <div className="text-[11px] text-text3">{fmtDateTime(item.at)}</div>
              </div>
              <div className="mt-1 text-[12px] text-text2">{item.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function buildTimeline(
  statusRows: any[],
  deviceRows: any[],
  assignments: TicketDeviceAssignmentRow[],
): TimelineItem[] {
  const statusItems = statusRows.map((row) => ({
    id: `status-${row.id}`,
    at: row.changed_at,
    title: "Cambio stato",
    description: `${labelStatus(row.from_status)} -> ${labelStatus(row.to_status)}${row.note ? ` · ${row.note}` : ""}`,
    icon: RefreshCw,
  }));
  const deviceItems = deviceRows.map((row) => ({
    id: `device-history-${row.id}`,
    at: row.occurred_at,
    title: row.action === "unassigned" ? "Dispositivo scollegato" : "Dispositivo assegnato",
    description: `${row.device?.model || "Dispositivo"} ${row.device?.serial || ""}${row.notes ? ` · ${row.notes}` : ""}`,
    icon: Archive,
  }));
  const assignmentItems = assignments.map((row) => ({
    id: `assignment-${row.id}`,
    at: row.assigned_at,
    title: "Assegnazione dispositivo",
    description: `Assegnato a ${row.device?.model || "dispositivo"} ${row.device?.serial || ""}`,
    icon: UserRound,
  }));
  return [...statusItems, ...deviceItems, ...assignmentItems].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

function labelStatus(status?: string | null) {
  if (!status) return "iniziale";
  return STATUS_META[status as TicketStatus]?.label || status;
}

function assetInfo(ticket: TicketDetailRow) {
  return {
    model: ticket.device?.model || ticket.model || "Nessun asset associato",
    serial: ticket.device?.serial || "-",
    os: ticket.device?.os || "-",
    assignedTo: ticket.device?.assigned_to || "-",
  };
}
