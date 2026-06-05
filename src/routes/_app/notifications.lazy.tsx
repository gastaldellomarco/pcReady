import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { iconForType, relativeTime } from "@/components/layout/notification-utils";
import { ListSkeleton, PageEmptyState, PageFetchError } from "@/components/page-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import {
  deleteReadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATION_TYPES,
  type NotificationRow,
  type NotificationType,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/_app/notifications")({
  component: NotificationsPage,
});

const PAGE_SIZE = 20;

function NotificationsPage() {
  const { t } = useTranslation("notifications");
  const { session } = useAuth();
  const navigate = useNavigate();
  const loadNotifications = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationRead);
  const markAllRead = useServerFn(markAllNotificationsRead);
  const deleteRead = useServerFn(deleteReadNotifications);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<"all" | "unread">("all");
  const [type, setType] = useState<"all" | NotificationType>("all");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await loadNotifications({
        data: {
          accessToken: session.access_token,
          limit: PAGE_SIZE,
          page,
          unreadOnly: view === "unread",
          type: type === "all" ? null : type,
        },
      });
      const result = data as { rows: NotificationRow[]; total: number };
      setRows(result.rows);
      setTotal(result.total);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : t("errors.loadFailed", "Impossibile caricare notifiche"),
      );
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, page, view, type, loadNotifications]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(0);
  }, [view, type]);

  async function openNotification(notification: NotificationRow) {
    if (!session?.access_token) return;
    try {
      if (!notification.read_at) {
        await markRead({
          data: { accessToken: session.access_token, notificationId: notification.id },
        });
      }
      if (notification.link) navigate({ to: notification.link });
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("toast.operationFailed", "Operazione non riuscita"),
      );
    }
  }

  async function markAll() {
    if (!session?.access_token) return;
    try {
      await markAllRead({ data: { accessToken: session.access_token } });
      await load();
      toast.success(t("toast.markedRead", "Notifiche segnate come lette"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("toast.operationFailed", "Operazione non riuscita"),
      );
    }
  }

  async function removeRead() {
    if (!session?.access_token) return;
    try {
      await deleteRead({ data: { accessToken: session.access_token } });
      await load();
      toast.success(t("toast.deletedRead", "Notifiche lette eliminate"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("toast.deleteFailed", "Eliminazione non riuscita"),
      );
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const typeLabel = (type: NotificationType) => {
    if (type === "ticket_assigned") return t("types.ticket_assigned", "Ticket assegnato");
    if (type === "ticket_status_changed")
      return t("types.ticket_status_changed", "Cambio stato ticket");
    if (type === "ticket_comment") return t("types.ticket_comment", "Commento ticket");
    if (type === "automation_failed") return t("types.automation_failed", "Automazione fallita");
    if (type === "device_status_changed")
      return t("types.device_status_changed", "Cambio stato dispositivo");
    if (type === "checklist_completed")
      return t("types.checklist_completed", "Checklist completata");
    if (type === "user_invited") return t("types.user_invited", "Utente invitato");
    return t("types.mention", "Menzione");
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {loadError && <PageFetchError message={loadError} onRetry={() => void load()} />}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={view} onValueChange={(value) => setView(value as "all" | "unread")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.all", "Tutte")}</SelectItem>
            <SelectItem value="unread">{t("filters.unread", "Non lette")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filters.allTypes", "Tutti i tipi")}</SelectItem>
            {NOTIFICATION_TYPES.map((item) => (
              <SelectItem key={item} value={item}>
                {typeLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-text3 font-mono">{t("count", { count: total })}</span>
        <Button variant="outline" size="sm" onClick={markAll}>
          <CheckCheck className="size-4" />
          {t("actions.markAllRead", "Segna tutte")}
        </Button>
        <Button variant="outline" size="sm" onClick={removeRead}>
          <Trash2 className="size-4" />
          {t("actions.deleteRead", "Elimina lette")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("card.title", "Inbox notifiche")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && (
            <div className="px-4 py-4">
              <ListSkeleton rows={6} variant="app" />
            </div>
          )}
          {!loading &&
            rows.map((notification) => {
              const Icon = iconForType(notification.type);
              const unread = !notification.read_at;
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className={cn(
                    "flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-muted",
                    unread && "bg-primary/10",
                  )}
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{notification.title}</span>
                      {unread && <span className="size-2 rounded-full bg-primary" />}
                    </span>
                    {notification.body && (
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {notification.body}
                      </span>
                    )}
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {typeLabel(notification.type)} - {relativeTime(notification.created_at)}
                    </span>
                  </span>
                </button>
              );
            })}
          {!loading && !rows.length && (
            <div className="px-4 py-6">
              <PageEmptyState
                className="border-0 shadow-none bg-transparent"
                title={t("empty.title", "Nessuna notifica")}
                description={t(
                  "empty.description",
                  "Non ci sono elementi che corrispondono ai filtri selezionati.",
                )}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 1))}
        >
          {t("pagination.previous", "Precedente")}
        </Button>
        <span className="text-xs text-text3 font-mono">
          {t("pagination.pageInfo", { current: page + 1, total: pageCount })}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page + 1 >= pageCount}
          onClick={() => setPage((current) => current + 1)}
        >
          {t("pagination.next", "Successiva")}
        </Button>
      </div>
    </div>
  );
}
