import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LIST_PAGE_SIZE, LIST_QUERY_GC_MS, LIST_QUERY_STALE_MS } from "./list-config";
import type { WarrantyFilter } from "@/lib/warranty";

/**
 *
 */
export type DevicesListParams = {
  status?: string;
  os?: string;
  category?: string;
  deviceType?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  withoutTicket?: boolean;
  updatedBefore?: string;
  updatedAfter?: string;
  client_id?: string;
  warrantyStatus?: WarrantyFilter;
  maintenanceDueSoon?: boolean;
  /** Cached device ids with an active ticket assignment (for withoutTicket filter). */
  assignedIdsForFilter?: string[];
};

/**
 *
 */
export async function fetchAllAssignedDeviceIds() {
  const { data, error } = await supabase
    .from("ticket_device_assignments")
    .select("device_id")
    .is("unassigned_at", null);
  if (error) throw error;
  return ((data ?? []) as Array<{ device_id: string }>)
    .map((r) => r.device_id)
    .filter(Boolean) as string[];
}

async function fetchActiveAssignmentsForDeviceIds(deviceIds: string[]) {
  if (!deviceIds.length) return new Set<string>();
  const { data, error } = await supabase
    .from("ticket_device_assignments")
    .select("device_id")
    .in("device_id", deviceIds)
    .is("unassigned_at", null);
  if (error) throw error;
  return new Set(
    ((data ?? []) as Array<{ device_id: string }>).map((r) => r.device_id).filter(Boolean),
  );
}

/**
 *
 */
export function useAllAssignedDeviceIds(enabled: boolean) {
  return useQuery({
    queryKey: ["inventory", "assigned-device-ids"],
    queryFn: fetchAllAssignedDeviceIds,
    enabled,
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
  });
}

/**
 * Fetch ALL matching devices without pagination (for PDF export).
 * Reuses the same filtering logic as fetchDevicesList but omits .range().
 */
export async function fetchAllDevicesList(params: DevicesListParams) {
  let dueMaintenanceDeviceIds: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if (params.maintenanceDueSoon) {
    const { data: dueRows, error: dueError } = await (supabase as any)
      .from("maintenance_schedules")
      .select("device_id")
      .gte("next_due_date", today)
      .lte("next_due_date", in30Days);
    if (dueError && dueError.code !== "42P01") throw dueError;
    dueMaintenanceDeviceIds = [
      ...new Set(((dueRows ?? []) as Array<{ device_id: string }>).map((row) => row.device_id)),
    ];
    if (!dueMaintenanceDeviceIds.length) return { data: [], count: 0 };
  }

  let query = supabase
    .from("devices")
    .select(
      "id, asset_tag, serial, model, os, status, category, device_type, client_id, updated_at, assigned_to, purchase_date, warranty_expiry_date, warranty_type, warranty_provider, warranty_notes, client:clients(name)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status as any);
  if (params.os) query = query.eq("os", params.os as any);
  if (params.category) query = query.eq("category", params.category as any);
  if (params.deviceType) query = query.eq("device_type", params.deviceType as any);
  const term = (params.q || "").trim().replace(/[,%]/g, "");
  if (term)
    query = query.or(
      `asset_tag.ilike.%${term}%,serial.ilike.%${term}%,model.ilike.%${term}%,assigned_to.ilike.%${term}%,device_type.ilike.%${term}%`,
    );

  const assignedIdsForFilter = params.assignedIdsForFilter;
  if (params.withoutTicket && assignedIdsForFilter?.length) {
    query = query.not("id", "in", `(${assignedIdsForFilter.join(",")})`);
  }
  if (params.maintenanceDueSoon && dueMaintenanceDeviceIds.length) {
    query = query.in("id", dueMaintenanceDeviceIds as any);
  }

  if (params.updatedBefore) {
    query = query.lt("updated_at", params.updatedBefore);
  }
  if (params.updatedAfter) {
    query = query.gt("updated_at", params.updatedAfter);
  }
  if (params.client_id) {
    query = query.eq("client_id", params.client_id as any);
  }

  const warrantyStatus = params.warrantyStatus;
  if (warrantyStatus && warrantyStatus !== "all") {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    if (warrantyStatus === "missing") query = query.is("warranty_expiry_date", null);
    if (warrantyStatus === "expired") query = query.lt("warranty_expiry_date", today);
    if (warrantyStatus === "urgent")
      query = query.gte("warranty_expiry_date", today).lte("warranty_expiry_date", in30);
    if (warrantyStatus === "expiring")
      query = query.gt("warranty_expiry_date", in30).lte("warranty_expiry_date", in90);
    if (warrantyStatus === "valid") query = query.gt("warranty_expiry_date", in90);
  }

  // No .range() — fetches all matching rows
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: (data ?? []) as any[], count: count ?? 0 };
}

/**
 *
 */
export async function fetchDevicesList(params: DevicesListParams) {
  const PAGE_SIZE = params.pageSize ?? LIST_PAGE_SIZE;
  const page = params.page ?? 0;
  let dueMaintenanceDeviceIds: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if (params.maintenanceDueSoon) {
    const { data: dueRows, error: dueError } = await (supabase as any)
      .from("maintenance_schedules")
      .select("device_id")
      .gte("next_due_date", today)
      .lte("next_due_date", in30Days);
    if (dueError && dueError.code !== "42P01") throw dueError;
    dueMaintenanceDeviceIds = [
      ...new Set(((dueRows ?? []) as Array<{ device_id: string }>).map((row) => row.device_id)),
    ];
    if (!dueMaintenanceDeviceIds.length) return { data: [], count: 0 };
  }

  let query = supabase
    .from("devices")
    .select(
      "id, asset_tag, serial, model, os, status, category, device_type, client_id, updated_at, assigned_to, purchase_date, warranty_expiry_date, warranty_type, warranty_provider, warranty_notes, client:clients(name)",
      { count: "exact" },
    )
    .order("updated_at", { ascending: false });

  if (params.status) query = query.eq("status", params.status as any);
  if (params.os) query = query.eq("os", params.os as any);
  if (params.category) query = query.eq("category", params.category as any);
  if (params.deviceType) query = query.eq("device_type", params.deviceType as any);
  const term = (params.q || "").trim().replace(/[,%]/g, "");
  if (term)
    query = query.or(
      `asset_tag.ilike.%${term}%,serial.ilike.%${term}%,model.ilike.%${term}%,assigned_to.ilike.%${term}%,device_type.ilike.%${term}%`,
    );

  const assignedIdsForFilter = params.assignedIdsForFilter;
  if (params.withoutTicket && assignedIdsForFilter?.length) {
    query = query.not("id", "in", `(${assignedIdsForFilter.join(",")})`);
  }
  if (params.maintenanceDueSoon && dueMaintenanceDeviceIds.length) {
    query = query.in("id", dueMaintenanceDeviceIds as any);
  }

  if (params.updatedBefore) {
    query = query.lt("updated_at", params.updatedBefore);
  }
  if (params.updatedAfter) {
    query = query.gt("updated_at", params.updatedAfter);
  }
  if (params.client_id) {
    query = query.eq("client_id", params.client_id as any);
  }

  const warrantyStatus = params.warrantyStatus;
  if (warrantyStatus && warrantyStatus !== "all") {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    if (warrantyStatus === "missing") query = query.is("warranty_expiry_date", null);
    if (warrantyStatus === "expired") query = query.lt("warranty_expiry_date", today);
    if (warrantyStatus === "urgent")
      query = query.gte("warranty_expiry_date", today).lte("warranty_expiry_date", in30);
    if (warrantyStatus === "expiring")
      query = query.gt("warranty_expiry_date", in30).lte("warranty_expiry_date", in90);
    if (warrantyStatus === "valid") query = query.gt("warranty_expiry_date", in90);
  }

  const { data, count, error } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
  if (error) throw error;
  const pageIds = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
  const assignedSet = await fetchActiveAssignmentsForDeviceIds(pageIds);
  let dueByDevice = new Map<string, string>();
  if (pageIds.length) {
    const { data: dueRows } = await (supabase as any)
      .from("maintenance_schedules")
      .select("device_id, next_due_date")
      .in("device_id", pageIds)
      .gte("next_due_date", today)
      .lte("next_due_date", in30Days)
      .order("next_due_date", { ascending: true });
    dueByDevice = new Map(
      ((dueRows ?? []) as Array<{ device_id: string; next_due_date: string }>).map((row) => [
        row.device_id,
        row.next_due_date,
      ]),
    );
  }
  const rows = (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    has_active_assignment: assignedSet.has(row.id as string),
    has_maintenance_due_soon: dueByDevice.has(row.id as string),
    next_maintenance_due_date: dueByDevice.get(row.id as string) ?? null,
  }));
  return { data: rows as any[], count: count ?? 0 };
}

/**
 *
 */
export function useInventoryList(params: DevicesListParams) {
  const needsAssignedFilter = !!params.withoutTicket;
  const assignedQuery = useAllAssignedDeviceIds(needsAssignedFilter);

  return useQuery({
    queryKey: [
      "inventory",
      params.status || "",
      params.os || "",
      params.category || "",
      params.deviceType || "",
      params.q || "",
      params.page ?? 0,
      params.pageSize ?? LIST_PAGE_SIZE,
      params.withoutTicket ? "without" : "",
      params.updatedBefore || "",
      params.updatedAfter || "",
      params.client_id || "",
      params.warrantyStatus || "all",
      params.maintenanceDueSoon ? "maintenance-due" : "",
      needsAssignedFilter ? assignedQuery.dataUpdatedAt : 0,
    ],
    queryFn: () =>
      fetchDevicesList({
        ...params,
        assignedIdsForFilter: needsAssignedFilter ? assignedQuery.data : undefined,
      }),
    enabled: !needsAssignedFilter || assignedQuery.isSuccess,
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
    placeholderData: (previousData) => previousData,
  });
}

/**
 *
 */
export async function fetchDeviceBySerial(serial: string) {
  const { data, error } = await supabase
    .from("devices")
    .select("id, asset_tag, serial")
    .or(
      `asset_tag.ilike.${serial.replace(/[,%]/g, "")},serial.ilike.${serial.replace(/[,%]/g, "")}`,
    )
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 *
 */
export async function createDevice(payload: Record<string, any>) {
  const { data, error } = await supabase
    .from("devices")
    .insert(payload as any)
    .select("id, asset_tag, serial")
    .single();
  if (error) throw error;
  return data;
}

/**
 *
 */
export async function createDevicesBulk(payloads: Record<string, any>[]) {
  if (!payloads || !payloads.length) return { inserted: 0 };
  const { data, error } = await supabase
    .from("devices")
    .insert(payloads as any)
    .select("id");
  if (error) throw error;
  return { inserted: Array.isArray(data) ? data.length : 0, data };
}

/**
 *
 */
export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, any>) => createDevice(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

/**
 *
 */
export function useCreateDevicesBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payloads: Record<string, any>[]) => createDevicesBulk(payloads),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory"] }),
  });
}

/**
 *
 */
export function useInventoryInfiniteList(params: DevicesListParams) {
  const needsAssignedFilter = !!params.withoutTicket;
  const assignedQuery = useAllAssignedDeviceIds(needsAssignedFilter);

  return useInfiniteQuery({
    queryKey: [
      "inventory",
      "infinite",
      params.status || "",
      params.os || "",
      params.category || "",
      params.deviceType || "",
      params.q || "",
      params.withoutTicket ? "without" : "",
      params.updatedBefore || "",
      params.updatedAfter || "",
      params.client_id || "",
      params.warrantyStatus || "all",
      params.maintenanceDueSoon ? "maintenance-due" : "",
      needsAssignedFilter ? assignedQuery.dataUpdatedAt : 0,
    ],
    queryFn: ({ pageParam }) =>
      fetchDevicesList({
        ...params,
        page: pageParam as number,
        assignedIdsForFilter: needsAssignedFilter ? assignedQuery.data : undefined,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.data.length === (params.pageSize ?? LIST_PAGE_SIZE) ? allPages.length : undefined,
    initialPageParam: 0,
    enabled: !needsAssignedFilter || assignedQuery.isSuccess,
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
    placeholderData: (previousData) => previousData,
  });
}

export default {
  fetchAllAssignedDeviceIds,
  useAllAssignedDeviceIds,
  fetchDevicesList,
  fetchAllDevicesList,
  useInventoryList,
  useInventoryInfiniteList,
  fetchDeviceBySerial,
  createDevice,
  createDevicesBulk,
  useCreateDevice,
  useCreateDevicesBulk,
};
