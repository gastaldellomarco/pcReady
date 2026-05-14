import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DevicesListParams = {
  status?: string;
  os?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  withoutTicket?: boolean;
};

export async function fetchAssignedDeviceIds() {
  const { data, error } = await supabase
    .from("ticket_device_assignments")
    .select("device_id")
    .is("unassigned_at", null);
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => r.device_id).filter(Boolean) as string[];
}

export async function fetchDevicesList(params: DevicesListParams) {
  const PAGE_SIZE = params.pageSize ?? 50;
  const page = params.page ?? 0;

  let assignedIds: string[] = [];
  if (params.withoutTicket) {
    const ids = await fetchAssignedDeviceIds();
    assignedIds = ids;
  }

  let query = supabase
    .from("devices")
    .select(
      "id, serial, model, os, status, client_id, updated_at, assigned_to, client:clients(name)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status as any);
  if (params.os) query = query.eq("os", params.os as any);
  const term = (params.q || "").trim().replace(/[,%]/g, "");
  if (term)
    query = query.or(`serial.ilike.%${term}%,model.ilike.%${term}%,assigned_to.ilike.%${term}%`);

  if (params.withoutTicket && assignedIds.length) {
    query = query.not("id", "in", `(${assignedIds.map((id) => `'${id}'`).join(",")})`);
  }

  const { data, count, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (error) throw error;
  return { data: (data ?? []) as any[], count: count ?? 0 };
}

export function useInventoryList(params: DevicesListParams) {
  return useQuery({
    queryKey: [
      "inventory",
      params.status || "",
      params.os || "",
      params.q || "",
      params.page ?? 0,
      params.pageSize ?? 50,
      params.withoutTicket ? "without" : "",
    ],
    queryFn: () => fetchDevicesList(params),
    placeholderData: (previousData) => previousData,
  });
}

export async function fetchDeviceBySerial(serial: string) {
  const { data, error } = await supabase
    .from("devices")
    .select("id, serial")
    .ilike("serial", serial)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function createDevice(payload: Record<string, any>) {
  const { data, error } = await supabase
    .from("devices")
    .insert(payload as any)
    .select("id, serial")
    .single();
  if (error) throw error;
  return data;
}

export async function createDevicesBulk(payloads: Record<string, any>[]) {
  if (!payloads || !payloads.length) return { inserted: 0 };
  const { data, error } = await supabase
    .from("devices")
    .insert(payloads as any)
    .select("id");
  if (error) throw error;
  return { inserted: Array.isArray(data) ? data.length : 0, data };
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) => createDevice(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export function useCreateDevicesBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payloads: Record<string, any>[]) => createDevicesBulk(payloads),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

export default {
  fetchAssignedDeviceIds,
  fetchDevicesList,
  useInventoryList,
  fetchDeviceBySerial,
  createDevice,
  createDevicesBulk,
  useCreateDevice,
  useCreateDevicesBulk,
};
