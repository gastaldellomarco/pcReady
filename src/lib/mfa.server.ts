import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 *
 */
export type MfaBackupCodeStatus = {
  remaining: number;
  total: number;
  last_used_at: string | null;
};

/**
 *
 */
export type MfaAccessStatus = {
  required: boolean;
  graceExpired: boolean;
  graceEndsAt: string | null;
  requireAllUsers: boolean;
  requireAdmins: boolean;
  graceDays: number;
};

const BACKUP_CODE_TOTAL = 8;
const BACKUP_CODE_BYTES = 5;

async function hashBackupCode(userId: string, code: string) {
  const normalized = code.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
  return createHash("sha256").update(`${userId}:${normalized}`).digest("hex");
}

function formatBackupCode(raw: string) {
  return raw.match(/.{1,4}/g)?.join("-") ?? raw;
}

async function generateBackupCodes() {
  return Array.from({ length: BACKUP_CODE_TOTAL }, () =>
    formatBackupCode(randomBytes(BACKUP_CODE_BYTES).toString("hex").toUpperCase()),
  );
}

async function getUserFromToken(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Response("Non autenticato", { status: 401 });
  return data.user;
}

async function actorName(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return (data as any)?.full_name || "Utente";
}

async function getRole(userId: string) {
  const { data } = await supabaseAdmin.rpc("get_user_role", { _user_id: userId });
  return String(data || "viewer");
}

async function logMfaEvent(args: {
  userId: string;
  actionType: string;
  message: string;
  severity?: "info" | "warning" | "critical";
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
}) {
  const name = await actorName(args.userId);
  await supabaseAdmin.from("activity_log" as any).insert({
    type: "user",
    message: args.message,
    actor_id: args.userId,
    actor_name: name,
    action_type: args.actionType,
    entity_type: "mfa",
    entity_id: args.userId,
    old_value: args.oldValue ?? null,
    new_value: args.newValue ?? null,
    ip_address: args.ipAddress ?? null,
    severity: args.severity ?? "info",
  } as any);
}

async function readSettingsMap(keys: string[]) {
  const { data, error } = await supabaseAdmin
    .from("app_settings" as any)
    .select("key, value")
    .in("key", keys);
  if (error) throw error;
  const map = new Map<string, unknown>();
  for (const row of (data ?? []) as any[]) {
    let value = row.value;
    try {
      value = typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      // keep raw value
    }
    map.set(row.key, value);
  }
  return map;
}

/**
 *
 */
export async function getMfaPolicyForUser(
  userId: string,
  createdAt?: string | null,
): Promise<MfaAccessStatus> {
  const settings = await readSettingsMap([
    "mfa_require_admin_users",
    "mfa_require_all_users",
    "mfa_grace_period_days",
  ]);
  const role = await getRole(userId);
  const requireAllUsers = settings.get("mfa_require_all_users") === true;
  const requireAdmins = settings.get("mfa_require_admin_users") === true;
  const graceDaysRaw = Number(settings.get("mfa_grace_period_days") ?? 7);
  const graceDays = Number.isFinite(graceDaysRaw) ? Math.max(0, Math.min(365, graceDaysRaw)) : 7;
  const required = requireAllUsers || (requireAdmins && role === "admin");
  const base = createdAt ? new Date(createdAt) : new Date();
  const graceEnds = new Date(base.getTime() + graceDays * 24 * 60 * 60 * 1000);
  return {
    required,
    graceExpired: required && Date.now() > graceEnds.getTime(),
    graceEndsAt: required ? graceEnds.toISOString() : null,
    requireAllUsers,
    requireAdmins,
    graceDays,
  };
}

/**
 *
 */
export async function getMyMfaAccessStatusHandler(data: { accessToken: string }) {
  const user = await getUserFromToken(data.accessToken);
  return getMfaPolicyForUser(user.id, user.created_at ?? null);
}

/**
 *
 */
export async function getBackupCodeStatusHandler(data: { accessToken: string }) {
  const user = await getUserFromToken(data.accessToken);
  const { data: result, error } = await supabaseAdmin
    .from("user_mfa_backup_codes" as any)
    .select("used_at")
    .eq("user_id", user.id);
  if (error) throw error;
  const rows = (result ?? []) as any[];
  const used = rows.filter((row) => !!row.used_at);
  const lastUsed =
    used
      .map((row) => String(row.used_at))
      .sort()
      .at(-1) ?? null;
  return {
    remaining: rows.filter((row) => !row.used_at).length,
    total: rows.length || BACKUP_CODE_TOTAL,
    last_used_at: lastUsed,
  } satisfies MfaBackupCodeStatus;
}

/**
 *
 */
export async function regenerateBackupCodesHandler(data: { accessToken: string }) {
  const user = await getUserFromToken(data.accessToken);
  const codes = await generateBackupCodes();
  const { error: deleteError } = await supabaseAdmin
    .from("user_mfa_backup_codes" as any)
    .delete()
    .eq("user_id", user.id);
  if (deleteError) throw deleteError;

  const { error } = await supabaseAdmin.from("user_mfa_backup_codes" as any).insert(
    (await Promise.all(
      codes.map(async (code) => ({
        user_id: user.id,
        code_hash: await hashBackupCode(user.id, code),
      })),
    )) as any,
  );
  if (error) throw error;

  await logMfaEvent({
    userId: user.id,
    actionType: "mfa_backup_codes_regenerated",
    message: "Codici di backup 2FA rigenerati",
    newValue: { count: codes.length },
  });

  return { codes };
}

/**
 *
 */
export async function verifyBackupCodeHandler(data: {
  accessToken: string;
  code: string;
  ipAddress?: string | null;
}) {
  const user = await getUserFromToken(data.accessToken);
  const codeHash = await hashBackupCode(user.id, data.code);
  const { data: row, error } = await supabaseAdmin
    .from("user_mfa_backup_codes" as any)
    .select("id, used_at")
    .eq("user_id", user.id)
    .eq("code_hash", codeHash)
    .maybeSingle();
  if (error) throw error;
  if (!row || (row as any).used_at) {
    await logMfaEvent({
      userId: user.id,
      actionType: "mfa_verify_failed",
      message: "Verifica 2FA fallita con codice di backup",
      severity: "warning",
      ipAddress: data.ipAddress,
    });
    throw new Response("Codice di backup non valido", { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("user_mfa_backup_codes" as any)
    .update({ used_at: new Date().toISOString() })
    .eq("id", (row as any).id);
  if (updateError) throw updateError;

  await logMfaEvent({
    userId: user.id,
    actionType: "mfa_login_backup_code",
    message: "Login completato con codice di backup 2FA",
    ipAddress: data.ipAddress,
  });

  return { ok: true };
}

/**
 *
 */
export async function logMfaAuditEventHandler(data: {
  accessToken: string;
  actionType: string;
  message: string;
  severity?: "info" | "warning" | "critical";
  ipAddress?: string | null;
}) {
  const user = await getUserFromToken(data.accessToken);
  await logMfaEvent({
    userId: user.id,
    actionType: data.actionType,
    message: data.message,
    severity: data.severity,
    ipAddress: data.ipAddress,
  });
  return { ok: true };
}
