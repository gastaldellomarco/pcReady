import { useMutation, useQuery, useQueryClient, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { LIST_PAGE_SIZE, LIST_QUERY_GC_MS, LIST_QUERY_STALE_MS } from "./list-config";
import {
  fetchAllAssignedDeviceIds,
  fetchDevicesList,
  fetchDevicesListCursor,
  fetchAllDevicesList,
  fetchDeviceBySerial,
  createDevice,
  createDevicesBulk,
  type DevicesListParams,
} from "@/lib/data/inventory";

// ── Re-export types ──────────────────────────────────────────────────
export type { DevicesListParams };

// ── Re-export raw fetch/mutation functions ───────────────────────────
export {
  fetchAllAssignedDeviceIds,
  fetchDevicesList,
  fetchDevicesListCursor,
  fetchAllDevicesList,
  fetchDeviceBySerial,
  createDevice,
  createDevicesBulk,
};

// ── Hooks ────────────────────────────────────────────────────────────

export function useAllAssignedDeviceIds(enabled: boolean) {
  return useQuery({
    queryKey: ["inventory", "assigned-device-ids"],
    queryFn: fetchAllAssignedDeviceIds,
    enabled,
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
  });
}

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
    placeholderData: keepPreviousData,
  });
}

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
      fetchDevicesListCursor({
        ...params,
        cursor: pageParam as string | undefined,
        assignedIdsForFilter: needsAssignedFilter ? assignedQuery.data : undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: !needsAssignedFilter || assignedQuery.isSuccess,
    staleTime: LIST_QUERY_STALE_MS,
    gcTime: LIST_QUERY_GC_MS,
    placeholderData: keepPreviousData,
  });
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

// ── Default export — backward compatible ─────────────────────────────

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
