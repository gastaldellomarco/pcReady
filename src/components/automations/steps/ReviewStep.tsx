import { useTranslation } from "react-i18next";
import { AUTOMATION_CATEGORY_OPTIONS } from "@/lib/automations/automation-ui-constants";
import type { TriggerDef, ConditionDef, ActionDef, ScheduleDef } from "@/types/automation";

export default function ReviewStep({
  name,
  description,
  trigger,
  conditions,
  actions,
  schedule,
  summary,
  category,
  onChangeName,
  onChangeDescription,
  onChangeCategory,
}: {
  name: string;
  description: string | null;
  trigger: TriggerDef | null;
  conditions: ConditionDef[];
  actions: ActionDef[];
  schedule: ScheduleDef | null;
  summary: string;
  category?: string | null;
  onChangeName: (s: string) => void;
  onChangeDescription: (s: string) => void;
  onChangeCategory?: (s: string) => void;
}) {
  const { t } = useTranslation("automations");

  const triggerLabels: Record<string, string> = {
    ticket_created: t("trigger.options.ticket_created", "Ticket created"),
    ticket_updated: t("trigger.options.ticket_updated", "Ticket updated"),
    checklist_completed: t("trigger.options.checklist_completed", "Checklist completed"),
    sla_warning: t("trigger.options.sla_warning", "SLA expiring"),
    sla_breached: t("trigger.options.sla_breached", "SLA breached"),
    warranty_expiring_soon: t("trigger.options.warranty_expiring_soon", "Warranty expiring"),
    warranty_expired: t("trigger.options.warranty_expired", "Warranty expired"),
    scheduled: t("trigger.options.scheduled", "Scheduled"),
    manual: t("trigger.options.manual", "Manual"),
  };

  const actionLabels: Record<string, string> = {
    send_email: t("actions.types.send_email", "Send email"),
    update_ticket_status: t("actions.types.update_ticket_status", "Update ticket status"),
    create_notification: t("actions.types.create_notification", "In-app notification"),
    update_device_status: t("actions.types.update_device_status", "Update device status"),
    assign_ticket: t("actions.types.assign_ticket", "Assign ticket"),
  };

  function renderConditionLabel(c: ConditionDef): string {
    const field = c.config?.field ?? "";
    const val = c.config?.value ?? "";
    switch (c.type) {
      case "field_equals": return t("review.conditionFieldEquals", 'Field "{{field}}" = "{{value}}"', { field, value: val });
      case "field_not_equals": return t("review.conditionFieldNotEquals", 'Field "{{field}}" != "{{value}}"', { field, value: val });
      case "field_greater_than": return t("review.conditionFieldGreaterThan", 'Field "{{field}}" > "{{value}}"', { field, value: val });
      case "field_less_than": return t("review.conditionFieldLessThan", 'Field "{{field}}" < "{{value}}"', { field, value: val });
      case "field_contains": return t("review.conditionFieldContains", 'Field "{{field}}" contains "{{value}}"', { field, value: val });
      case "field_starts_with": return t("review.conditionFieldStartsWith", 'Field "{{field}}" starts with "{{value}}"', { field, value: val });
      case "field_ends_with": return t("review.conditionFieldEndsWith", 'Field "{{field}}" ends with "{{value}}"', { field, value: val });
      case "priority_high": return t("review.conditionPriorityHigh", "High priority");
      case "tag_contains": return t("review.conditionTagContains", 'Tag contains "{{value}}"', { value: val });
      default: return c.type;
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold">{t("review.title", "Review")}</h3>
      <p className="text-sm text-text3">
        {t("review.subtitle", "Check the rule configuration before saving.")}
      </p>

      <div className="mt-4 space-y-4">
        {/* Name */}
        <div>
          <label className="text-sm font-medium">{t("review.nameLabel", "Rule name")}</label>
          <input
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder={t("review.namePlaceholder", "Give the rule a name")}
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium">{t("review.descriptionLabel", "Description")}</label>
          <textarea
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
            rows={2}
            value={description ?? ""}
            onChange={(e) => onChangeDescription(e.target.value)}
            placeholder={t("review.descriptionPlaceholder", "Briefly describe what this rule does")}
          />
        </div>

        {/* Category */}
        {onChangeCategory && (
          <div>
            <label className="text-sm font-medium">{t("review.categoryLabel", "Category")}</label>
            <select
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
              value={category ?? ""}
              onChange={(e) => onChangeCategory(e.target.value)}
            >
              <option value="">{t("review.noCategory", "No category")}</option>
              {AUTOMATION_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Summary preview card */}
        <div className="rounded-xl border-2 border-accent/20 bg-accent/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-accent">
            {t("review.previewTitle", "Rule preview")}
          </div>
          <div className="mt-2 text-sm font-medium">
            {summary || t("review.incompleteConfig", "Incomplete configuration")}
          </div>
        </div>

        {/* Trigger */}
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
            {t("review.triggerLabel", "Trigger")}
          </div>
          <p className="mt-1 text-sm text-blue-800">
            {trigger?.type
              ? (triggerLabels[trigger.type] ?? trigger.type)
              : t("review.notConfigured", "Not configured")}
          </p>
          {trigger?.config && Object.keys(trigger.config).length > 0 && (
            <pre className="mt-1 max-h-20 overflow-auto rounded bg-blue-100/50 p-1.5 text-[11px] font-mono text-blue-800">
              {JSON.stringify(trigger.config, null, 2)}
            </pre>
          )}
        </div>

        {/* Conditions */}
        {conditions && conditions.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              {t("review.conditionsLabel", "Conditions")} ({conditions.length})
            </div>
            <ul className="mt-1 space-y-1">
              {conditions.map((c, i) => (
                <li key={c.id ?? i} className="text-sm text-amber-800">
                  {renderConditionLabel(c)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        {actions && actions.length > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              {t("review.actionsLabel", "Actions")} ({actions.length})
            </div>
            <ul className="mt-1 space-y-1.5">
              {actions.map((a, i) => (
                <li key={a.id ?? i} className="text-sm text-emerald-800">
                  <span className="font-semibold">{actionLabels[a.type ?? ""] ?? a.type}</span>
                  {a.config && Object.keys(a.config).length > 0 && (
                    <pre className="mt-0.5 max-h-20 overflow-auto rounded bg-emerald-100/50 p-1.5 text-[11px] font-mono text-emerald-800">
                      {JSON.stringify(a.config, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Schedule */}
        {schedule && schedule.type && schedule.type !== "none" && (
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">
              {t("review.scheduleLabel", "Schedule")}
            </div>
            <p className="mt-1 text-sm text-purple-800">
              {schedule.type === "cron"
                ? `${t("review.cronPrefix", "Cron: ")}${schedule.cron ?? "-"}`
                : schedule.type === "interval"
                  ? `${t("review.intervalPrefix", "Interval: every ")}${schedule.interval ?? "?"}`
                  : schedule.type}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
