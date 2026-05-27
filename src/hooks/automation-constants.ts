/**
 * automation-constants: costanti e utility condivise per le automation rules.
 * Separato da useAutomationFilters per ridurre le dipendenze incrociate
 * tra hook e componenti (AutomationRuleCard, AutomationDetailTabs, automations.lazy).
 */
import type { AutomationRule } from "@/types/automation";

/** Extract trigger type from a rule's flow_definition wizard data */
export function getRuleTriggerType(rule: AutomationRule): string {
  const wizard = rule.flow_definition?.meta?.wizard as Record<string, unknown> | undefined;
  if (wizard?.trigger_definition && typeof wizard.trigger_definition === "object") {
    const td = wizard.trigger_definition as Record<string, unknown>;
    return (td.type as string) || "manual";
  }
  return "manual";
}

/** Human-readable label for trigger type */
export const TRIGGER_TYPE_LABELS: Record<string, string> = {
  ticket_created: "Ticket creato",
  ticket_updated: "Ticket aggiornato",
  checklist_completed: "Checklist completata",
  sla_warning: "SLA in scadenza",
  sla_breached: "SLA violato",
  warranty_expiring_soon: "Garanzia in scadenza",
  warranty_expired: "Garanzia scaduta",
  scheduled: "Schedulato",
  manual: "Manuale",
};

export const TRIGGER_TYPE_OPTIONS = [
  { value: "", label: "Tutti i trigger" },
  { value: "ticket_created", label: "Ticket creato" },
  { value: "ticket_updated", label: "Ticket aggiornato" },
  { value: "checklist_completed", label: "Checklist completata" },
  { value: "sla_warning", label: "SLA in scadenza" },
  { value: "sla_breached", label: "SLA violato" },
  { value: "warranty_expiring_soon", label: "Garanzia in scadenza" },
  { value: "warranty_expired", label: "Garanzia scaduta" },
  { value: "scheduled", label: "Schedulato" },
  { value: "manual", label: "Manuale" },
];
