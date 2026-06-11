import { supabase } from "@/integrations/supabase/client";
import type { TicketPriority, TicketStatus, TicketType, ChecklistState, ChecklistStructure } from "@/lib/pcready";
import type { ComponentType } from "react";

// ─── Types ────────────────────────────────────────────────────────────

export interface TicketDetailRow {
  id: string;
  ticket_code: string;
  client: string;
  client_id: string | null;
  requester: string;
  ticket_type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  assignee_id: string | null;
  software: string | null;
  notes: string | null;
  checklist: ChecklistState;
  created_at: string;
  due_date?: string | null;
  sla_deadline?: string | null;
  sla_breached?: boolean | null;
  sla_response_at?: string | null;
  billable_hours?: number | null;
  hourly_rate?: number | null;
  material_cost?: number | null;
  labor_cost?: number | null;
  total_cost?: number | null;
  cost_notes?: string | null;
  cost_currency?: string | null;
  bundle_assignment_id?: string | null;
  bundle_extra_hours?: number | null;
  bundle_extra_amount?: number | null;
  onsite_visit?: boolean | null;
  sla_response_due_at?: string | null;
  sla_resolution_due_at?: string | null;
  device_id: string | null;
  model?: string | null;
  checklist_structure?: ChecklistStructure | null;
  device?: { id: string; model: string; serial: string | null; os: string | null; assigned_to: string | null; status: string } | null;
  assignee?: { full_name: string; initials: string } | null;
}

export interface TicketDeviceAssignmentRow {
  id: string;
  assigned_at: string;
  unassigned_at: string | null;
  notes: string | null;
  device?: { id?: string; model: string; serial: string | null } | null;
}

export interface TicketMaterialItem {
  id: string;
  description: string;
  supplier: string | null;
  sku: string | null;
  quantity: number;
  unit_cost: number;
  resale_margin_percent: number;
  unit_price: number;
  total_cost: number;
  total_price: number;
  created_at: string;
}

export interface TicketMaterialDraft {
  description: string;
  supplier: string;
  sku: string;
  quantity: string;
  unitCost: string;
  resaleMarginPercent: string;
}

export type DetailTab = "detail" | "checklists" | "notes" | "history" | "attachments";

export interface TicketTimelineItem {
  id: string;
  at: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

export type TicketsListParams = {
  status?: string;
  priority?: string;
  ticket_type?: string;
  client_id?: string;
  assignee_id?: string;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "created_at" | "priority" | "status";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

// ─── Constants ────────────────────────────────────────────────────────

export const TICKET_DETAIL_SELECT =
  "id, ticket_code, client, client_id, requester, ticket_type, priority, status, source, assignee_id, software, notes, checklist, checklist_structure, created_at, updated_at, due_date, sla_deadline, sla_breached, sla_response_at, sla_response_due_at, sla_resolution_due_at, completed_at, device_id, model, billable_hours, hourly_rate, material_cost, labor_cost, total_cost, cost_notes, cost_currency, bundle_assignment_id, bundle_extra_hours, bundle_extra_amount, onsite_visit, device:devices(id, model, serial, os, assigned_to, status), assignee:profiles!tickets_assignee_id_fkey(full_name, initials)";

const PRIORITY_ORDER: Record<string, number> = { high: 0, med: 1, low: 2 };
const STATUS_ORDER: Record<string, number> = { pending: 0, "in-progress": 1, testing: 2, ready: 3, completed: 4, archived: 5 };

const TICKET_LIST_SELECT =
  "id, ticket_code, client, client_id, requester, ticket_type, priority, source, status, created_at, updated_at, due_date, sla_deadline, sla_breached, sla_response_at, assignee_id, completed_at, client_ref:clients(name), device:devices(model, serial, os), assignee:profiles!tickets_assignee_id_fkey(full_name, initials)";

const ARCHIVED_TICKET_LIST_SELECT =
  "id, ticket_code, client, client_id, requester, ticket_type, priority, status, created_at, completed_at, client_ref:clients(name), device:devices(model, serial, os), assignee:profiles!tickets_assignee_id_fkey(full_name, initials)";

// ─── Fetch: Client / Contact / Device options ─────────────────────────

export async function loadClientOptions(query: string) {
  let request = supabase.from("clients").select("id, name, company_name, email").order("name");
  const term = query.trim().replace(/[,%]/g, "");
  if (term) request = request.or(`name.ilike.%${term}%,company_name.ilike.%${term}%,email.ilike.%${term}%`);
  const { data, error } = await request.range(0, 19);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchClientById(id: string) {
  if (!id) return null;
  const { data, error } = await supabase.from("clients").select("id, name, company_name, email").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function loadContactOptions(query: string, clientId: string) {
  if (!clientId) return [];
  const term = query.trim().replace(/[,%]/g, "");
  let request = supabase.from("client_contacts").select("id, client_id, full_name, first_name, last_name, email, job_title, role, is_primary").eq("client_id", clientId).order("is_primary", { ascending: false }).order("full_name");
  if (term) request = request.or(`full_name.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,job_title.ilike.%${term}%,role.ilike.%${term}%`);
  const { data, error } = await request.range(0, 19);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchContactById(id: string) {
  if (!id) return null;
  const { data, error } = await supabase.from("client_contacts").select("id, client_id, full_name, first_name, last_name, email, job_title, role, is_primary").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function loadDeviceOptions(query: string, clientId: string) {
  if (!clientId) return [];
  const term = query.trim().replace(/[,%]/g, "");
  let request = supabase.from("devices").select("id, client_id, model, serial, os, assigned_to").eq("client_id", clientId).order("model");
  if (term) request = request.or(`model.ilike.%${term}%,serial.ilike.%${term}%,assigned_to.ilike.%${term}%`);
  const { data, error } = await request.range(0, 19);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchDeviceById(id: string) {
  if (!id) return null;
  const { data, error } = await supabase.from("devices").select("id, client_id, model, serial, os, assigned_to").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// ─── Fetch: Ticket detail ────────────────────────────────────────────

export async function fetchTicketById(id: string) {
  if (!id) return null;
  const { data, error } = await supabase.from("tickets").select(TICKET_DETAIL_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchTicketAssignments(id: string) {
  if (!id) return [];
  const { data, error } = await supabase.from("ticket_device_assignments").select("id, assigned_at, unassigned_at, notes, device:devices(id, model, serial)").eq("ticket_id", id).order("assigned_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchTicketAssignmentHistory(id: string) {
  if (!id) return [];
  const { data, error } = await supabase.from("ticket_device_assignment_history").select("id, action, occurred_at, actor_id, notes, changed_fields, device:devices(model, serial)").eq("ticket_id", id).order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function fetchTicketStatusHistory(id: string) {
  if (!id) return [];
  const { data, error } = await supabase.from("ticket_status_history").select("id, ticket_id, from_status, to_status, changed_at, changed_by, note").eq("ticket_id", id).order("changed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any[];
}

// ─── Fetch: Ticket list ──────────────────────────────────────────────

function buildTicketsQuery(params: TicketsListParams, opts?: { count?: boolean }) {
  let query = supabase.from("tickets").select(TICKET_LIST_SELECT, opts?.count ? { count: "exact" } : undefined).not("status", "eq", "archived" as any);
  const sortBy = params.sortBy ?? "created_at";
  const sortDir = params.sortDir ?? "desc";
  if (sortBy === "priority") query = query.order("priority", { ascending: sortDir === "asc" });
  else if (sortBy === "status") query = query.order("status", { ascending: sortDir === "asc" });
  else query = query.order("created_at", { ascending: sortDir === "asc" });
  if (params.status && params.status !== "archived") query = query.eq("status", params.status as any);
  if (params.priority) query = query.eq("priority", params.priority as any);
  if (params.ticket_type) query = query.eq("ticket_type", params.ticket_type as any);
  if (params.client_id) query = query.eq("client_id", params.client_id as any);
  if (params.assignee_id) query = query.eq("assignee_id", params.assignee_id as any);
  if (params.dateFrom) query = query.gte("created_at", params.dateFrom);
  if (params.dateTo) query = query.lte("created_at", params.dateTo + "T23:59:59.999Z");
  const q = (params.q || "").trim().replace(/[,%]/g, "");
  if (q) query = query.or(`ticket_code.ilike.%${q}%,requester.ilike.%${q}%`);
  return { query, sortBy, sortDir };
}

function applyClientSideSort<T extends Record<string, any>>(data: T[], sortBy: string, sortDir: string): T[] {
  if (sortBy === "priority") {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => ((PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)) * dir);
  } else if (sortBy === "status") {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => ((STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)) * dir);
  }
  return data;
}

import { LIST_PAGE_SIZE } from "@/lib/queries/list-config";

export async function fetchTicketsList(params: TicketsListParams) {
  const PAGE_SIZE = params.pageSize ?? LIST_PAGE_SIZE;
  const page = params.page ?? 0;
  const { query, sortBy, sortDir } = buildTicketsQuery(params, { count: true });
  const { data, count, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (error) throw error;
  return { data: applyClientSideSort(data ?? [], sortBy, sortDir), count: count ?? 0 };
}

export async function fetchAllTicketsList(params: TicketsListParams) {
  const { query, sortBy, sortDir } = buildTicketsQuery(params, { count: true });
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: applyClientSideSort(data ?? [], sortBy, sortDir), count: count ?? 0 };
}

export async function fetchArchivedTicketsList(params: { page?: number; pageSize?: number }) {
  const PAGE_SIZE = params.pageSize ?? LIST_PAGE_SIZE;
  const page = params.page ?? 0;
  const { data, count, error } = await supabase.from("tickets").select(ARCHIVED_TICKET_LIST_SELECT, { count: "exact" }).eq("status", "archived" as any).order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (error) throw error;
  return { data: (data ?? []) as any[], count: count ?? 0 };
}

export async function fetchStatusChangeTimestamps(ticketIds: string[]): Promise<Map<string, string>> {
  if (!ticketIds.length) return new Map();
  const { data, error } = await supabase.from("ticket_status_history").select("ticket_id, changed_at").in("ticket_id", ticketIds).order("changed_at", { ascending: false });
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) { if (!map.has(row.ticket_id)) map.set(row.ticket_id, row.changed_at); }
  return map;
}

// ─── Mutations ───────────────────────────────────────────────────────

export async function addTicketStatusHistory(ticketId: string, payload: any) {
  const record = { ticket_id: ticketId, ...payload };
  const { error } = await supabase.from("ticket_status_history").insert(record);
  if (error) throw error;
  return true;
}
