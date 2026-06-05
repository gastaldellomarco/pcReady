import type { AutomationRule } from "@/types/automation";

/**
 *
 */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/**
 *
 */
export interface CompletenessResult {
  complete: boolean;
  missing: string[];
}

const ACTION_RISK_MAP: Record<string, RiskLevel> = {
  send_email: "medium",
  update_ticket_status: "high",
  create_notification: "low",
  update_device_status: "high",
  assign_ticket: "high",
};

const ACTION_SIDE_EFFECTS: Record<string, string[]> = {
  send_email: [
    "Invia email a utenti reali — potenziale spam se mal configurata",
    "Consuma quota email del provider",
  ],
  update_ticket_status: [
    "Modifica lo stato del ticket nel sistema",
    "Impatto sul flusso di lavoro ticket e notifiche collegate",
  ],
  create_notification: ["Crea notifiche in-app per gli utenti destinatari"],
  update_device_status: [
    "Modifica lo stato del dispositivo nell'inventario",
    "Potrebbe alterare la visibilità e la disponibilità del dispositivo",
  ],
  assign_ticket: ["Riassegna il ticket a un altro tecnico", "Invia notifica al nuovo assegnatario"],
};

const ACTION_IMPACTS: Record<string, string> = {
  send_email: "Invia una email di notifica",
  update_ticket_status: "Aggiorna lo stato di un ticket",
  create_notification: "Crea una notifica in-app",
  update_device_status: "Modifica lo stato di un dispositivo",
  assign_ticket: "Assegna ticket a un tecnico",
};

/**
 * Compute the overall risk level of an automation rule based on its actions.
 */
export function computeRiskLevel(rule: AutomationRule): RiskLevel {
  const actionsDef = rule.flow_definition?.meta?.wizard?.actions_definition ?? [];
  if (actionsDef.length === 0) return "low";

  const hasSchedule =
    rule.flow_definition?.meta?.wizard?.schedule_definition?.type !== undefined &&
    rule.flow_definition?.meta?.wizard?.schedule_definition?.type !== "none";

  const levels = actionsDef.map((a) => ACTION_RISK_MAP[a.type ?? ""] ?? "medium");

  // Scheduled automations with high-risk actions are critical
  if (hasSchedule && levels.includes("high")) return "critical";
  if (levels.includes("critical")) return "critical";
  if (levels.includes("high")) return "high";
  if (levels.includes("medium")) return "medium";
  return "low";
}

/**
 * Check if an automation rule has all required fields configured.
 */
export function checkCompleteness(rule: AutomationRule): CompletenessResult {
  const missing: string[] = [];
  const wizard = rule.flow_definition?.meta?.wizard;

  if (!wizard?.trigger_definition?.type) {
    missing.push("Trigger non configurato");
  }

  const actionsDef = wizard?.actions_definition ?? [];
  if (actionsDef.length === 0) {
    missing.push("Nessuna azione definita");
  }

  // Check if conditions have values where needed
  const conditionsDef = wizard?.conditions_definition ?? [];
  for (const condition of conditionsDef) {
    if (!condition.type) {
      missing.push("Condizione senza tipo");
    } else if (
      (condition.type === "field_equals" ||
        condition.type === "field_not_equals" ||
        condition.type === "field_contains") &&
      !condition.config?.value
    ) {
      missing.push(`Condizione "${condition.type}" senza valore di confronto`);
    }
  }

  // Check schedule validity
  const scheduleDef = wizard?.schedule_definition;
  if (scheduleDef?.type === "cron" && !scheduleDef.cron) {
    missing.push("Schedule cron senza espressione");
  }

  return {
    complete: missing.length === 0,
    missing,
  };
}

/**
 * Get human-readable impact descriptions of what this automation will do.
 */
export function getImpactDescription(rule: AutomationRule): string[] {
  const impacts: string[] = [];
  const actionsDef = rule.flow_definition?.meta?.wizard?.actions_definition ?? [];

  const triggers: Record<string, string> = {
    ticket_created: "Alla creazione di un ticket",
    ticket_updated: "All'aggiornamento di un ticket",
    checklist_completed: "Al completamento di una checklist",
    scheduled: "Alla scadenza della schedule",
    manual: "Esecuzione manuale",
  };

  const triggerType = rule.flow_definition?.meta?.wizard?.trigger_definition?.type;
  if (triggerType) {
    impacts.push(`Trigger: ${triggers[triggerType] ?? triggerType}`);
  }

  for (const action of actionsDef) {
    const label = ACTION_IMPACTS[action.type ?? ""] ?? action.type;
    const configStr = action.config
      ? Object.entries(action.config)
          .filter(([_, v]) => v !== undefined && v !== null && v !== "")
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(", ")
      : "";
    impacts.push(`  → ${label}${configStr ? ` (${configStr})` : ""}`);
  }

  return impacts;
}

/**
 * Get external side effects that the user should be aware of.
 */
export function getSideEffects(rule: AutomationRule): string[] {
  const effects: string[] = [];
  const actionsDef = rule.flow_definition?.meta?.wizard?.actions_definition ?? [];

  for (const action of actionsDef) {
    const actionEffects = ACTION_SIDE_EFFECTS[action.type ?? ""];
    if (actionEffects) {
      effects.push(...actionEffects);
    }
  }

  return [...new Set(effects)];
}

export const RISK_LEVEL_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; bg: string; border: string }
> = {
  low: {
    label: "Basso",
    color: "text-emerald-700",
    bg: "bg-emerald-100",
    border: "border-emerald-200",
  },
  medium: {
    label: "Medio",
    color: "text-amber-700",
    bg: "bg-amber-100",
    border: "border-amber-200",
  },
  high: {
    label: "Alto",
    color: "text-orange-700",
    bg: "bg-orange-100",
    border: "border-orange-200",
  },
  critical: {
    label: "Critico",
    color: "text-red-700",
    bg: "bg-red-100",
    border: "border-red-200",
  },
};
