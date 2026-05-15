import type {
  WizardFlowPayload,
  ActionDef,
  ConditionDef,
  TriggerDef,
  ScheduleDef,
} from "@/types/automation";

// ─── Error Types ─────────────────────────────────────────────────────

export interface FlowValidationError {
  /** Section identifying where the error is (e.g. "trigger", "action.0", "graph") */
  path: string;
  message: string;
  /** Severity: "error" blocks saving, "warning" allows save but warns */
  severity: "error" | "warning";
}

export interface FlowValidationResult {
  valid: boolean;
  errors: FlowValidationError[];
}

// ─── Action Config Requirements ──────────────────────────────────────

interface ActionRequirement {
  actionType: string;
  label: string;
  requiredFields: Array<{
    key: string;
    label: string;
    /** If true, the field must have a non-empty value */
    mustHaveValue: boolean;
    /** If true, the field is optional for guided mode but recommended */
    optional?: boolean;
  }>;
}

const ACTION_REQUIREMENTS: ActionRequirement[] = [
  {
    actionType: "send_email",
    label: "Invia email",
    requiredFields: [
      { key: "subject", label: "Oggetto", mustHaveValue: true },
      { key: "body", label: "Corpo", mustHaveValue: true },
      { key: "to", label: "Destinatario", mustHaveValue: false, optional: true },
    ],
  },
  {
    actionType: "update_ticket_status",
    label: "Aggiorna stato ticket",
    requiredFields: [
      { key: "status", label: "Stato", mustHaveValue: true },
    ],
  },
  {
    actionType: "create_notification",
    label: "Notifica in-app",
    requiredFields: [
      { key: "type", label: "Tipo notifica", mustHaveValue: true },
      { key: "title", label: "Titolo", mustHaveValue: true },
    ],
  },
  {
    actionType: "update_device_status",
    label: "Aggiorna stato dispositivo",
    requiredFields: [
      { key: "status", label: "Stato", mustHaveValue: true },
    ],
  },
  {
    actionType: "assign_ticket",
    label: "Assegna ticket",
    requiredFields: [
      { key: "assignee_id", label: "Assegnatario", mustHaveValue: true },
    ],
  },
];

// ─── Wizard (Guided Mode) Validation ─────────────────────────────────

/**
 * Validates a WizardFlowPayload before saving.
 * Checks: trigger required, actions required, action configs complete,
 * conditions have values, schedule valid.
 */
export function validateWizardPayload(payload: WizardFlowPayload): FlowValidationResult {
  const errors: FlowValidationError[] = [];

  // 1. Name
  if (!payload.name || payload.name.trim() === "") {
    errors.push({
      path: "name",
      message: "Il nome dell'automazione è obbligatorio.",
      severity: "error",
    });
  }

  // 2. Trigger
  if (!payload.trigger_definition?.type) {
    errors.push({
      path: "trigger",
      message: "Seleziona un trigger per l'automazione.",
      severity: "error",
    });
  } else {
    const trigger = payload.trigger_definition;
    validateTrigger(trigger, errors);
  }

  // 3. Actions
  const actions = payload.actions_definition ?? [];
  if (actions.length === 0) {
    errors.push({
      path: "actions",
      message: "Aggiungi almeno un'azione da eseguire.",
      severity: "error",
    });
  } else {
    actions.forEach((action, idx) => {
      validateAction(action, idx, errors);
    });
  }

  // 4. Conditions
  const conditions = payload.conditions_definition ?? [];
  conditions.forEach((condition, idx) => {
    validateCondition(condition, idx, errors);
  });

  // 5. Schedule
  const schedule = payload.schedule_definition;
  if (schedule?.type && schedule.type !== "none") {
    validateSchedule(schedule, errors);
  }

  // 6. Overall coherence
  if (payload.trigger_definition?.type && actions.length > 0) {
    validateTriggerActionCoherence(payload.trigger_definition, actions, errors);
  }

  return {
    valid: errors.filter((e) => e.severity === "error").length === 0,
    errors,
  };
}

function validateTrigger(trigger: TriggerDef, errors: FlowValidationError[]): void {
  const validTypes = [
    "ticket_created",
    "ticket_updated",
    "checklist_completed",
    "scheduled",
    "manual",
  ];
  if (!validTypes.includes(trigger.type)) {
    errors.push({
      path: "trigger",
      message: `Tipo trigger "${trigger.type}" non valido.`,
      severity: "error",
    });
  }

  // Scheduled trigger needs a cron expression
  if (trigger.type === "scheduled") {
    const cron = (trigger.config?.cron as string) ?? "";
    if (!cron || cron.trim() === "") {
      errors.push({
        path: "trigger.config.cron",
        message: "Per trigger schedulati è necessaria un'espressione cron.",
        severity: "error",
      });
    } else {
      // Basic cron validation — 5 fields separated by spaces
      const parts = cron.trim().split(/\s+/);
      if (parts.length !== 5) {
        errors.push({
          path: "trigger.config.cron",
          message: "Espressione cron non valida. Il formato richiede 5 campi (minuto ora giorno mese giorno-settimana).",
          severity: "error",
        });
      }
    }
  }
}

function validateAction(action: ActionDef, idx: number, errors: FlowValidationError[]): void {
  const path = `actions[${idx}]`;

  if (!action.type) {
    errors.push({
      path,
      message: `Azione #${idx + 1}: tipo non selezionato.`,
      severity: "error",
    });
    return;
  }

  const requirement = ACTION_REQUIREMENTS.find((r) => r.actionType === action.type);
  if (!requirement) {
    errors.push({
      path,
      message: `Azione #${idx + 1}: tipo "${action.type}" sconosciuto.`,
      severity: "error",
    });
    return;
  }

  const config = action.config ?? {};
  for (const field of requirement.requiredFields) {
    const value = config[field.key];
    const isEmpty = value === undefined || value === null || value === "";
    const isMissing = value === undefined;

    if (field.mustHaveValue && isEmpty) {
      errors.push({
        path: `${path}.config.${field.key}`,
        message: `"${requirement.label}" #${idx + 1}: "${field.label}" è obbligatorio.`,
        severity: "error",
      });
    } else if (!field.optional && isMissing && field.mustHaveValue) {
      errors.push({
        path: `${path}.config.${field.key}`,
        message: `"${requirement.label}" #${idx + 1}: "${field.label}" non configurato.`,
        severity: "error",
      });
    }
  }
}

function validateCondition(condition: ConditionDef, idx: number, errors: FlowValidationError[]): void {
  const path = `conditions[${idx}]`;

  if (!condition.type) {
    errors.push({
      path,
      message: `Condizione #${idx + 1}: tipo non selezionato.`,
      severity: "error",
    });
    return;
  }

  // Conditions that require field + value
  const needsFields = [
    "field_equals",
    "field_not_equals",
    "field_greater_than",
    "field_less_than",
    "field_contains",
    "field_starts_with",
    "field_ends_with",
  ] as const;

  if (needsFields.includes(condition.type as any)) {
    if (!condition.config?.field || condition.config.field === "") {
      errors.push({
        path: `${path}.config.field`,
        message: `Condizione #${idx + 1}: specifica il campo da confrontare.`,
        severity: "error",
      });
    }
    if (!condition.config?.value || condition.config.value === "") {
      errors.push({
        path: `${path}.config.value`,
        message: `Condizione #${idx + 1}: specifica il valore di confronto.`,
        severity: "error",
      });
    }
  }

  // Tag contains needs a value
  if (condition.type === "tag_contains") {
    if (!condition.config?.value || condition.config.value === "") {
      errors.push({
        path: `${path}.config.value`,
        message: `Condizione #${idx + 1}: specifica il tag da cercare.`,
        severity: "error",
      });
    }
  }
}

function validateSchedule(schedule: ScheduleDef, errors: FlowValidationError[]): void {
  if (schedule.type === "cron") {
    if (!schedule.cron || schedule.cron.trim() === "") {
      errors.push({
        path: "schedule.cron",
        message: "Specifica un'espressione cron per la schedule.",
        severity: "error",
      });
    } else {
      const parts = schedule.cron.trim().split(/\s+/);
      if (parts.length !== 5) {
        errors.push({
          path: "schedule.cron",
          message: "Espressione cron non valida: servono 5 campi (minuto ora giorno mese giorno-settimana).",
          severity: "error",
        });
      }
    }
  }
  if (schedule.type === "interval") {
    if (!schedule.interval || schedule.interval.trim() === "") {
      errors.push({
        path: "schedule.interval",
        message: "Specifica un intervallo per la schedule.",
        severity: "error",
      });
    }
  }
}

function validateTriggerActionCoherence(
  trigger: TriggerDef,
  actions: ActionDef[],
  errors: FlowValidationError[],
): void {
  // Warn about mismatched configurations
  for (let idx = 0; idx < actions.length; idx++) {
    const action = actions[idx];
    const config = action.config ?? {};

    // For update_ticket_status, warn about hardcoded ticket_id when trigger provides it
    if (action.type === "update_ticket_status" && config.ticket_id && trigger.type !== "manual") {
      errors.push({
        path: `actions[${idx}].config.ticket_id`,
        message: `"${ACTION_REQUIREMENTS.find((r) => r.actionType === action.type)?.label ?? action.type}" #${idx + 1}: ticket_id fisso potrebbe ignorare il ticket dal trigger.`,
        severity: "warning",
      });
    }

    // For assign_ticket, same warning
    if (action.type === "assign_ticket" && config.ticket_id && trigger.type !== "manual") {
      errors.push({
        path: `actions[${idx}].config.ticket_id`,
        message: `"Assegna ticket" #${idx + 1}: ticket_id fisso potrebbe ignorare il ticket dal trigger.`,
        severity: "warning",
      });
    }
  }
}

// ─── Graph (Advanced Mode) Validation ─────────────────────────────────

interface GraphNode {
  id: string;
  type?: string;
  data?: {
    type?: string;
    label?: string;
    config?: Record<string, unknown>;
    actionType?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

/**
 * Validates a React Flow graph (nodes + edges) before saving.
 * Checks:
 *  - At least one trigger node
 *  - At least one action node
 *  - All nodes reachable from a trigger
 *  - Edges connect existing nodes
 *  - Each action node has minimum config
 *  - No duplicate node IDs
 */
export function validateFlowGraph(nodes: GraphNode[], edges: GraphEdge[]): FlowValidationResult {
  const errors: FlowValidationError[] = [];

  // 1. Check for empty graph
  if (nodes.length === 0) {
    errors.push({
      path: "graph",
      message: "Il canvas è vuoto. Aggiungi almeno un trigger e un'azione.",
      severity: "error",
    });
    return { valid: false, errors };
  }

  // 2. Check for duplicate IDs
  const ids = new Map<string, number>();
  for (const node of nodes) {
    ids.set(node.id, (ids.get(node.id) ?? 0) + 1);
  }
  for (const [id, count] of ids) {
    if (count > 1) {
      errors.push({
        path: "graph.nodes",
        message: `ID nodo duplicato: "${id}".`,
        severity: "error",
      });
    }
  }

  // 3. Look for at least one trigger
  const triggerNodes = nodes.filter((n) => n.data?.type === "trigger" || n.type === "trigger");
  if (triggerNodes.length === 0) {
    errors.push({
      path: "graph.nodes",
      message: "Nessun trigger presente. Aggiungi almeno un blocco trigger nel canvas.",
      severity: "error",
    });
  }

  // 4. Look for at least one action
  const actionNodes = nodes.filter((n) => n.data?.type === "action" || n.type === "action");
  if (actionNodes.length === 0) {
    errors.push({
      path: "graph.nodes",
      message: "Nessuna azione presente. Aggiungi almeno un blocco azione nel canvas.",
      severity: "error",
    });
  }

  // 5. Validate edges reference existing nodes
  const nodeIds = new Set(nodes.map((n) => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        path: `graph.edges.${edge.id}`,
        message: `L'edge "${edge.id}" fa riferimento a un nodo source inesistente: "${edge.source}".`,
        severity: "error",
      });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        path: `graph.edges.${edge.id}`,
        message: `L'edge "${edge.id}" fa riferimento a un nodo target inesistente: "${edge.target}".`,
        severity: "error",
      });
    }
  }

  // 6. Check reachability: every node should be reachable from a trigger
  if (triggerNodes.length > 0) {
    const reachable = new Set<string>();

    // Build adjacency list from edges
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const targets = adjacency.get(edge.source) ?? [];
      targets.push(edge.target);
      adjacency.set(edge.source, targets);
    }

    // BFS from all trigger nodes
    const queue = triggerNodes.map((n) => n.id);
    for (const id of queue) {
      reachable.add(id);
    }
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!reachable.has(neighbor)) {
          reachable.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Check each node for reachability
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        errors.push({
          path: `graph.nodes.${node.id}`,
          message: `Nodo "${node.data?.label ?? node.id}" non raggiungibile da alcun trigger. Collegalo con un edge.`,
          severity: "error",
        });
      }
    }
  }

  // 7. Validate action nodes have minimum config
  for (const node of actionNodes) {
    const actionType = node.data?.actionType as string | undefined;
    const actionDataLabel = node.data?.label as string | undefined;
    const config = (node.data?.config as Record<string, unknown>) ?? {};

    // Only check known action types
    if (actionType) {
      const requirement = ACTION_REQUIREMENTS.find((r) => r.actionType === actionType);
      if (requirement) {
        for (const field of requirement.requiredFields) {
          if (field.mustHaveValue) {
            const value = config[field.key];
            if (value === undefined || value === null || value === "") {
              errors.push({
                path: `graph.nodes.${node.id}.config.${field.key}`,
                message: `"${actionDataLabel ?? node.id}": "${field.label}" è obbligatorio.`,
                severity: "error",
              });
            }
          }
        }
      }
    } else {
      // Unknown action type — warn but don't block
      errors.push({
        path: `graph.nodes.${node.id}`,
        message: `Nodo azione "${actionDataLabel ?? node.id}": tipo azione non specificato.`,
        severity: "warning",
      });
    }
  }

  return {
    valid: errors.filter((e) => e.severity === "error").length === 0,
    errors,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Group validation errors by path prefix for display.
 */
export function groupErrorsBySection(errors: FlowValidationError[]): Record<string, FlowValidationError[]> {
  const groups: Record<string, FlowValidationError[]> = {};
  for (const error of errors) {
    const section = error.path.split(/[.[\]']/)[0];
    if (!groups[section]) groups[section] = [];
    groups[section].push(error);
  }
  return groups;
}

/**
 * Get a human-readable section name.
 */
export function getSectionLabel(section: string): string {
  const labels: Record<string, string> = {
    name: "Nome",
    trigger: "Trigger",
    actions: "Azioni",
    conditions: "Condizioni",
    schedule: "Schedule",
    graph: "Canvas",
  };
  return labels[section] ?? section;
}

/**
 * Summarize validation errors into a single message for toast notifications.
 */
export function summarizeErrors(errors: FlowValidationError[]): string {
  const errorCount = errors.filter((e) => e.severity === "error").length;
  const warningCount = errors.filter((e) => e.severity === "warning").length;
  const parts: string[] = [];
  if (errorCount > 0) parts.push(`${errorCount} errore${errorCount > 1 ? "i" : ""}`);
  if (warningCount > 0) parts.push(`${warningCount} avvis${warningCount > 1 ? "i" : "o"}`);
  return parts.join(", ") || "Nessun problema";
}
