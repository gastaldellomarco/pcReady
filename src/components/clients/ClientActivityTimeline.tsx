import { CheckCircle2, FileText, History, Lock, LogIn, Package, Ticket } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ListSkeleton } from "@/components/page-states";
import { openTicketDetail } from "@/lib/detail-navigation";
import { fmtDate } from "@/lib/pcready";
import queries from "@/lib/queries/clients";

function activityIcon(type: string) {
  switch (type) {
    case "ticket_created":
      return <Ticket className="size-3.5" style={{ color: "var(--text3)" }} />;
    case "ticket_closed":
      return <CheckCircle2 className="size-3.5" style={{ color: "var(--text3)" }} />;
    case "note":
      return <Lock className="size-3.5" style={{ color: "var(--text3)" }} />;
    case "document":
      return <FileText className="size-3.5" style={{ color: "var(--text3)" }} />;
    case "portal_access":
      return <LogIn className="size-3.5" style={{ color: "var(--text3)" }} />;
    case "bundle":
      return <Package className="size-3.5" style={{ color: "var(--text3)" }} />;
    default:
      return <History className="size-3.5" style={{ color: "var(--text3)" }} />;
  }
}

function activityColor(type: string): string {
  switch (type) {
    case "ticket_created":
      return "#3B82F6";
    case "ticket_closed":
      return "#22C55E";
    case "note":
      return "#F59E0B";
    case "document":
      return "#8B5CF6";
    case "portal_access":
      return "#6366F1";
    case "bundle":
      return "#14B8A6";
    default:
      return "var(--text3)";
  }
}

function activityLabel(
  type: string,
  t: (key: string, fallback?: string) => string,
): string {
  switch (type) {
    case "ticket_created":
      return t("activity.labelTicketCreated", "Ticket aperto");
    case "ticket_closed":
      return t("activity.labelTicketClosed", "Ticket chiuso");
    case "note":
      return t("activity.labelNote", "Nota interna");
    case "document":
      return t("activity.labelDocument", "Documento");
    case "portal_access":
      return t("activity.labelPortalAccess", "Accesso portale");
    case "bundle":
      return t("activity.labelBundle", "Contratto");
    default:
      return type;
  }
}

/**
 *
 */
export function ClientActivityTimeline({ clientId }: { clientId: string }) {
  const { t } = useTranslation("clients");
  const activityQuery = (queries as any).useClientActivity(clientId);
  const items = (activityQuery.data ?? []) as import("@/lib/queries/clients").ClientActivityItem[];

  const goToLink = useCallback((link: string | undefined) => {
    if (!link) return;
    const parsed = new URL(link, window.location.origin);
    const id = parsed.searchParams.get("id");
    if (id) openTicketDetail(id);
  }, []);

  return (
    <div className="pc-card-body">
      {activityQuery.isLoading ? (
        <ListSkeleton rows={5} variant="app" />
      ) : items.length ? (
        <div className="space-y-0">
          {items.map((item, i) => {
            const icon = activityIcon(item.type);
            const isTicketAction = item.type === "ticket_created" || item.type === "ticket_closed";
            return (
              <div key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
                {/* Timeline connector */}
                {i < items.length - 1 && (
                  <div
                    className="absolute left-[15px] top-8 bottom-0 w-px"
                    style={{ background: "var(--border)" }}
                  />
                )}
                {/* Icon */}
                <div
                  className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "var(--surface2)" }}
                >
                  {icon}
                </div>
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {isTicketAction ? (
                        <button
                          type="button"
                          className="text-left text-[12.5px] font-semibold text-text2 hover:text-accent transition-colors"
                          onClick={() => goToLink(item.link)}
                        >
                          {item.title}
                        </button>
                      ) : (
                        <span className="text-[12.5px] font-semibold text-text2">
                          {item.title}
                        </span>
                      )}
                      {item.description && (
                        <span className="ml-1.5 text-[11.5px] text-text3">{item.description}</span>
                      )}
                    </div>
                    <span className="shrink-0 text-[10.5px] text-text3 font-mono">
                      {fmtDate(item.created_at)}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: "var(--surface2)",
                        color: activityColor(item.type),
                      }}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: activityColor(item.type) }}
                      />
                      {activityLabel(item.type, t as any)}
                    </span>
                    {isTicketAction && (
                      <button
                        type="button"
                        className="ml-2 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors hover:bg-[var(--surface2)]"
                        style={{ borderColor: "var(--border)", color: "var(--accent)" }}
                        onClick={() => goToLink(item.link)}
                      >
                        <Ticket className="size-3" />
                        {t("activity.viewTicket", "Vedi ticket")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="rounded-md border border-dashed p-8 text-center text-sm text-text3"
          style={{ borderColor: "var(--border)" }}
        >
          {t("activity.empty", "Nessuna attivita' disponibile.")}
        </div>
      )}
    </div>
  );
}
