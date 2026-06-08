import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

/**
 *
 */
export interface DeviceSoftware {
  id: string;
  device_id: string;
  software_name: string;
  version: string;
  publisher: string | null;
  install_date: string | null;
  last_seen_at: string;
  first_seen_at: string;
  /** Populated via join from software_catalog */
  latest_version?: string | null;
}

/**
 *
 */
export interface SoftwareCatalogEntry {
  id: string;
  name: string;
  latest_version: string;
  publisher: string | null;
  category: string | null;
  updated_at: string;
}

// ── Queries ──

/**
 *
 */
export async function fetchDeviceSoftware(deviceId: string) {
  const { data, error } = await (supabase as any)
    .from("device_software")
    .select(`
      id, device_id, software_name, version, publisher, install_date,
      last_seen_at, first_seen_at
    `)
    .eq("device_id", deviceId)
    .order("software_name", { ascending: true });

  if (error) throw error;

  // Fetch catalog for latest versions
  const softwareNames = (data ?? []).map((s: DeviceSoftware) => s.software_name);
  const catalogMap: Map<string, string> = new Map();

  if (softwareNames.length) {
    const { data: catalogData, error: catalogError } = await (supabase as any)
      .from("software_catalog")
      .select("name, latest_version")
      .in("name", softwareNames);

    if (!catalogError && catalogData) {
      for (const entry of catalogData as { name: string; latest_version: string }[]) {
        catalogMap.set(entry.name, entry.latest_version);
      }
    }
  }

  return ((data ?? []) as DeviceSoftware[]).map((s) => ({
    ...s,
    latest_version: catalogMap.get(s.software_name) ?? null,
  }));
}

/**
 *
 */
export async function fetchSoftwareCatalog() {
  const { data, error } = await (supabase as any)
    .from("software_catalog")
    .select("id, name, latest_version, publisher, category, updated_at")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as SoftwareCatalogEntry[];
}

/**
 *
 */
export function useDeviceSoftware(deviceId: string | null | undefined) {
  return useQuery({
    queryKey: ["device-software", deviceId],
    queryFn: () => fetchDeviceSoftware(deviceId!),
    enabled: !!deviceId,
  });
}

/**
 *
 */
export function useSoftwareCatalog() {
  return useQuery({
    queryKey: ["software-catalog"],
    queryFn: fetchSoftwareCatalog,
  });
}

// ── Mutations: Device Software ──

/**
 *
 */
export async function upsertDeviceSoftware(params: {
  deviceId: string;
  softwareName: string;
  version?: string;
  publisher?: string;
  installDate?: string;
}) {
  const { deviceId, softwareName, version, publisher, installDate } = params;
  const { error } = await (supabase as any)
    .from("device_software")
    .upsert(
      {
        device_id: deviceId,
        software_name: softwareName,
        version: version ?? "unknown",
        publisher: publisher || null,
        install_date: installDate || null,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: "device_id, software_name",
        ignoreDuplicates: false,
      },
    );

  if (error) throw error;
  return true;
}

/**
 *
 */
export async function deleteDeviceSoftware(softwareId: string) {
  const { error } = await (supabase as any)
    .from("device_software")
    .delete()
    .eq("id", softwareId);

  if (error) throw error;
  return true;
}

// ── Mutations: Software Catalog ──

/**
 *
 */
export async function upsertSoftwareCatalog(entry: {
  name: string;
  latestVersion: string;
  publisher?: string;
  category?: string;
}) {
  const { error } = await (supabase as any)
    .from("software_catalog")
    .upsert(
      {
        name: entry.name,
        latest_version: entry.latestVersion,
        publisher: entry.publisher || null,
        category: entry.category || null,
      },
      { onConflict: "name" },
    );

  if (error) throw error;
  return true;
}

/**
 *
 */
export async function deleteSoftwareCatalog(entryId: string) {
  const { error } = await (supabase as any)
    .from("software_catalog")
    .delete()
    .eq("id", entryId);

  if (error) throw error;
  return true;
}

// ── Hooks ──

/**
 *
 */
export function useUpsertDeviceSoftware(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: Omit<Parameters<typeof upsertDeviceSoftware>[0], "deviceId">) =>
      upsertDeviceSoftware({ deviceId, ...vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["device-software", deviceId] });
    },
  });
}

/**
 *
 */
export function useDeleteDeviceSoftware(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDeviceSoftware,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["device-software", deviceId] });
    },
  });
}

/**
 *
 */
export function useUpsertSoftwareCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertSoftwareCatalog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["software-catalog"] });
    },
  });
}

/**
 *
 */
export function useDeleteSoftwareCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSoftwareCatalog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["software-catalog"] });
    },
  });
}
