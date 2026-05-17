import { supabase } from "@/integrations/supabase/client";

export type MaintenanceRecurrence = "once" | "weekly" | "monthly" | "quarterly" | "yearly";
export type MaintenanceStatus = "scheduled" | "due_soon" | "overdue" | "completed";

export interface MaintenanceSchedule {
  id: string;
  device_id: string;
  title: string;
  description: string | null;
  recurrence: MaintenanceRecurrence;
  next_due_date: string;
  last_done_date: string | null;
  assigned_to: string | null;
  auto_create_ticket: boolean;
  ticket_template: { title?: string; description?: string } | null;
  created_at: string;
  device?: {
    id: string;
    model: string | null;
    serial: string | null;
    client_id?: string | null;
    client?: { name: string | null } | null;
  } | null;
  assignee?: { display_name: string | null } | null;
}

export interface MaintenanceHistoryEntry {
  id: string;
  schedule_id: string;
  device_id: string;
  completed_at: string;
  completed_by: string | null;
  notes: string | null;
}

export interface TechnicianOption {
  id: string;
  name: string;
}

export const MAINTENANCE_RECURRENCE_LABEL: Record<MaintenanceRecurrence, string> = {
  once: "Una tantum",
  weekly: "Settimanale",
  monthly: "Mensile",
  quarterly: "Trimestrale",
  yearly: "Annuale",
};

export const MAINTENANCE_STATUS_META: Record<
  MaintenanceStatus,
  { label: string; color: string; background: string }
> = {
  scheduled: { label: "Programmata", color: "#1B4FD8", background: "#DBEAFE" },
  due_soon: { label: "In scadenza", color: "#B45309", background: "#FEF3C7" },
  overdue: { label: "Scaduta", color: "#B91C1C", background: "#FEE2E2" },
  completed: { label: "Completata", color: "#15803D", background: "#DCFCE7" },
};

const DAY_MS = 86_400_000;

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntilDate(date: string | null | undefined) {
  if (!date) return null;
  const today = new Date(todayIsoDate()).getTime();
  const target = new Date(date).getTime();
  if (!Number.isFinite(target)) return null;
  return Math.ceil((target - today) / DAY_MS);
}

export function getMaintenanceStatus(
  schedule: Pick<MaintenanceSchedule, "next_due_date" | "last_done_date" | "recurrence">,
): MaintenanceStatus {
  if (schedule.recurrence === "once" && schedule.last_done_date) return "completed";
  const days = daysUntilDate(schedule.next_due_date);
  if (days == null) return "scheduled";
  if (days < 0) return "overdue";
  if (days <= 30) return "due_soon";
  return "scheduled";
}

export function calculateNextDueDate(fromDate: string, recurrence: MaintenanceRecurrence) {
  if (recurrence === "once") return fromDate;
  const date = new Date(`${fromDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return fromDate;
  if (recurrence === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  if (recurrence === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
  if (recurrence === "quarterly") date.setUTCMonth(date.getUTCMonth() + 3);
  if (recurrence === "yearly") date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export async function fetchTechnicianOptions(): Promise<TechnicianOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, initials")
    .order("full_name");
  if (error) throw error;
  return (
    (data ?? []) as Array<{ id: string; full_name: string | null; initials: string | null }>
  ).map((profile) => ({
    id: profile.id,
    name: profile.full_name || profile.initials || profile.id.slice(0, 8),
  }));
}

export async function fetchDeviceMaintenanceSchedules(deviceId: string) {
  const { data, error } = await (supabase as any)
    .from("maintenance_schedules")
    .select("*, assignee:user_profiles!maintenance_schedules_assigned_to_fkey(display_name)")
    .eq("device_id", deviceId)
    .order("next_due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MaintenanceSchedule[];
}

export async function fetchMaintenanceHistory(deviceId: string) {
  const { data, error } = await (supabase as any)
    .from("maintenance_history")
    .select("*")
    .eq("device_id", deviceId)
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MaintenanceHistoryEntry[];
}

export async function createMaintenanceSchedule(payload: {
  device_id: string;
  title: string;
  description?: string | null;
  recurrence: MaintenanceRecurrence;
  next_due_date: string;
  assigned_to?: string | null;
  auto_create_ticket?: boolean;
  ticket_template?: { title?: string; description?: string } | null;
}) {
  const { data, error } = await (supabase as any)
    .from("maintenance_schedules")
    .insert({
      device_id: payload.device_id,
      title: payload.title,
      description: payload.description || null,
      recurrence: payload.recurrence,
      next_due_date: payload.next_due_date,
      assigned_to: payload.assigned_to || null,
      auto_create_ticket: payload.auto_create_ticket ?? false,
      ticket_template: payload.ticket_template ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MaintenanceSchedule;
}

export async function completeMaintenanceSchedule(
  schedule: MaintenanceSchedule,
  userId?: string | null,
) {
  const doneDate = todayIsoDate();
  const nextDueDate = calculateNextDueDate(doneDate, schedule.recurrence);
  const nextPayload = {
    last_done_date: doneDate,
    next_due_date: nextDueDate,
  };
  const { error } = await (supabase as any)
    .from("maintenance_schedules")
    .update(nextPayload)
    .eq("id", schedule.id);
  if (error) throw error;

  const { error: historyError } = await (supabase as any).from("maintenance_history").insert({
    schedule_id: schedule.id,
    device_id: schedule.device_id,
    completed_by: userId || null,
    notes: schedule.recurrence === "once" ? "Manutenzione una tantum completata" : null,
  });
  if (historyError) throw historyError;

  return { ...schedule, ...nextPayload } as MaintenanceSchedule;
}

export async function fetchMaintenanceCalendar(params: {
  from: string;
  to: string;
  assignedTo?: string;
  type?: string;
  status?: MaintenanceStatus | "all";
}) {
  let query = (supabase as any)
    .from("maintenance_schedules")
    .select(
      "*, device:devices(id, model, serial, client:clients(name)), assignee:user_profiles!maintenance_schedules_assigned_to_fkey(display_name)",
    )
    .gte("next_due_date", params.from)
    .lte("next_due_date", params.to)
    .order("next_due_date", { ascending: true });
  if (params.assignedTo) query = query.eq("assigned_to", params.assignedTo);
  if (params.type) query = query.ilike("title", `%${params.type}%`);
  const { data, error } = await query;
  if (error) throw error;
  let rows = (data ?? []) as MaintenanceSchedule[];
  if (params.status && params.status !== "all") {
    rows = rows.filter((row) => getMaintenanceStatus(row) === params.status);
  }
  return rows;
}

export async function fetchMaintenanceDashboard() {
  const today = todayIsoDate();
  const { data, error } = await (supabase as any)
    .from("maintenance_schedules")
    .select(
      "*, device:devices(id, model, serial, client:clients(name)), assignee:user_profiles!maintenance_schedules_assigned_to_fkey(display_name)",
    )
    .order("next_due_date", { ascending: true })
    .limit(25);
  if (error) throw error;
  const rows = (data ?? []) as MaintenanceSchedule[];
  return {
    upcoming: rows.filter((row) => getMaintenanceStatus(row) !== "completed").slice(0, 5),
    overdueCount: rows.filter(
      (row) => row.next_due_date < today && getMaintenanceStatus(row) !== "completed",
    ).length,
  };
}
