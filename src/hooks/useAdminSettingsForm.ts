import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AppSettingsSchema } from "@/lib/schemas";
import { getAdminErrorMessage } from "@/lib/admin/admin-error-message";
import type { AppSettings } from "@/lib/app-settings";

type SaveServerFn = (opts: { data: { accessToken: string; settings: AppSettings } }) => Promise<{ success: boolean }>;

export function useAdminSettingsForm(args: {
  accessToken: string | undefined;
  settings: AppSettings | null;
  saveSettings: SaveServerFn;
  onSettingsSaved: (settings: AppSettings) => void;
}) {
  const { accessToken, settings, saveSettings, onSettingsSaved } = args;
  const [saveSettingsBusy, setSaveSettingsBusy] = useState(false);

  const settingsForm = useForm<z.input<typeof AppSettingsSchema>>({
    resolver: zodResolver(AppSettingsSchema),
    mode: "onChange",
    defaultValues: {
      organization_name: "",
      default_timezone: "",
      max_devices_per_technician: 1,
      self_registration_enabled: false,
      admin_approval_required: false,
      support_email: null,
      wip_limits: {
        pending: 20,
        "in-progress": 5,
        testing: 5,
        ready: 20,
        completed: 0,
        archived: 0,
      },
      sla_config: {
        high: { responseHours: 1, resolutionHours: 4 },
        med: { responseHours: 4, resolutionHours: 24 },
        low: { responseHours: 24, resolutionHours: 72 },
      },
      sla_limits: {
        high: 4,
        med: 24,
        low: 72,
      },
      archive_after_days: 7,
      log_retention_days: 365,
      os_options: [],
      device_brands: [],
      ticket_categories: [],
      mfa_require_admin_users: false,
      mfa_require_all_users: false,
      mfa_grace_period_days: 7,
    } as any,
  });

  useEffect(() => {
    settingsForm.reset({
      organization_name: settings?.organization_name ?? "",
      default_timezone: settings?.default_timezone ?? "",
      max_devices_per_technician: settings?.max_devices_per_technician ?? 1,
      self_registration_enabled: settings?.self_registration_enabled ?? false,
      admin_approval_required: settings?.admin_approval_required ?? false,
      support_email: settings?.support_email ?? null,
      wip_limits: settings?.wip_limits ?? {
        pending: 20,
        "in-progress": 5,
        testing: 5,
        ready: 20,
        completed: 0,
        archived: 0,
      },
      sla_config: settings?.sla_config ?? {
        high: { responseHours: 1, resolutionHours: 4 },
        med: { responseHours: 4, resolutionHours: 24 },
        low: { responseHours: 24, resolutionHours: 72 },
      },
      sla_limits: settings?.sla_limits ?? {
        high: 4,
        med: 24,
        low: 72,
      },
      archive_after_days: settings?.archive_after_days ?? 7,
      log_retention_days: settings?.log_retention_days ?? 365,
      os_options: settings?.os_options ?? [],
      device_brands: settings?.device_brands ?? [],
      ticket_categories: settings?.ticket_categories ?? [],
      kanban_column_colors: settings?.kanban_column_colors ?? {},
      mfa_require_admin_users: settings?.mfa_require_admin_users ?? false,
      mfa_require_all_users: settings?.mfa_require_all_users ?? false,
      mfa_grace_period_days: settings?.mfa_grace_period_days ?? 7,
    } as any);
  }, [settings, settingsForm]);

  async function submitSettings(values: z.input<typeof AppSettingsSchema>) {
    if (!accessToken) return;
    setSaveSettingsBusy(true);
    try {
      const payload: AppSettings = {
        organization_name: values.organization_name,
        default_timezone: values.default_timezone,
        max_devices_per_technician: Number(values.max_devices_per_technician),
        self_registration_enabled: !!values.self_registration_enabled,
        admin_approval_required: !!values.admin_approval_required,
        support_email: (values.support_email as string) || "",
        wip_limits: {
          pending: Number(values.wip_limits.pending),
          "in-progress": Number(values.wip_limits["in-progress"]),
          testing: Number(values.wip_limits.testing),
          ready: Number(values.wip_limits.ready),
          completed: Number(values.wip_limits.completed ?? 0),
          archived: Number(values.wip_limits.archived ?? 0),
        },
        sla_config: {
          high: {
            responseHours: Number((values as any).sla_config?.high?.responseHours ?? 1),
            resolutionHours: Number((values as any).sla_config?.high?.resolutionHours ?? 4),
          },
          med: {
            responseHours: Number((values as any).sla_config?.med?.responseHours ?? 4),
            resolutionHours: Number((values as any).sla_config?.med?.resolutionHours ?? 24),
          },
          low: {
            responseHours: Number((values as any).sla_config?.low?.responseHours ?? 24),
            resolutionHours: Number((values as any).sla_config?.low?.resolutionHours ?? 72),
          },
        },
        sla_limits: {
          high: Number((values as any).sla_config?.high?.resolutionHours ?? 4),
          med: Number((values as any).sla_config?.med?.resolutionHours ?? 24),
          low: Number((values as any).sla_config?.low?.resolutionHours ?? 72),
        },
        archive_after_days: Number(values.archive_after_days ?? 7),
        log_retention_days: Number((values as any).log_retention_days ?? 365),
        os_options: values.os_options ?? [],
        device_brands: values.device_brands ?? [],
        ticket_categories: values.ticket_categories ?? [],
        kanban_column_colors: settings?.kanban_column_colors ?? {},
        mfa_require_admin_users: !!(values as any).mfa_require_admin_users,
        mfa_require_all_users: !!(values as any).mfa_require_all_users,
        mfa_grace_period_days: Number((values as any).mfa_grace_period_days ?? 7),
      };

      await saveSettings({ data: { accessToken, settings: payload } });
      onSettingsSaved(payload);
      toast.success("Impostazioni salvate");
    } catch (error) {
      toast.error(getAdminErrorMessage(error, "Salvataggio non riuscito"));
    } finally {
      setSaveSettingsBusy(false);
    }
  }

  return { settingsForm, submitSettings, saveSettingsBusy };
}
