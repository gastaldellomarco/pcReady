import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "ticket_assigned",
  "ticket_status_changed",
  "ticket_completed",
  "ticket_comment",
  "automation_failed",
  "device_status_changed",
  "checklist_completed",
  "checklist_section_assigned",
  "user_invited",
  "user_registered",
  "mention",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  payload: Record<string, any> | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  payload?: Record<string, any> | null;
  link?: string | null;
}

export const CreateNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().min(1).max(160),
  body: z.string().max(1000).nullable().optional(),
  payload: z.record(z.any()).nullable().optional(),
  link: z.string().max(500).nullable().optional(),
});
