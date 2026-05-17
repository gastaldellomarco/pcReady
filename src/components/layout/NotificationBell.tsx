import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationInbox } from "./NotificationInbox";

export function NotificationBell() {
  const { session, user } = useAuth();
  const navigate = useNavigate();
  const loadNotifications = useServerFn(listNotifications);
  const loadUnread = useServerFn(getUnreadNotificationCount);
  const markRead = useServerFn(markNotificationRead);
  const markAllRead = useServerFn(markAllNotificationsRead);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  const refresh = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const [list, count] = await Promise.all([
        loadNotifications({
          data: { accessToken: session.access_token, limit: 10, page: 0, unreadOnly: false },
        }),
        loadUnread({ data: { accessToken: session.access_token } }),
      ]);
      const notificationList = list as { rows: NotificationRow[] };
      const unreadCount = count as { unread: number };
      setNotifications(notificationList.rows);
      setUnread(unreadCount.unread);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossibile caricare notifiche");
    }
  }, [loadNotifications, loadUnread, session?.access_token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const next = payload.new as NotificationRow;
          setUnread((current) => current + 1);
          setNotifications((current) => [next, ...current].slice(0, 10));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  async function handleMarkAllRead() {
    if (!session?.access_token) return;
    try {
      await markAllRead({ data: { accessToken: session.access_token } });
      setUnread(0);
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at || new Date().toISOString(),
        })),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operazione non riuscita");
    }
  }

  async function handleClick(notification: NotificationRow) {
    if (!session?.access_token) return;
    try {
      if (!notification.read_at) {
        await markRead({
          data: { accessToken: session.access_token, notificationId: notification.id },
        });
        setUnread((current) => Math.max(0, current - 1));
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item,
          ),
        );
      }
      setOpen(false);
      if (notification.link) navigate({ to: notification.link });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notifica non aggiornata");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <NotificationInbox
          notifications={notifications}
          unread={unread}
          onMarkAllRead={handleMarkAllRead}
          onNotificationClick={handleClick}
          onViewAll={() => {
            setOpen(false);
            navigate({ to: "/notifications" });
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
