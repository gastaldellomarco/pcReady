import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEVICE_STATUS_LABEL } from "@/lib/pcready";

const NOTIFICATION_INSERT_SELECT = "id, user_id, type, title, body, payload, link, read_at, created_at";
import {
  CreateNotificationSchema,
  type CreateNotificationParams,
  type NotificationRow,
  type NotificationType,
} from "@/lib/notifications";

export async function getAuthedNotificationUser(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Response("Non autenticato", { status: 401 });
  return data.user;
}

function preferenceColumn(type: NotificationType) {
  if (type === "ticket_assigned") return "notify_ticket_assigned";
  if (type === "ticket_status_changed") return "notify_ticket_status_changed";
  if (type === "ticket_completed") return "notify_ticket_completed";
  if (type === "automation_failed") return "notify_automation_failed";
  if (type === "device_status_changed") return "notify_device_status_changed";
  if (type === "checklist_completed") return "notify_checklist_completed";
  if (type === "mention") return "notify_mentions";
  return null;
}

export async function createNotificationForUser(params: CreateNotificationParams) {
  const input = CreateNotificationSchema.parse(params);
  const pref = preferenceColumn(input.type);

  if (pref) {
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .select(pref)
      .eq("id", input.userId)
      .maybeSingle();
    if (error) {
      if (error.code === "42703") {
        console.warn(`Notification preference column "${pref}" missing; using default enabled.`);
      } else {
        console.error("createNotification preference check failed:", error);
        return null;
      }
    }
    if (data && (data as any)[pref] === false) return null;
  }

  const { data, error } = await supabaseAdmin
    .from("notifications" as any)
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      payload: input.payload ?? null,
      link: input.link ?? null,
    })
    .select(NOTIFICATION_INSERT_SELECT)
    .single();

  if (error) {
    console.error("createNotification failed:", error);
    return null;
  }

  return data as unknown as NotificationRow;
}

export async function notifyDeviceStatusChangedForAdmins(params: {
  deviceId: string;
  deviceName: string;
  status: string;
  previousStatus?: string | null;
}) {
  const label = (s: string) =>
    DEVICE_STATUS_LABEL[s as keyof typeof DEVICE_STATUS_LABEL] ?? s;
  await createNotificationForAdmins({
    type: "device_status_changed",
    title: `Dispositivo ${params.deviceName} → ${label(params.status)}`,
    body: params.previousStatus
      ? `Stato aggiornato da "${label(params.previousStatus)}" a "${label(params.status)}".`
      : `Lo stato del dispositivo è cambiato in "${label(params.status)}".`,
    payload: {
      entity_type: "device",
      entity_id: params.deviceId,
      device_id: params.deviceId,
      status: params.status,
      previous_status: params.previousStatus ?? null,
    },
    link: "/inventory",
  });
}

export async function createNotificationForAdmins(
  params: Omit<CreateNotificationParams, "userId">,
) {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (error) {
    console.error("createNotificationForAdmins failed:", error);
    return;
  }

  await Promise.all(
    (roles ?? []).map((role) =>
      createNotificationForUser({
        ...params,
        userId: role.user_id,
      }),
    ),
  );
}

export async function markNotificationReadForUser(userId: string, notificationId: string) {
  const { error } = await supabaseAdmin
    .from("notifications" as any)
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
  return { success: true };
}

export async function markAllNotificationsReadForUser(userId: string) {
  const { error } = await supabaseAdmin
    .from("notifications" as any)
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
  return { success: true };
}

export { supabaseAdmin };
