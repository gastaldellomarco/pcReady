import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Ticket,
  ClipboardCheck,
  Clock,
  MousePointerClick,
  AlertTriangle,
  Siren,
  ShieldAlert,
  ShieldX,
} from "lucide-react";
import type { TriggerDef } from "@/types/automation";

export default function TriggerStep({
  value,
  onChange,
}: {
  value: TriggerDef | null;
  onChange: (v: TriggerDef) => void;
}) {
  const { t } = useTranslation("automations");

  const TRIGGER_OPTIONS = [
    {
      value: "ticket_created",
      label: t("trigger.options.ticket_created", "Ticket created"),
      description: t("trigger.options.ticket_created_desc", "When a new ticket is opened"),
      icon: Ticket,
      color: "text-blue-600",
      bgColor: "bg-blue-50 border-blue-200",
    },
    {
      value: "ticket_updated",
      label: t("trigger.options.ticket_updated", "Ticket updated"),
      description: t("trigger.options.ticket_updated_desc", "When an existing ticket is modified"),
      icon: Ticket,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 border-indigo-200",
    },
    {
      value: "checklist_completed",
      label: t("trigger.options.checklist_completed", "Checklist completed"),
      description: t("trigger.options.checklist_completed_desc", "When a preparation checklist is completed"),
      icon: ClipboardCheck,
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 border-cyan-200",
    },
    {
      value: "sla_warning",
      label: t("trigger.options.sla_warning", "SLA expiring"),
      description: t("trigger.options.sla_warning_desc", "When a ticket is approaching its SLA deadline"),
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-50 border-amber-200",
    },
    {
      value: "sla_breached",
      label: t("trigger.options.sla_breached", "SLA breached"),
      description: t("trigger.options.sla_breached_desc", "When a ticket exceeds its SLA deadline"),
      icon: Siren,
      color: "text-red-600",
      bgColor: "bg-red-50 border-red-200",
    },
    {
      value: "warranty_expiring_soon",
      label: t("trigger.options.warranty_expiring_soon", "Warranty expiring"),
      description: t("trigger.options.warranty_expiring_soon_desc", "When a device warranty expires within N days"),
      icon: ShieldAlert,
      color: "text-orange-600",
      bgColor: "bg-orange-50 border-orange-200",
    },
    {
      value: "warranty_expired",
      label: t("trigger.options.warranty_expired", "Warranty expired"),
      description: t("trigger.options.warranty_expired_desc", "When a device has passed its warranty expiry date"),
      icon: ShieldX,
      color: "text-red-700",
      bgColor: "bg-red-50 border-red-200",
    },
    {
      value: "scheduled",
      label: t("trigger.options.scheduled", "Scheduled"),
      description: t("trigger.options.scheduled_desc", "Planned execution with a cron expression"),
      icon: Clock,
      color: "text-purple-600",
      bgColor: "bg-purple-50 border-purple-200",
    },
    {
      value: "manual",
      label: t("trigger.options.manual", "Manual"),
      description: t("trigger.options.manual_desc", "Executed only manually or from an external trigger"),
      icon: MousePointerClick,
      color: "text-slate-600",
      bgColor: "bg-slate-50 border-slate-200",
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold">{t("trigger.title", "Trigger")}</h3>
      <p className="text-sm text-text3">
        {t("trigger.subtitle", "Choose the event that will activate this automation rule.")}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {TRIGGER_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = value?.type === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ type: opt.value as TriggerDef["type"], config: {} })}
              className={cn(
                "flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
                isSelected
                  ? `${opt.bgColor} ${opt.color} border-current shadow-sm`
                  : "border-border bg-background hover:border-accent/40 hover:bg-accent/5",
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  isSelected ? `${opt.bgColor}` : "bg-surface2",
                )}
              >
                <Icon className={cn("h-5 w-5", isSelected ? opt.color : "text-text3")} />
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-sm font-semibold",
                    isSelected ? opt.color : "text-foreground",
                  )}
                >
                  {opt.label}
                </div>
                <div className="mt-0.5 text-xs text-text3 leading-relaxed">{opt.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {value?.type === "warranty_expiring_soon" && (
        <div className="mt-4">
          <label className="text-sm font-medium">
            {t("trigger.warrantyDaysLabel", "Days before expiry")}
          </label>
          <input
            type="number"
            min={1}
            max={365}
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
            value={(value.config?.days as number | string) ?? 30}
            onChange={(e) =>
              onChange({
                ...value,
                config: { ...(value.config || {}), days: Number(e.target.value || 30) },
              })
            }
            placeholder="30"
          />
          <p className="mt-1 text-xs text-text3">
            {t("trigger.warrantyDaysHelp", "Example: 30 sends the alert when the warranty expires within 30 days.")}
          </p>
        </div>
      )}

      {value?.type === "scheduled" && (
        <div className="mt-4">
          <label className="text-sm font-medium">
            {t("trigger.cronLabel", "Cron expression")}
          </label>
          <input
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
            value={(value.config?.cron as string) ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                config: { ...(value.config || {}), cron: e.target.value },
              })
            }
            placeholder={t("trigger.cronPlaceholder", "e.g. 0 8 * * * (every day at 8:00)")}
          />
          <p className="mt-1 text-xs text-text3">
            {t("trigger.cronHelp", "Standard 5-field cron format: minute hour day month weekday")}
          </p>
        </div>
      )}
    </div>
  );
}
