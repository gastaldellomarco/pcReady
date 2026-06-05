import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OS_OPTIONS,
  type TicketStatus,
  type SlaLimits,
  type SlaConfig,
  DEFAULT_SLA_LIMITS,
  DEFAULT_SLA_CONFIG,
  slaConfigToLimits,
} from "@/lib/pcready";
import { requireAdmin } from "./admin-users.server";

/**
 *
 */
export type WipLimits = Record<TicketStatus, number>;
/**
 *
 */
export type KanbanColumnColors = Partial<Record<TicketStatus, string>>;
/**
 *
 */
export type KanbanColumnNotes = Partial<Record<TicketStatus, string>>;

export const DEFAULT_WIP_LIMITS: WipLimits = {
  pending: 20,
  "in-progress": 5,
  testing: 5,
  ready: 20,
  completed: 0, // No WIP limit for completed tickets
  archived: 0,
};

/**
 *
 */
export type AppSettings = {
  organization_name: string;
  default_timezone: string;
  max_devices_per_technician: number;
  self_registration_enabled: boolean;
  admin_approval_required: boolean;
  support_email: string;
  wip_limits: WipLimits;
  sla_limits: SlaLimits;
  sla_config: SlaConfig;
  archive_after_days: number;
  log_retention_days: number;
  os_options: string[];
  device_brands: string[];
  ticket_categories: string[];
  kanban_column_colors: KanbanColumnColors;
  kanban_column_notes: KanbanColumnNotes;
  mfa_require_admin_users: boolean;
  mfa_require_all_users: boolean;
  mfa_grace_period_days: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  organization_name: "PCReady",
  default_timezone: "Europe/Rome",
  max_devices_per_technician: 10,
  self_registration_enabled: false,
  admin_approval_required: true,
  support_email: "",
  wip_limits: DEFAULT_WIP_LIMITS,
  sla_limits: DEFAULT_SLA_LIMITS,
  sla_config: DEFAULT_SLA_CONFIG,
  os_options: [...OS_OPTIONS],
  device_brands: ["Dell", "HP", "Lenovo", "Apple", "Asus", "Acer", "Microsoft"],
  ticket_categories: [],
  archive_after_days: 7,
  log_retention_days: 365,
  kanban_column_colors: {},
  kanban_column_notes: {
    pending: "",
    "in-progress": "",
    testing: "",
    ready: "",
    completed: "",
    archived: "",
  },
  mfa_require_admin_users: false,
  mfa_require_all_users: false,
  mfa_grace_period_days: 7,
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

const SlaLimitsSchema = z.object({
  high: z.number().int().min(1).max(999),
  med: z.number().int().min(1).max(999),
  low: z.number().int().min(1).max(999),
});

const SlaConfigSchema = z.object({
  high: z.object({
    responseHours: z.number().int().min(1).max(999),
    resolutionHours: z.number().int().min(1).max(999),
  }),
  med: z.object({
    responseHours: z.number().int().min(1).max(999),
    resolutionHours: z.number().int().min(1).max(999),
  }),
  low: z.object({
    responseHours: z.number().int().min(1).max(999),
    resolutionHours: z.number().int().min(1).max(999),
  }),
});

const StringListSchema = z.array(z.string().trim().min(1)).default([]);
const KanbanColumnColorsSchema = z
  .object({
    pending: z.string().optional(),
    "in-progress": z.string().optional(),
    testing: z.string().optional(),
    ready: z.string().optional(),
    completed: z.string().optional(),
    archived: z.string().optional(),
  })
  .default({});

const KanbanColumnNotesSchema = z
  .object({
    pending: z.string().optional(),
    "in-progress": z.string().optional(),
    testing: z.string().optional(),
    ready: z.string().optional(),
    completed: z.string().optional(),
    archived: z.string().optional(),
  })
  .default({});

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
        "sla_limits",
        "sla_config",
        "mfa_require_admin_users",
        "mfa_require_all_users",
        "mfa_grace_period_days",
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
      sla_limits: settings.sla_limits,
      sla_config: settings.sla_config,
      mfa_require_admin_users: settings.mfa_require_admin_users,
      mfa_require_all_users: settings.mfa_require_all_users,
      mfa_grace_period_days: settings.mfa_grace_period_days,
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
/**
 *
 */
export function setClientAppSettings(settings: Partial<AppSettings>) {
  try {
    (globalThis as any).__APP_SETTINGS__ = settings;
  } catch {
    // Ignore environments where globalThis is not writable.
  }
}

/**
 *
 */
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
      .in("key", [
        "wip_limits",
        "archive_after_days",
        "kanban_column_colors",
        "kanban_column_notes",
      ]);

    if (error) throw error;

    const rows = (data ?? []) as unknown as AppSettingRow[];

    const merged = mergeAppSettingsRows(rows);
    const parsedWip = merged.wip_limits ?? DEFAULT_WIP_LIMITS;
    const result = WipLimitsSchema.safeParse(parsedWip);
    const parsedNotes = KanbanColumnNotesSchema.safeParse(merged.kanban_column_notes);
    return {
      wip_limits: result.success ? result.data : DEFAULT_WIP_LIMITS,
      archive_after_days: merged.archive_after_days ?? 7,
      kanban_column_colors: merged.kanban_column_colors ?? {},
      kanban_column_notes: parsedNotes.success ? parsedNotes.data : {},
    };
  });

export const updateKanbanAppSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      accessToken: string;
      wip_limits: WipLimits;
      kanban_column_colors?: KanbanColumnColors;
      kanban_column_notes?: KanbanColumnNotes;
    }) => data,
  )
  .handler(
    async ({ data: { accessToken, wip_limits, kanban_column_colors, kanban_column_notes } }) => {
      const userId = await requireAdmin(accessToken);
      const parsedWip = WipLimitsSchema.parse(wip_limits);
      const parsedColors = KanbanColumnColorsSchema.parse(kanban_column_colors ?? {});
      const parsedNotes =
        kanban_column_notes !== undefined
          ? KanbanColumnNotesSchema.parse(kanban_column_notes)
          : undefined;
      const updates = [
        { key: "wip_limits", value: JSON.stringify(parsedWip), updated_by: userId },
        { key: "kanban_column_colors", value: JSON.stringify(parsedColors), updated_by: userId },
      ];
      if (parsedNotes !== undefined) {
        updates.push({
          key: "kanban_column_notes",
          value: JSON.stringify(parsedNotes),
          updated_by: userId,
        });
      }
      const { error } = await supabaseAdmin
        .from("app_settings" as any)
        .upsert(updates as any, { onConflict: "key" });
      if (error) throw error;
      return {
        wip_limits: parsedWip,
        kanban_column_colors: parsedColors,
        kanban_column_notes: parsedNotes ?? {},
      };
    },
  );

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

/**
 *
 */
export function mergeAppSettingsRows(rows: AppSettingRow[]): AppSettings {
  const settings = { ...DEFAULT_SETTINGS };
  const seenKeys = new Set<string>();
  rows.forEach(({ key, value }) => {
    seenKeys.add(key);
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

  if (!seenKeys.has("sla_config") && seenKeys.has("sla_limits")) {
    settings.sla_config = {
      high: { ...DEFAULT_SLA_CONFIG.high, resolutionHours: settings.sla_limits.high },
      med: { ...DEFAULT_SLA_CONFIG.med, resolutionHours: settings.sla_limits.med },
      low: { ...DEFAULT_SLA_CONFIG.low, resolutionHours: settings.sla_limits.low },
    };
  }
  settings.sla_limits = slaConfigToLimits(settings.sla_config);

  return settings;
}

/**
 *
 */
export function validateAppSettingsInput(settings: Partial<AppSettings>): AppSettings {
  // Merge incoming settings with defaults so missing optional fields get default values
  const mergedSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    wip_limits: { ...DEFAULT_WIP_LIMITS, ...(settings.wip_limits || {}) },
    sla_config: { ...DEFAULT_SLA_CONFIG, ...(settings.sla_config || {}) },
    sla_limits: { ...DEFAULT_SLA_LIMITS, ...(settings.sla_limits || {}) },
    os_options: settings.os_options ?? DEFAULT_SETTINGS.os_options,
    device_brands: settings.device_brands ?? DEFAULT_SETTINGS.device_brands,
    ticket_categories: settings.ticket_categories ?? DEFAULT_SETTINGS.ticket_categories,
    archive_after_days: settings.archive_after_days ?? DEFAULT_SETTINGS.archive_after_days,
    log_retention_days: settings.log_retention_days ?? DEFAULT_SETTINGS.log_retention_days,
    kanban_column_colors: settings.kanban_column_colors ?? DEFAULT_SETTINGS.kanban_column_colors,
    kanban_column_notes: settings.kanban_column_notes ?? DEFAULT_SETTINGS.kanban_column_notes,
    mfa_require_admin_users:
      settings.mfa_require_admin_users ?? DEFAULT_SETTINGS.mfa_require_admin_users,
    mfa_require_all_users: settings.mfa_require_all_users ?? DEFAULT_SETTINGS.mfa_require_all_users,
    mfa_grace_period_days: settings.mfa_grace_period_days ?? DEFAULT_SETTINGS.mfa_grace_period_days,
  };

  mergedSettings.sla_limits = slaConfigToLimits(mergedSettings.sla_config);

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
      sla_limits: SlaLimitsSchema,
      sla_config: SlaConfigSchema,
      archive_after_days: z.number().int().min(0).max(365),
      log_retention_days: z.number().int().min(30).max(730),
      os_options: StringListSchema,
      device_brands: StringListSchema,
      ticket_categories: StringListSchema,
      kanban_column_colors: KanbanColumnColorsSchema,
      kanban_column_notes: KanbanColumnNotesSchema,
      mfa_require_admin_users: z.boolean(),
      mfa_require_all_users: z.boolean(),
      mfa_grace_period_days: z.number().int().min(0).max(365),
    })
    .parse(mergedSettings);
}
