import { useQuery } from "@tanstack/react-query";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DashboardRange = { from: string; to: string };

type ProfilesEmbed = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "full_name" | "initials"
>;

export type DashboardDeviceRow = Pick<
  Database["public"]["Tables"]["devices"]["Row"],
  | "id"
  | "model"
  | "serial"
  | "created_at"
  | "status"
  | "client_id"
  | "assigned_to"
  | "purchase_date"
  | "warranty_expiry_date"
  | "warranty_type"
  | "warranty_provider"
>;

export type DashboardTicketRow = Pick<
  Database["public"]["Tables"]["tickets"]["Row"],
  "id" | "ticket_code" | "client" | "status" | "priority" | "created_at"
> & {
  device: { model: string; serial: string | null } | null;
  assignee: ProfilesEmbed | null;
};

export type DashboardLogRow = Pick<
  Database["public"]["Tables"]["activity_log"]["Row"],
  "id" | "type" | "message" | "created_at"
> & {
  actor: ProfilesEmbed | null;
};

export type DashboardAssignmentRow = Pick<
  Database["public"]["Tables"]["ticket_device_assignments"]["Row"],
  "device_id"
>;

export type DashboardSnapshot = {
  tickets: DashboardTicketRow[];
  logs: DashboardLogRow[];
  devices: DashboardDeviceRow[];
  recentDevices: DashboardDeviceRow[];
  devicesWithoutTicket: DashboardDeviceRow[];
  warrantyDevices: DashboardDeviceRow[];
  ticketsWithoutDeviceCount: number;
  activeClientsCount: number;
};

const DEVICE_PAGE_SIZE = 1000;
const DEVICE_FETCH_CAP = 100_000;

function throwIfError(context: string, error: PostgrestError | null): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function fetchDevicesInRange(from: string, to: string): Promise<DashboardDeviceRow[]> {
  const out: DashboardDeviceRow[] = [];
  let offset = 0;
  for (;;) {
    const res = await supabase
      .from("devices")
      .select(
        "id, model, serial, created_at, status, client_id, assigned_to, purchase_date, warranty_expiry_date, warranty_type, warranty_provider",
      )
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false })
      .range(offset, offset + DEVICE_PAGE_SIZE - 1);
    throwIfError("devices", res.error);
    const chunk: DashboardDeviceRow[] = (res.data ?? []) as DashboardDeviceRow[];
    out.push(...chunk);
    if (chunk.length < DEVICE_PAGE_SIZE) break;
    offset += DEVICE_PAGE_SIZE;
    if (offset >= DEVICE_FETCH_CAP) break;
  }
  return out;
}

async function fetchWarrantyDevices(): Promise<DashboardDeviceRow[]> {
  const out: DashboardDeviceRow[] = [];
  let offset = 0;
  for (;;) {
    const res = await supabase
      .from("devices")
      .select(
        "id, model, serial, created_at, status, client_id, assigned_to, purchase_date, warranty_expiry_date, warranty_type, warranty_provider",
      )
      .order("warranty_expiry_date", { ascending: true, nullsFirst: false })
      .range(offset, offset + DEVICE_PAGE_SIZE - 1);
    throwIfError("devices warranties", res.error);
    const chunk = (res.data ?? []) as DashboardDeviceRow[];
    out.push(...chunk);
    if (chunk.length < DEVICE_PAGE_SIZE) break;
    offset += DEVICE_PAGE_SIZE;
    if (offset >= DEVICE_FETCH_CAP) break;
  }
  return out;
}

export async function fetchDashboardSnapshot(range: DashboardRange): Promise<DashboardSnapshot> {
  const from = range.from;
  const to = range.to;

  const [tRes, lRes, aRes] = await Promise.all([
    supabase
      .from("tickets")
      .select(
        "id, ticket_code, client, status, priority, created_at, device:devices(model, serial), assignee:profiles!tickets_assignee_id_fkey(full_name, initials)",
      )
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_log")
      .select(
        "id, type, message, created_at, actor:profiles!activity_log_actor_id_fkey(full_name, initials)",
      )
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("ticket_device_assignments").select("device_id").is("unassigned_at", null),
  ]);

  throwIfError("tickets", tRes.error);
  throwIfError("activity_log", lRes.error);
  throwIfError("ticket_device_assignments", aRes.error);

  const [devices, warrantyDevices] = await Promise.all([
    fetchDevicesInRange(from, to),
    fetchWarrantyDevices(),
  ]);

  const tickets: DashboardTicketRow[] = (tRes.data ?? []) as DashboardTicketRow[];
  const logs: DashboardLogRow[] = (lRes.data ?? []) as DashboardLogRow[];
  const assignments: DashboardAssignmentRow[] = (aRes.data ?? []) as DashboardAssignmentRow[];

  const assignedIds = new Set(assignments.map((r) => r.device_id));
  const recentDevices = devices.slice(0, 6);
  const devicesWithoutTicket = devices.filter(
    (dev) => !assignedIds.has(dev.id) && dev.status !== "retired",
  );
  const ticketsWithoutDeviceCount = tickets.filter(
    (tt) => !tt.device && (tt.status as string) !== "archived" && tt.status !== "ready",
  ).length;
  const activeClients = new Set(tickets.map((tt) => tt.client).filter(Boolean));

  return {
    tickets,
    logs,
    devices,
    recentDevices,
    devicesWithoutTicket,
    warrantyDevices,
    ticketsWithoutDeviceCount,
    activeClientsCount: activeClients.size,
  };
}

export function useDashboardSnapshot(range: DashboardRange) {
  return useQuery({
    queryKey: ["dashboard", range.from, range.to],
    queryFn: () => fetchDashboardSnapshot(range),
    placeholderData: (previousData) => previousData,
  });
}

export default { fetchDashboardSnapshot, useDashboardSnapshot };
