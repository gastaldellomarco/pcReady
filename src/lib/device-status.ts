import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAutomationRunnerUser } from "@/lib/automation-runs.server";
import { notifyDeviceStatusChangedForAdmins } from "@/lib/notifications.server";

const DEVICE_STATUSES = ["available", "assigned", "maintenance", "retired"] as const;

const DEVICE_STATUS_LABELS: Record<string, string> = {
  available: "Disponibile",
  assigned: "Assegnato",
  maintenance: "Manutenzione",
  retired: "Dismesso",
};

const UpdateDeviceStatusSchema = z.object({
  accessToken: z.string(),
  deviceId: z.string().uuid(),
  status: z.enum(DEVICE_STATUSES),
});

export const updateDeviceStatus = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof UpdateDeviceStatusSchema>) => data)
  .handler(async ({ data }) => {
    const input = UpdateDeviceStatusSchema.parse(data);
    const authUser = await requireAutomationRunnerUser(input.accessToken);

    const { data: before, error: selErr } = await supabaseAdmin
      .from("devices")
      .select("id, model, serial, status")
      .eq("id", input.deviceId)
      .maybeSingle();
    if (selErr) throw selErr;
    if (!before) throw new Response("Dispositivo non trovato", { status: 404 });

    const previousStatus = String((before as { status: string }).status);

    const { data: device, error: updErr } = await supabaseAdmin
      .from("devices")
      .update({ status: input.status })
      .eq("id", input.deviceId)
      .select("id, model, serial, status")
      .single();
    if (updErr) throw updErr;

    const row = device as { id: string; model: string; serial: string | null; status: string };
    const label = [row.model, row.serial].filter(Boolean).join(" \u00B7 ") || row.model;

    // Log status change to activity_log
    if (previousStatus !== input.status) {
      const fromLabel = DEVICE_STATUS_LABELS[previousStatus] || previousStatus;
      const toLabel = DEVICE_STATUS_LABELS[input.status] || input.status;
      const { error: logErr } = await supabaseAdmin.from("activity_log").insert({
        type: "user",
        message: `Dispositivo ${label}: stato cambiato da "${fromLabel}" a "${toLabel}"`,
        actor_id: authUser.id,
        device_id: row.id,
        created_at: new Date().toISOString(),
      } as any);
      if (logErr) console.error("Failed to log device status change:", logErr);
    }

    if (
      (input.status === "maintenance" || input.status === "retired") &&
      previousStatus !== input.status
    ) {
      await notifyDeviceStatusChangedForAdmins({
        deviceId: row.id,
        deviceName: label,
        status: input.status,
        previousStatus,
      });
    }

    return { id: row.id, status: row.status, model: row.model, serial: row.serial };
  });
