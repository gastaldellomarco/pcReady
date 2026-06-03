import { Bell, Settings, Wrench, Zap } from "lucide-react";
import type { NotificationType } from "@/lib/notifications";

/**
 *
 */
export function iconForType(type: NotificationType) {
  if (type === "automation_failed") return Zap;
  if (type === "device_status_changed") return Wrench;
  if (type === "user_invited") return Settings;
  return Bell;
}

/**
 *
 */
export function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (delta < minute) return "Ora";
  if (delta < hour) return `${Math.floor(delta / minute)} min fa`;
  if (delta < day) return `${Math.floor(delta / hour)} h fa`;
  return `${Math.floor(delta / day)} g fa`;
}
