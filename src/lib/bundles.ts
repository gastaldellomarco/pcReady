import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BundleBillingType = "monthly" | "annual" | "one_time";
export type BundleTicketPriority = "low" | "med" | "high" | "critical";
export type BundleStatus = "active" | "expired" | "cancelled" | "pending" | "renewed";

export type AssistanceBundle = {
  id: string;
  name: string;
  description: string | null;
  billing_type: BundleBillingType;
  fee: number;
  currency: string;
  included_hours: number | null;
  extra_hourly_rate: number;
  sla_response_hours: number;
  sla_resolution_hours: number;
  included_onsite_visits: number | null;
  remote_support: boolean;
  ticket_priority: BundleTicketPriority;
  auto_renew: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type BundleClient = {
  id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
};

export type ClientBundleAssignment = {
  id: string;
  client_id: string;
  bundle_id: string;
  status: BundleStatus;
  start_date: string;
  end_date: string | null;
  auto_renew: boolean;
  renewal_mode: string | null;
  custom_fee: number | null;
  custom_included_hours: number | null;
  custom_extra_hourly_rate: number | null;
  custom_sla_response_hours: number | null;
  custom_sla_resolution_hours: number | null;
  custom_included_onsite_visits: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  bundle?: AssistanceBundle | null;
  client?: BundleClient | null;
};

export type BundleUsageSummary = {
  client_bundle_assignment_id: string;
  assignment_id?: string;
  client_id: string;
  bundle_id: string;
  status?: BundleStatus;
  start_date?: string;
  end_date?: string | null;
  effective_fee?: number | null;
  effective_included_hours?: number | null;
  effective_extra_hourly_rate?: number | null;
  effective_sla_response_hours?: number | null;
  effective_sla_resolution_hours?: number | null;
  effective_included_onsite_visits?: number | null;
  used_hours: number | null;
  extra_hours: number | null;
  remaining_hours: number | null;
  onsite_visits: number | null;
  used_onsite_visits?: number | null;
  remaining_onsite_visits: number | null;
  extra_amount: number | null;
  usage_percent?: number | null;
  currency?: string | null;
  bundle_name?: string | null;
  client_name?: string | null;
  company_name?: string | null;
  [key: string]: unknown;
};

export type BundlePayment = {
  id: string;
  client_bundle_assignment_id: string;
  client_id: string;
  amount: number;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  status: "pending" | "paid" | "overdue" | "cancelled";
  notes: string | null;
  created_at: string;
  created_by?: string | null;
  assignment?: ClientBundleAssignment | null;
  client?: BundleClient | null;
  [key: string]: unknown;
};

export type BundleUsageEntry = {
  id: string;
  client_bundle_assignment_id: string;
  client_id: string;
  ticket_id?: string | null;
  time_entry_id?: string | null;
  usage_type: "remote_hours" | "onsite_hours" | "onsite_visit" | "manual_adjustment";
  used_hours: number | null;
  onsite_visits: number | null;
  extra_hours: number | null;
  extra_amount: number | null;
  description: string | null;
  used_at: string | null;
  created_at: string;
  created_by?: string | null;
  [key: string]: unknown;
};

export type TicketBundleInfo = {
  ticket: Record<string, unknown> | null;
  assignment: ClientBundleAssignment | null;
  usageSummary: BundleUsageSummary | null;
};

export const BILLING_TYPE_LABEL: Record<BundleBillingType, string> = {
  monthly: "Mensile",
  annual: "Annuale",
  one_time: "Una tantum",
};

export const BUNDLE_PRIORITY_LABEL: Record<BundleTicketPriority, string> = {
  low: "Bassa",
  med: "Media",
  high: "Alta",
  critical: "Critica",
};

export const BUNDLE_STATUS_LABEL: Record<BundleStatus, string> = {
  active: "Attivo",
  expired: "Scaduto",
  cancelled: "Annullato",
  pending: "In attesa",
  renewed: "Rinnovato",
};

export const BUNDLE_QUERY_KEYS = {
  all: ["bundles"] as const,
  lists: () => [...BUNDLE_QUERY_KEYS.all, "list"] as const,
  list: (includeInactive = true) => [...BUNDLE_QUERY_KEYS.lists(), { includeInactive }] as const,
  assignments: (clientId?: string | null) =>
    [...BUNDLE_QUERY_KEYS.all, "assignments", clientId ?? "all"] as const,
  usageSummaries: (clientId?: string | null) =>
    [...BUNDLE_QUERY_KEYS.all, "usage-summaries", clientId ?? "all"] as const,
  monthlyUsage: (clientId?: string | null) =>
    [...BUNDLE_QUERY_KEYS.all, "monthly-usage", clientId ?? "all"] as const,
  payments: (clientId?: string | null) =>
    [...BUNDLE_QUERY_KEYS.all, "payments", clientId ?? "all"] as const,
  ticketInfo: (ticketId: string) => [...BUNDLE_QUERY_KEYS.all, "ticket", ticketId] as const,
};

export function formatBundleMoney(value: number | null | undefined, currency = "EUR") {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatBundleHours(value: number | null | undefined) {
  if (value == null) return "Illimitate";
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(Number(value))} h`;
}

export function formatBundleVisits(value: number | null | undefined) {
  if (value == null) return "Illimitati";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(Number(value));
}

export function bundleUsageTone(percent: number): "success" | "warning" | "danger" {
  if (percent < 70) return "success";
  if (percent < 90) return "warning";
  return "danger";
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function computeEndDate(startDate: string, billingType: BundleBillingType) {
  if (!startDate || billingType === "one_time") return "";
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return "";
  const end = new Date(year, month - 1, day);
  if (billingType === "monthly") end.setMonth(end.getMonth() + 1);
  if (billingType === "annual") end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1);
  return formatDateOnly(end);
}

export async function listBundles(includeInactive = true) {
  let query = (supabase as any)
    .from("assistance_bundles")
    .select("*")
    .order("active", { ascending: false })
    .order("name", { ascending: true });
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AssistanceBundle[];
}

export async function createBundle(data: Partial<AssistanceBundle>) {
  const { data: row, error } = await (supabase as any)
    .from("assistance_bundles")
    .insert(data)
    .select("*")
    .single();
  if (error) throw error;
  return row as AssistanceBundle;
}

export async function updateBundle(id: string, data: Partial<AssistanceBundle>) {
  const { data: row, error } = await (supabase as any)
    .from("assistance_bundles")
    .update(data)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return row as AssistanceBundle;
}

export async function deactivateBundle(id: string) {
  return updateBundle(id, { active: false });
}

export async function listClientBundleAssignments(clientId?: string | null) {
  let query = (supabase as any)
    .from("client_bundle_assignments")
    .select("*, bundle:assistance_bundles(*), client:clients(id,name,company_name,email)")
    .order("start_date", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ClientBundleAssignment[];
}

export async function createClientBundleAssignment(data: Partial<ClientBundleAssignment>) {
  const { data: row, error } = await (supabase as any)
    .from("client_bundle_assignments")
    .insert(data)
    .select("*, bundle:assistance_bundles(*), client:clients(id,name,company_name,email)")
    .single();
  if (error) throw error;
  return row as ClientBundleAssignment;
}

export async function updateClientBundleAssignment(
  id: string,
  data: Partial<ClientBundleAssignment>,
) {
  const { data: row, error } = await (supabase as any)
    .from("client_bundle_assignments")
    .update(data)
    .eq("id", id)
    .select("*, bundle:assistance_bundles(*), client:clients(id,name,company_name,email)")
    .single();
  if (error) throw error;
  return row as ClientBundleAssignment;
}

export async function cancelClientBundleAssignment(id: string) {
  return updateClientBundleAssignment(id, { status: "cancelled" });
}

export async function listBundleUsageSummaries(clientId?: string | null) {
  let query = (supabase as any)
    .from("bundle_assignment_usage_summary")
    .select("*")
    .order("client_bundle_assignment_id", { ascending: true });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BundleUsageSummary[];
}

export async function listBundleMonthlyUsage(clientId?: string | null) {
  let query = (supabase as any)
    .from("bundle_monthly_usage")
    .select("*")
    .order("usage_month", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listBundlePayments(clientId?: string | null) {
  let query = (supabase as any)
    .from("bundle_fee_payments")
    .select(
      "*, assignment:client_bundle_assignments(*, bundle:assistance_bundles(*), client:clients(id,name,company_name,email))",
    )
    .order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BundlePayment[];
}

export async function createBundlePayment(data: Partial<BundlePayment>) {
  const { data: row, error } = await (supabase as any)
    .from("bundle_fee_payments")
    .insert(data)
    .select("*")
    .single();
  if (error) throw error;
  return row as BundlePayment;
}

export async function fetchTicketBundleInfo(ticketId: string): Promise<TicketBundleInfo> {
  const { data: ticket, error: ticketError } = await (supabase as any)
    .from("tickets")
    .select(
      "id, client_id, bundle_assignment_id, bundle_extra_hours, bundle_extra_amount, onsite_visit",
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (ticketError) throw ticketError;
  if (!ticket) return { ticket: null, assignment: null, usageSummary: null };

  const assignmentId = ticket.bundle_assignment_id;
  if (!assignmentId) return { ticket, assignment: null, usageSummary: null };

  const [assignmentResult, summaryResult] = await Promise.all([
    (supabase as any)
      .from("client_bundle_assignments")
      .select("*, bundle:assistance_bundles(*), client:clients(id,name,company_name,email)")
      .eq("id", assignmentId)
      .maybeSingle(),
    (supabase as any)
      .from("bundle_assignment_usage_summary")
      .select("*")
      .eq("assignment_id", assignmentId)
      .maybeSingle(),
  ]);

  if (assignmentResult.error) throw assignmentResult.error;
  if (summaryResult.error) throw summaryResult.error;

  return {
    ticket,
    assignment: (assignmentResult.data ?? null) as ClientBundleAssignment | null,
    usageSummary: (summaryResult.data ?? null) as BundleUsageSummary | null,
  };
}

function useInvalidateBundles() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: BUNDLE_QUERY_KEYS.all });
}

export function useBundles(includeInactive = true) {
  return useQuery({
    queryKey: BUNDLE_QUERY_KEYS.list(includeInactive),
    queryFn: () => listBundles(includeInactive),
  });
}

export function useBundleAssignments(clientId?: string | null) {
  return useQuery({
    queryKey: BUNDLE_QUERY_KEYS.assignments(clientId),
    queryFn: () => listClientBundleAssignments(clientId),
  });
}

export function useBundleUsageSummaries(clientId?: string | null) {
  return useQuery({
    queryKey: BUNDLE_QUERY_KEYS.usageSummaries(clientId),
    queryFn: () => listBundleUsageSummaries(clientId),
  });
}

export function useCreateBundleMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: createBundle,
    onSuccess: invalidate,
  });
}

export function useUpdateBundleMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AssistanceBundle> }) =>
      updateBundle(id, data),
    onSuccess: invalidate,
  });
}

export function useDeactivateBundleMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: deactivateBundle,
    onSuccess: invalidate,
  });
}

export function useCreateBundleAssignmentMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: createClientBundleAssignment,
    onSuccess: invalidate,
  });
}

export function useUpdateBundleAssignmentMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClientBundleAssignment> }) =>
      updateClientBundleAssignment(id, data),
    onSuccess: invalidate,
  });
}

export function useCancelBundleAssignmentMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: cancelClientBundleAssignment,
    onSuccess: invalidate,
  });
}

export function useCreateBundlePaymentMutation() {
  const invalidate = useInvalidateBundles();
  return useMutation({
    mutationFn: createBundlePayment,
    onSuccess: invalidate,
  });
}
