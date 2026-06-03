import { ChevronDown, ChevronUp, Edit3 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AUTOMATION_CATEGORY_OPTIONS } from "@/lib/automations/automation-ui-constants";
import type { TriggerDef, ConditionDef, ActionDef, ScheduleDef } from "@/types/automation";

/**
 *
 */
export default function ReviewStep({
  name,
  description,
  trigger,
  conditions,
  actions,
  schedule,
  category,
  onChangeName,
  onChangeDescription,
  onChangeCategory,
  onNavigateToStep,
}: {
  name: string;
  description: string | null;
  trigger: TriggerDef | null;
  conditions: ConditionDef[];
  actions: ActionDef[];
  schedule: ScheduleDef | null;
  category?: string | null;
  onChangeName: (s: string) => void;
  onChangeDescription: (s: string) => void;
  onChangeCategory?: (s: string) => void;
  onNavigateToStep?: (step: number) => void;
}) {
  const { t } = useTranslation("automations");
  const [jsonOpen, setJsonOpen] = useState(false);

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

  function renderConditionHuman(c: ConditionDef): string {
    const field = c.config?.field ?? "";
    const val = c.config?.value ?? "";
    switch (c.type) {
      case "field_equals": return t("filtersStep.human.field_equals", '{{field}} è "{{value}}"', { field, value: val });
      case "field_not_equals": return t("filtersStep.human.field_not_equals", '{{field}} non è "{{value}}"', { field, value: val });
      case "field_greater_than": return t("filtersStep.human.field_greater_than", "{{field}} > {{value}}", { field, value: val });
      case "field_less_than": return t("filtersStep.human.field_less_than", "{{field}} < {{value}}", { field, value: val });
      case "field_contains": return t("filtersStep.human.field_contains", '{{field}} contiene "{{value}}"', { field, value: val });
      case "field_starts_with": return t("filtersStep.human.field_starts_with", '{{field}} inizia con "{{value}}"', { field, value: val });
      case "field_ends_with": return t("filtersStep.human.field_ends_with", '{{field}} finisce con "{{value}}"', { field, value: val });
      case "priority_high": return t("filtersStep.human.priority_high", "Priorità è alta");
      case "tag_contains": return t("filtersStep.human.tag_contains", 'Tag contiene "{{value}}"', { value: val });
      default: return c.type;
    }
  }

  function generateHumanSummary(): string {
    if (!trigger) return t("reviewStep.incompleteConfig", "Configurazione incompleta");
    
    const triggerText = triggerLabels[trigger.type] || trigger.type;
    let result = t("reviewStep.summaryPrefix", "Quando") + " " + triggerText;
    
    // Add conditions
    if (conditions.length > 0) {
      const condTexts = conditions.map(renderConditionHuman);
      result += " " + t("reviewStep.withConditions", "con") + " " + condTexts.join(" " + t("filtersStep.and", "E") + " ");
    }
    
    // Add actions
    if (actions.length > 0) {
      result += " " + t("reviewStep.summaryActionSeparator", "→") + " ";
      const actionTexts = actions.map(a => actionLabels[a.type] || a.type);
      result += actionTexts.join(" " + t("filtersStep.and", "E") + " ");
    }
    
    return result;
  }

  function getTechnicalPayload() {
    return {
      name,
      description,
      category,
      trigger_definition: trigger,
      conditions_definition: conditions,
      actions_definition: actions,
      schedule_definition: schedule,
    };
  }

  return (
    <div>
      <h3 className="text-lg font-semibold">{t("reviewStep.title", "Controlla prima di salvare")}</h3>
      <p className="text-sm text-text3">
        {t("reviewStep.description", "Verifica che tutto sia corretto. Puoi tornare indietro per modificare.")}
      </p>

      <div className="mt-4 space-y-4">
        <div className="rounded-xl border-2 border-accent/20 bg-accent/5 p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-accent mb-2">
                {t("reviewStep.summaryTitle", "Riepilogo automazione")}
              </div>
              <div className="text-sm font-medium leading-relaxed">
                {generateHumanSummary()}
              </div>
            </div>
            {onNavigateToStep && (
              <button
                type="button"
                onClick={() => onNavigateToStep(1)}
                className="ml-2 flex items-center gap-1 rounded-md p-1.5 text-xs text-accent hover:bg-accent/10"
                title={t("reviewStep.editTrigger", "Modifica trigger")}
              >
                <Edit3 className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="automation-name" className="text-sm font-medium">{t("reviewStep.nameLabel", "Nome automazione")}</label>
          <input
            id="automation-name"
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder={t("reviewStep.namePlaceholder", "Dai un nome a questa automazione")}
          />
        </div>

        <div>
          <label htmlFor="automation-description" className="text-sm font-medium">{t("reviewStep.descriptionLabel", "Descrizione")}</label>
          <textarea
            id="automation-description"
            className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
            rows={2}
            value={description ?? ""}
            onChange={(e) => onChangeDescription(e.target.value)}
            placeholder={t("reviewStep.descriptionPlaceholder", "Descrivi brevemente cosa fa questa automazione")}
          />
        </div>

        {onChangeCategory && (
          <div>
            <label className="text-sm font-medium">{t("reviewStep.categoryLabel", "Categoria")}</label>
            <select
              className="mt-1 block w-full rounded-md border border-border px-3 py-2 text-sm bg-background"
              value={category ?? ""}
              onChange={(e) => onChangeCategory(e.target.value)}
            >
              <option value="">{t("reviewStep.noCategory", "Nessuna categoria")}</option>
              {AUTOMATION_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {trigger?.type === "scheduled" && Boolean(trigger.config?.cron) && (
          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">
              {t("reviewStep.scheduleLabel", "Schedulazione")}
            </div>
            <p className="mt-1 text-sm text-purple-800">
              Cron: {String(trigger.config?.cron)}
            </p>
          </div>
        )}

        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setJsonOpen(!jsonOpen)}
            className="flex w-full items-center justify-between rounded-lg p-3 text-left hover:bg-surface1"
            aria-expanded={jsonOpen}
          >
            <span className="text-sm font-medium">
              {t("reviewStep.technicalDetails", "Dettagli tecnici (JSON)")}
            </span>
            {jsonOpen ? (
              <ChevronUp className="size-4 text-text3" />
            ) : (
              <ChevronDown className="size-4 text-text3" />
            )}
          </button>
          {jsonOpen && (
            <div className="border-t border-border p-3">
              <pre className="max-h-60 overflow-auto rounded bg-surface2 p-3 text-xs font-mono text-text3">
                {JSON.stringify(getTechnicalPayload(), null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
