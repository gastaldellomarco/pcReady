import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./admin-users.server";

export type AppSettings = {
  organization_name: string;
  default_timezone: string;
  max_devices_per_technician: number;
  self_registration_enabled: boolean;
  admin_approval_required: boolean;
  support_email: string;
};

const DEFAULT_SETTINGS: AppSettings = {
  organization_name: "PCReady",
  default_timezone: "Europe/Rome",
  max_devices_per_technician: 10,
  self_registration_enabled: false,
  admin_approval_required: true,
  support_email: "",
};

export const getAppSettings = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    await requireAdmin(accessToken);

    const { data, error } = await supabaseAdmin
      .from("app_settings" as any)
      .select("key, value");

    if (error) throw error;

    const settings = { ...DEFAULT_SETTINGS };
    const rows = (data ?? []) as any[];
    rows.forEach(({ key, value }) => {
      if (key in settings) {
        let parsed: any = value;
        try {
          parsed = typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
          parsed = value;
        }
        (settings as any)[key] = parsed;
      }
    });

    return settings;
  });

export const updateAppSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; settings: AppSettings }) => data)
  .handler(async ({ data: { accessToken, settings } }) => {
    const userId = await requireAdmin(accessToken);

    // Validate settings
    const validatedSettings = z.object({
      organization_name: z.string().min(1),
      default_timezone: z.string().min(1),
      max_devices_per_technician: z.number().min(1).max(100),
      self_registration_enabled: z.boolean(),
      admin_approval_required: z.boolean(),
      support_email: z.string().email().max(254).transform(val => val.toLowerCase().trim()),
    }).parse(settings);

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