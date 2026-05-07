import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "ticket_assigned",
  "ticket_status_changed",
  "ticket_comment",
  "automation_failed",
  "device_status_changed",
  "checklist_completed",
  "user_invited",
  "mention",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  link?: string | null;
}

export const CreateNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().min(1).max(160),
  body: z.string().max(1000).nullable().optional(),
  payload: z.record(z.unknown()).nullable().optional(),
  link: z.string().max(500).nullable().optional(),
});

const ListNotificationsSchema = z.object({
  accessToken: z.string(),
  limit: z.number().int().min(1).max(100).default(10),
  page: z.number().int().min(0).default(0),
  unreadOnly: z.boolean().default(false),
  type: z.enum(NOTIFICATION_TYPES).nullable().optional(),
});

export const createNotification = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; notification: CreateNotificationParams }) => data)
  .handler(async ({ data: { accessToken, notification } }) => {
    const { createNotificationForUser, getAuthedNotificationUser } = await import(
      "./notifications.server"
    );
    await getAuthedNotificationUser(accessToken);
    return createNotificationForUser(notification);
  });

export const listNotifications = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof ListNotificationsSchema>) => data)
  .handler(async ({ data }) => {
    const input = ListNotificationsSchema.parse(data);
    const { getAuthedNotificationUser, supabaseAdmin } = await import("./notifications.server");
    const user = await getAuthedNotificationUser(input.accessToken);
    const from = input.page * input.limit;
    const to = from + input.limit - 1;

    let query = supabaseAdmin
      .from("notifications" as any)
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (input.unreadOnly) query = query.is("read_at", null);
    if (input.type) query = query.eq("type", input.type);

    const { data: rows, count, error } = await query.range(from, to);
    if (error) throw error;

    return {
      rows: (rows ?? []) as NotificationRow[],
      total: count ?? 0,
    };
  });

export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    const { getAuthedNotificationUser, supabaseAdmin } = await import("./notifications.server");
    const user = await getAuthedNotificationUser(accessToken);
    const { count, error } = await supabaseAdmin
      .from("notifications" as any)
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) throw error;
    return { unread: count ?? 0 };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string; notificationId: string }) => data)
  .handler(async ({ data: { accessToken, notificationId } }) => {
    const { getAuthedNotificationUser, supabaseAdmin } = await import("./notifications.server");
    const user = await getAuthedNotificationUser(accessToken);
    const { error } = await supabaseAdmin
      .from("notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) throw error;
    return { success: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    const { getAuthedNotificationUser, supabaseAdmin } = await import("./notifications.server");
    const user = await getAuthedNotificationUser(accessToken);
    const { error } = await supabaseAdmin
      .from("notifications" as any)
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) throw error;
    return { success: true };
  });

export const deleteReadNotifications = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => data)
  .handler(async ({ data: { accessToken } }) => {
    const { getAuthedNotificationUser, supabaseAdmin } = await import("./notifications.server");
    const user = await getAuthedNotificationUser(accessToken);
    const { error } = await supabaseAdmin
      .from("notifications" as any)
      .delete()
      .eq("user_id", user.id)
      .not("read_at", "is", null);
    if (error) throw error;
    return { success: true };
  });
