import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LIFECYCLE_PHASES = [
  "warehouse",
  "configuration",
  "deployed",
  "repair",
  "decommissioned",
] as const;

export type LifecyclePhase = (typeof LIFECYCLE_PHASES)[number];

export const LIFECYCLE_PHASE_LABELS: Record<LifecyclePhase, string> = {
  warehouse: "In magazzino",
  configuration: "In configurazione",
  deployed: "Dispiegato",
  repair: "In riparazione",
  decommissioned: "Dismesso",
};

export interface LifecycleHistoryEntry {
  id: string;
  device_id: string;
  phase: LifecyclePhase;
  previous_phase: LifecyclePhase | null;
  changed_by: string | null;
  notes: string | null;
  changed_at: string;
  changer?: { display_name: string | null } | null;
}

export interface DeviceAttachment {
  id: string;
  device_id: string;
  lifecycle_phase: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  description: string | null;
  created_at: string;
  uploader?: { full_name: string | null; initials: string | null } | null;
}

// ── Queries ──

export async function fetchDeviceLifecycleHistory(deviceId: string) {
  const { data, error } = await (supabase as any)
    .from("device_lifecycle_history")
    .select("*, changer:profiles!device_lifecycle_history_changed_by_fkey(display_name)")
    .eq("device_id", deviceId)
    .order("changed_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as LifecycleHistoryEntry[];
}

export async function fetchDeviceAttachments(deviceId: string) {
  const { data, error } = await (supabase as any)
    .from("device_attachments")
    .select("*, uploader:profiles!device_attachments_uploaded_by_fkey(full_name, initials)")
    .eq("device_id", deviceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DeviceAttachment[];
}

export function useDeviceLifecycleHistory(deviceId: string | null | undefined) {
  return useQuery({
    queryKey: ["device-lifecycle-history", deviceId],
    queryFn: () => fetchDeviceLifecycleHistory(deviceId!),
    enabled: !!deviceId,
  });
}

export function useDeviceAttachments(deviceId: string | null | undefined) {
  return useQuery({
    queryKey: ["device-attachments", deviceId],
    queryFn: () => fetchDeviceAttachments(deviceId!),
    enabled: !!deviceId,
  });
}

// ── Mutations ──

export async function transitionDevicePhase({
  deviceId,
  phase,
  previousPhase,
  userId,
  notes,
}: {
  deviceId: string;
  phase: LifecyclePhase;
  previousPhase: LifecyclePhase | null;
  userId: string;
  notes?: string;
}) {
  const { error } = await (supabase as any)
    .from("device_lifecycle_history")
    .insert({
      device_id: deviceId,
      phase,
      previous_phase: previousPhase,
      changed_by: userId,
      notes: notes || null,
    });

  if (error) throw error;
  return true;
}

export async function uploadDeviceAttachment({
  deviceId,
  phase,
  file,
  uploadedBy,
  description,
}: {
  deviceId: string;
  phase: string;
  file: File;
  uploadedBy?: string;
  description?: string;
}) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
  const path = `devices/${deviceId}/${phase}/${Date.now()}-${safeName}`;
  const bucket = "device-documents";

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await (supabase as any)
    .from("device_attachments")
    .insert({
      device_id: deviceId,
      lifecycle_phase: phase,
      storage_bucket: bucket,
      storage_path: path,
      file_name: safeName,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: uploadedBy || null,
      description: description || null,
    })
    .select("id")
    .single();

  if (error) {
    // Cleanup uploaded file on DB insert failure
    await supabase.storage.from(bucket).remove([path]);
    throw error;
  }
  return data;
}

export async function deleteDeviceAttachment(attachment: DeviceAttachment) {
  const bucket = attachment.storage_bucket || "device-documents";
  const { error: storageError } = await supabase.storage
    .from(bucket)
    .remove([attachment.storage_path]);
  if (storageError) throw storageError;

  const { error } = await (supabase as any)
    .from("device_attachments")
    .delete()
    .eq("id", attachment.id);
  if (error) throw error;
  return true;
}

export async function getDeviceAttachmentSignedUrl(attachment: DeviceAttachment) {
  const bucket = attachment.storage_bucket || "device-documents";
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(attachment.storage_path, 60 * 10, {
      download: attachment.file_name,
    });
  if (error) throw error;
  return data.signedUrl;
}

// ── Hooks ──

export function useTransitionDevicePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: transitionDevicePhase,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["device-lifecycle-history", vars.deviceId] });
    },
  });
}

export function useUploadDeviceAttachment(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { phase: string; file: File; uploadedBy?: string; description?: string }) =>
      uploadDeviceAttachment({ deviceId, ...vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["device-attachments", deviceId] });
    },
  });
}

export function useDeleteDeviceAttachment(deviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteDeviceAttachment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["device-attachments", deviceId] });
    },
  });
}
