import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./admin-users.server";
import { OS_OPTIONS, type TicketStatus } from "@/lib/pcready";

export type WipLimits = Record<TicketStatus, number>;

export const DEFAULT_WIP_LIMITS: WipLimits = {
  pending: 20,
  "in-progress": 5,
  testing: 5,
  ready: 20,
  completed: 0, // No WIP limit for completed tickets
  archived: 0,
};

export type AppSettings = {
  organization_name: string;
  default_timezone: string;
  max_devices_per_technician: number;
  self_registration_enabled: boolean;
  admin_approval_required: boolean;
  support_email: string;
  wip_limits: WipLimits;
  archive_after_days: number;
  log_retention_days: number;
  os_options: string[];
  device_brands: string[];
  ticket_categories: string[];
};

const DEFAULT_SETTINGS: AppSettings = {
  organization_name: "PCReady",
  default_timezone: "Europe/Rome",
  max_devices_per_technician: 10,
  self_registration_enabled: false,
  admin_approval_required: true,
  support_email: "",
  wip_limits: DEFAULT_WIP_LIMITS,
  os_options: [...OS_OPTIONS],
  device_brands: ["Dell", "HP", "Lenovo", "Apple", "Asus", "Acer", "Microsoft"],
  ticket_categories: [],
  archive_after_days: 7,
  log_retention_days: 365,
};

type AppSettingRow = { key: string; value: unknown };

const WipLimitsSchema = z.object({
  pending: z.number().int().min(0).max(999),
  "in-progress": z.number().int().min(0).max(999),
  testing: z.number().int().min(0).max(999),
  ready: z.number().int().min(0).max(999),
  completed: z.number().int().min(0).max(999),
  archived: z.number().int().min(0).max(999),
});

const StringListSchema = z.array(z.string().trim().min(1)).default([]);

export const getAppSettings = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    await requireAdmin(accessToken);

    const { data, error } = await supabaseAdmin.from("app_settings" as any).select("key, value");

    if (error) throw error;

    return mergeAppSettingsRows((data ?? []) as unknown as AppSettingRow[]);
  });

export const getPublicAppSettings = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("app_settings" as any)
      .select("key, value")
      .in("key", [
        "organization_name",
        "default_timezone",
        "support_email",
        "os_options",
        "device_brands",
        "ticket_categories",
      ]);

    if (error) throw error;

    const settings = mergeAppSettingsRows((data ?? []) as unknown as AppSettingRow[]);
    return {
      organization_name: settings.organization_name,
      default_timezone: settings.default_timezone,
      support_email: settings.support_email,
      os_options: settings.os_options,
      device_brands: settings.device_brands,
      ticket_categories: settings.ticket_categories,
    };
  });

export const getSupportContact = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("app_settings" as any)
    .select("value")
    .eq("key", "support_email")
    .maybeSingle();

  if (error) throw error;

  const rawValue = (data as { value?: unknown } | null)?.value ?? "";
  let supportEmail = "";

  try {
    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    supportEmail = typeof parsed === "string" ? parsed.trim() : "";
  } catch {
    supportEmail = typeof rawValue === "string" ? rawValue.trim() : "";
  }

  return { support_email: supportEmail };
});

// Client-side cached settings helpers
export function setClientAppSettings(settings: Partial<AppSettings>) {
  try {
    (globalThis as any).__APP_SETTINGS__ = settings;
  } catch {
    // Ignore environments where globalThis is not writable.
  }
}

export function getClientAppSettings(): AppSettings {
  return (globalThis as any).__APP_SETTINGS__ ?? DEFAULT_SETTINGS;
}

/**
 * Validate that a technician does not exceed the configured max devices limit.
 * This can be called from client code (via `useServerFn`) before assigning/creating device tickets.
 */
export const validateTechnicianDeviceLimit = createServerFn({ method: "POST" })
  .inputValidator((data: { assigneeId: string }) => data)
  .handler(async ({ data: { assigneeId } }) => {
    // Count active device tickets assigned to this technician
    const { data, error, count } = await supabaseAdmin
      .from("tickets" as any)
      .select("id", { count: "exact", head: false })
      .eq("assignee_id", assigneeId)
      .eq("ticket_type", "device")
      .not("status", "in", ["completed", "archived"]);

    if (error) throw error;

    const { data: settingsRows } = await supabaseAdmin
      .from("app_settings" as any)
      .select("key, value");
    const settings = mergeAppSettingsRows((settingsRows ?? []) as unknown as AppSettingRow[]);
    const max = settings.max_devices_per_technician ?? DEFAULT_SETTINGS.max_devices_per_technician;
    const current = typeof count === "number" ? count : Array.isArray(data) ? data.length : 0;

    if (current >= (max ?? 0)) {
      throw new Response("Limite dispositivi per tecnico raggiunto", { status: 400 });
    }

    return { ok: true, current, max };
  });

export const getKanbanAppSettings = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("app_settings" as any)
      .select("key, value")
      .in("key", ["wip_limits", "archive_after_days"]);

    if (error) throw error;

    const rows = (data ?? []) as unknown as AppSettingRow[];

    const merged = mergeAppSettingsRows(rows);
    const parsedWip = merged.wip_limits ?? DEFAULT_WIP_LIMITS;
    const result = WipLimitsSchema.safeParse(parsedWip);
    return {
      wip_limits: result.success ? result.data : DEFAULT_WIP_LIMITS,
      archive_after_days: merged.archive_after_days ?? 7,
    };
  });

export const updateAppSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; settings: AppSettings }) => data)
  .handler(async ({ data: { accessToken, settings } }) => {
    const userId = await requireAdmin(accessToken);

    const validatedSettings = validateAppSettingsInput(settings);

    const updates = Object.entries(validatedSettings).map(([key, value]) => ({
      key,
      value: JSON.stringify(value),
      updated_by: userId,
    }));

    const { error } = await supabaseAdmin
      .from("app_settings" as any)
      .upsert(updates as any, { onConflict: "key" });

    if (error) throw error;

    return { success: true };
  });

export function mergeAppSettingsRows(rows: AppSettingRow[]): AppSettings {
  const settings = { ...DEFAULT_SETTINGS };
  rows.forEach(({ key, value }) => {
    if (key in settings) {
      let parsed: unknown = value;
      try {
        parsed = typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        parsed = value;
      }
      (settings as Record<string, unknown>)[key] = parsed;
    }
  });

  return settings;
}

export function validateAppSettingsInput(settings: AppSettings): AppSettings {
  // Merge incoming settings with defaults so missing optional fields get default values
  const mergedSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    wip_limits: { ...DEFAULT_WIP_LIMITS, ...(settings.wip_limits || {}) },
    os_options: settings.os_options ?? DEFAULT_SETTINGS.os_options,
    device_brands: settings.device_brands ?? DEFAULT_SETTINGS.device_brands,
    ticket_categories: settings.ticket_categories ?? DEFAULT_SETTINGS.ticket_categories,
    archive_after_days: settings.archive_after_days ?? DEFAULT_SETTINGS.archive_after_days,
    log_retention_days: settings.log_retention_days ?? DEFAULT_SETTINGS.log_retention_days,
  };

  return z
    .object({
      organization_name: z.string().min(1),
      default_timezone: z.string().min(1),
      max_devices_per_technician: z.number().min(1).max(100),
      self_registration_enabled: z.boolean(),
      admin_approval_required: z.boolean(),
      support_email: z
        .string()
        .max(254)
        .transform((val) => val.toLowerCase().trim())
        .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Email non valida"),
      wip_limits: WipLimitsSchema,
      archive_after_days: z.number().int().min(0).max(365),
      log_retention_days: z.number().int().min(30).max(730),
      os_options: StringListSchema,
      device_brands: StringListSchema,
      ticket_categories: StringListSchema,
    })
    .parse(mergedSettings);
}
