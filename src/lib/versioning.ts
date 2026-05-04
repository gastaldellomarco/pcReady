import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any;

export type VersionOperation = "create" | "update" | "restore" | "delete";

export interface Version {
  id: string;
  entity_type: string;
  entity_id: string;
  version_number: number;
  operation: VersionOperation;
  snapshot: Record<string, unknown>;
  previous_snapshot?: Record<string, unknown>;
  changed_fields?: Record<string, { from: unknown; to: unknown }>;
  change_note?: string;
  created_at: string;
  created_by: string | null;
  app_version?: string | null;
  request_id?: string | null;
}

export interface DiffResult {
  added: Record<string, unknown>;
  removed: Record<string, unknown>;
  changed: Record<string, { old: unknown; new: unknown }>;
}

export interface CreateVersionParams {
  entityType: string;
  entityId: string;
  operation: VersionOperation;
  snapshot: Record<string, unknown>;
  previousSnapshot?: Record<string, unknown> | null;
  changedFields?: Record<string, { from: unknown; to: unknown }> | null;
  changeNote?: string;
  userId?: string;
  requestId?: string;
  appVersion?: string;
}

function isEqualValue(a: unknown, b: unknown) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

export function computeChangedFields(
  previous: Record<string, unknown> | null,
  current: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  const previousKeys = previous ? Object.keys(previous) : [];
  const currentKeys = Object.keys(current);
  const allKeys = Array.from(new Set([...previousKeys, ...currentKeys]));

  for (const key of allKeys) {
    const from = previous?.[key];
    const to = current[key];

    if (!isEqualValue(from, to)) {
      changed[key] = { from, to };
    }
  }

  return changed;
}

export async function getNextVersionNumber(entityType: string, entityId: string): Promise<number> {
  const { data, error } = await supabaseAny
    .from("entity_versions")
    .select("version_number")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("version_number", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.version_number || 0;
}

export async function getLatestVersionNumber(
  entityType: string,
  entityId: string,
): Promise<number> {
  return getNextVersionNumber(entityType, entityId);
}

export async function createVersionSnapshot({
  entityType,
  entityId,
  operation,
  snapshot,
  previousSnapshot = null,
  changedFields,
  changeNote,
  userId,
  requestId,
  appVersion,
}: CreateVersionParams): Promise<number> {
  const versionNumber = (await getNextVersionNumber(entityType, entityId)) + 1;
  const computedChangedFields = changedFields ?? computeChangedFields(previousSnapshot, snapshot);

  const effectiveRequestId =
    requestId || (typeof crypto !== "undefined" ? crypto.randomUUID() : undefined);
  const effectiveUserId = userId || (await supabase.auth.getUser()).data.user?.id || null;

  const { error } = await supabaseAny.from("entity_versions").insert({
    entity_type: entityType,
    entity_id: entityId,
    version_number: versionNumber,
    operation,
    snapshot,
    previous_snapshot: previousSnapshot,
    changed_fields: computedChangedFields,
    change_note: changeNote,
    created_by: effectiveUserId,
    app_version: appVersion ?? import.meta.env.VITE_APP_VERSION ?? null,
    request_id: effectiveRequestId ?? null,
  });

  if (error) {
    console.error("Error creating version snapshot:", error);
    throw error;
  }

  return versionNumber;
}

export async function createVersion(
  entityType: string,
  entityId: string,
  snapshot: Record<string, unknown>,
  changedFields?: Record<string, { from: unknown; to: unknown }>,
  changeNote?: string,
  operation: VersionOperation = "update",
): Promise<void> {
  await createVersionSnapshot({
    entityType,
    entityId,
    operation,
    snapshot,
    previousSnapshot: null,
    changedFields,
    changeNote,
  });
}

/**
 * Get all versions for an entity, ordered by version number desc
 */
export async function getVersions(entityType: string, entityId: string): Promise<Version[]> {
  try {
    const { data, error } = await supabaseAny
      .from("entity_versions")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("version_number", { ascending: false });

    if (error) {
      console.error("Error fetching versions:", error);
      throw error;
    }
    return data as unknown as Version[];
  } catch (err) {
    console.error("Failed to get versions:", err);
    return []; // Return empty array instead of throwing
  }
}

export function compareVersions(v1: Version, v2: Version): DiffResult {
  const result: DiffResult = { added: {}, removed: {}, changed: {} };

  const keys1 = Object.keys(v1.snapshot || {});
  const keys2 = Object.keys(v2.snapshot || {});

  for (const key of keys2) {
    if (!keys1.includes(key)) {
      result.added[key] = v2.snapshot[key];
    }
  }

  for (const key of keys1) {
    if (!keys2.includes(key)) {
      result.removed[key] = v1.snapshot[key];
    }
  }

  for (const key of keys1) {
    if (keys2.includes(key) && !isEqualValue(v1.snapshot[key], v2.snapshot[key])) {
      result.changed[key] = { old: v1.snapshot[key], new: v2.snapshot[key] };
    }
  }

  return result;
}

export async function restoreEntityVersion(
  entityType: string,
  entityId: string,
  targetVersionNumber: number,
  restoreNote?: string,
  userId?: string,
): Promise<number> {
  const { data: versionData, error: versionError } = await supabaseAny
    .from("entity_versions")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("version_number", targetVersionNumber)
    .single();

  if (versionError || !versionData) {
    throw versionError || new Error("Versione non trovata");
  }

  const { data: currentData, error: currentError } = await supabaseAny
    .from(entityType)
    .select("*")
    .eq("id", entityId)
    .single();

  if (currentError) throw currentError;

  const snapshot = versionData.snapshot;
  const restorePayload = { ...snapshot } as Record<string, unknown>;
  delete restorePayload.id;

  const { error: updateError } = await supabaseAny
    .from(entityType)
    .update(restorePayload)
    .eq("id", entityId);

  if (updateError) throw updateError;

  return createVersionSnapshot({
    entityType,
    entityId,
    operation: "restore",
    snapshot,
    previousSnapshot: currentData ?? null,
    changeNote: restoreNote || `Restored to version ${targetVersionNumber}`,
    userId,
  });
}

export async function restoreVersion(
  entityType: string,
  entityId: string,
  version: Version,
  changeNote?: string,
): Promise<number> {
  return restoreEntityVersion(entityType, entityId, version.version_number, changeNote);
}
