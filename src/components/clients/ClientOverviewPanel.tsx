import { Bell, Clock, FileText, Pencil, Ticket, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatMoney } from "@/lib/format";
import { SummaryBox } from "./helpers";
import { formatHours } from "./helpers.fast";

/**
 *
 */
export function ClientOverviewPanel({
  overview,
  loading,
  contactsCount,
  devicesCount,
  onOpenTickets,
  onOpenDocuments,
  onOpenSettings,
}: {
  overview: import("@/lib/queries/clients").ClientOverview | null | undefined;
  loading: boolean;
  contactsCount: number;
  devicesCount: number;
  onOpenTickets: () => void;
  onOpenDocuments: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation("clients");
  const bundle = overview?.activeBundle;
  return (
    <div className="pc-card-body space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          className="rounded-md border p-3 text-left"
          style={{ borderColor: "var(--border)" }}
          onClick={onOpenTickets}
        >
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-text3">
            <Ticket className="h-3.5 w-3.5" /> {t("overview.openTickets", "Ticket aperti")}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold">
            {loading ? "..." : (overview?.openTickets ?? 0)}
          </div>
        </button>
        <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-text3">
            <Clock className="h-3.5 w-3.5" />{" "}
            {t("overview.avgResolution", "Tempo medio risoluzione")}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold">
            {loading ? "..." : formatHours(overview?.avgResolutionHours)}
          </div>
        </div>
        <div className="rounded-md border p-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-text3">
            <FileText className="h-3.5 w-3.5" /> {t("overview.totalBilled", "Fatturato")}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold">
            {loading ? "..." : formatMoney(overview?.totalBilled ?? 0)}
          </div>
        </div>
        <button
          type="button"
          className="rounded-md border p-3 text-left"
          style={{ borderColor: "var(--border)" }}
          onClick={onOpenSettings}
        >
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase text-text3">
            <Bell className="h-3.5 w-3.5" /> {t("overview.contractExpiry", "Scadenza contratto")}
          </div>
          <div className="mt-2 font-mono text-2xl font-bold">
            {loading
              ? "..."
              : overview?.contractDaysLeft == null
                ? "-"
                : `${overview.contractDaysLeft}g`}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div
          className="rounded-md border p-4"
          style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-bold">
                {t("overview.bundleTitle", "Bundle assistenza attivo")}
              </div>
              <div className="text-xs text-text3">
                {t("overview.bundleSubtitle", "SLA effettivi e scadenza contratto")}
              </div>
            </div>
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              type="button"
              onClick={onOpenSettings}
            >
              <Pencil className="size-3" /> {t("overview.configure", "Configura")}
            </button>
          </div>
          {bundle ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div
                className="rounded-md border px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="text-[10px] uppercase text-text3">
                  {t("overview.bundleName", "Nome")}
                </div>
                <div className="truncate text-sm font-semibold">
                  {bundle.bundle_name ?? bundle.name ?? "-"}
                </div>
              </div>
              <div
                className="rounded-md border px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="text-[10px] uppercase text-text3">
                  {t("overview.responseSla", "Risposta")}
                </div>
                <div className="font-mono text-sm font-semibold">
                  {formatHours(bundle.effective_sla_response_hours)}
                </div>
              </div>
              <div
                className="rounded-md border px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="text-[10px] uppercase text-text3">
                  {t("overview.resolutionSla", "Risoluzione")}
                </div>
                <div className="font-mono text-sm font-semibold">
                  {formatHours(bundle.effective_sla_resolution_hours)}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="rounded-md border border-dashed px-3 py-5 text-sm text-text3"
              style={{ borderColor: "var(--border)" }}
            >
              {t("overview.noBundle", "Nessun bundle attivo collegato a questo cliente.")}
            </div>
          )}
        </div>
        <div className="rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
          <div className="text-sm font-bold">{t("overview.quickStats", "Scheda cliente")}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <SummaryBox label={t("overview.contacts", "Referenti")} value={contactsCount} />
            <SummaryBox label={t("overview.devices", "Device")} value={devicesCount} />
          </div>
          <button
            className="pc-btn pc-btn-primary pc-btn-sm mt-3 w-full"
            type="button"
            onClick={onOpenDocuments}
          >
            <Upload className="size-3" /> {t("overview.uploadDocument", "Carica documento")}
          </button>
        </div>
      </div>
    </div>
  );
}


