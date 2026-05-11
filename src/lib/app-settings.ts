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
};

export type AppSettings = {
  organization_name: string;
  default_timezone: string;
  max_devices_per_technician: number;
  self_registration_enabled: boolean;
  admin_approval_required: boolean;
  support_email: string;
  wip_limits: WipLimits;
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
};

type AppSettingRow = { key: string; value: unknown };

const WipLimitsSchema = z.object({
  pending: z.number().int().min(0).max(999),
  "in-progress": z.number().int().min(0).max(999),
  testing: z.number().int().min(0).max(999),
  ready: z.number().int().min(0).max(999),
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
      .in("key", ["os_options", "device_brands", "ticket_categories"]);

    if (error) throw error;

    const settings = mergeAppSettingsRows((data ?? []) as unknown as AppSettingRow[]);
    return {
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

export const getKanbanAppSettings = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    if (userError || !userData.user) throw new Response("Non autenticato", { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("app_settings" as any)
      .select("value")
      .eq("key", "wip_limits")
      .maybeSingle();

    if (error) throw error;

    const row = data as unknown as { value?: unknown } | null;
    let parsed: unknown = row?.value ?? DEFAULT_WIP_LIMITS;
    try {
      parsed = typeof parsed === "string" ? JSON.parse(parsed) : parsed;
    } catch {
      parsed = DEFAULT_WIP_LIMITS;
    }

    const result = WipLimitsSchema.safeParse(parsed);
    return { wip_limits: result.success ? result.data : DEFAULT_WIP_LIMITS };
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
      os_options: StringListSchema,
      device_brands: StringListSchema,
      ticket_categories: StringListSchema,
    })
    .parse(settings);
}
