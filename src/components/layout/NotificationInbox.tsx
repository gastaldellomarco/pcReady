import { CheckCheck, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { iconForType, relativeTime } from "./notification-utils";
import type { NotificationRow } from "@/lib/notifications";

interface NotificationInboxProps {
  notifications: NotificationRow[];
  unread: number;
  onMarkAllRead: () => void;
  onNotificationClick: (notification: NotificationRow) => void;
  onViewAll: () => void;
}

/**
 *
 */
export function NotificationInbox({
  notifications,
  unread,
  onMarkAllRead,
  onNotificationClick,
  onViewAll,
}: NotificationInboxProps) {
  return (
    <div className="w-80">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <div className="text-sm font-semibold">Notifiche</div>
          <div className="text-xs text-muted-foreground">{unread} non lette</div>
        </div>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <CheckCheck className="size-3.5" />
          Segna tutte
        </button>
      </div>

      <div className="max-h-[360px] overflow-y-auto py-1">
        {notifications.map((notification) => {
          const unreadRow = !notification.read_at;
          const Icon = iconForType(notification.type);
          return (
            <button
              key={notification.id}
              type="button"
              onClick={() => onNotificationClick(notification)}
              className={cn(
                "flex w-full gap-2 px-3 py-2 text-left transition-colors hover:bg-muted",
                unreadRow && "bg-primary/10",
              )}
            >
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="truncate text-sm font-medium">{notification.title}</span>
                  {unreadRow && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                </span>
                {notification.body && (
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {notification.body}
                  </span>
                )}
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {relativeTime(notification.created_at)}
                </span>
              </span>
            </button>
          );
        })}
        {!notifications.length && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nessuna notifica
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onViewAll}
        className="flex w-full items-center justify-center gap-1 border-t px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        Vedi tutte
        <ExternalLink className="size-3.5" />
      </button>
    </div>
  );
}
