// Domain types for advanced automation conditions
// These types provide a cleaner abstraction over the legacy ConditionDef

export type ConditionOperator = "eq" | "neq" | "contains" | "gt" | "lt" | "in";
export type ConditionLogic = "AND" | "OR";
export type ValueType = "string" | "number" | "list" | "reference";

export interface AutomationCondition {
  id: string;
  field: string; // ticket.status, ticket.priority, etc.
  operator: ConditionOperator;
  value: string | number | string[];
  valueType: ValueType;
  label?: string; // user-friendly label (optional, for UI)
}

export interface ConditionsGroup {
  conditions: AutomationCondition[];
  logic: ConditionLogic;
}

// Field definitions with metadata for UI
export interface ConditionFieldDef {
  value: string;
  label: string;
  type: "string" | "number" | "select" | "reference";
  entity: "ticket" | "device";
  options?: { value: string; label: string }[]; // for select fields
}

// Available fields for conditions
export const AUTOMATION_CONDITION_FIELDS: ConditionFieldDef[] = [
  // Ticket fields
  {
    value: "ticket.status",
    label: "Stato ticket",
    type: "select",
    entity: "ticket",
    options: [
      { value: "pending", label: "In attesa" },
      { value: "in-progress", label: "In corso" },
      { value: "testing", label: "In test" },
      { value: "ready", label: "Pronto" },
    ],
  },
  {
    value: "ticket.priority",
    label: "Priorità ticket",
    type: "select",
    entity: "ticket",
    options: [
      { value: "low", label: "Bassa" },
      { value: "medium", label: "Media" },
      { value: "high", label: "Alta" },
      { value: "urgent", label: "Urgente" },
    ],
  },
  {
    value: "ticket.customer_id",
    label: "Cliente (ticket)",
    type: "reference",
    entity: "ticket",
  },
  {
    value: "ticket.assignee_id",
    label: "Assegnatario",
    type: "reference",
    entity: "ticket",
  },
  // Device fields
  {
    value: "device.customer_id",
    label: "Cliente (dispositivo)",
    type: "reference",
    entity: "device",
  },
  {
    value: "device.location_id",
    label: "Sede dispositivo",
    type: "reference",
    entity: "device",
  },
];

// Operators available for each field type
export const OPERATORS_BY_FIELD_TYPE: Record<
  ConditionFieldDef["type"],
  { value: ConditionOperator; label: string }[]
> = {
  string: [
    { value: "eq", label: "è" },
    { value: "neq", label: "non è" },
    { value: "contains", label: "contiene" },
  ],
  number: [
    { value: "eq", label: "è" },
    { value: "neq", label: "non è" },
    { value: "gt", label: "maggiore di" },
    { value: "lt", label: "minore di" },
  ],
  select: [
    { value: "eq", label: "è" },
    { value: "neq", label: "non è" },
    { value: "in", label: "in elenco" },
  ],
  reference: [
    { value: "eq", label: "è" },
    { value: "neq", label: "non è" },
    { value: "in", label: "in elenco" },
  ],
};

// Helper to get field definition by value
export function getFieldDef(fieldValue: string): ConditionFieldDef | undefined {
  return AUTOMATION_CONDITION_FIELDS.find((f) => f.value === fieldValue);
}

// Helper to get available operators for a field
export function getOperatorsForField(
  fieldValue: string
): { value: ConditionOperator; label: string }[] {
  const field = getFieldDef(fieldValue);
  if (!field) return [];
  return OPERATORS_BY_FIELD_TYPE[field.type] || [];
}

// Default value for new condition
export function createDefaultCondition(): AutomationCondition {
  return {
    id: `cond-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    field: "ticket.status",
    operator: "eq",
    value: "",
    valueType: "string",
  };
}

// Check if operator supports multiple values (array)
export function isMultiValueOperator(operator: ConditionOperator): boolean {
  return operator === "in";
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export type AutomationActionType =
  | "send_email"
  | "update_ticket"
  | "add_comment"
  | "create_ticket"
  | "create_notification"
  | "assign_ticket"
  | "update_device";

// Base action interface
export interface AutomationActionBase {
  id: string;
  type: AutomationActionType;
  order: number;
}

// Send Email
export interface SendEmailAction extends AutomationActionBase {
  type: "send_email";
  config: {
    to: string;
    subject: string;
    body: string;
    is_html: boolean;
  };
}

// Update Ticket (consolidated: status, priority, assignee)
export interface UpdateTicketAction extends AutomationActionBase {
  type: "update_ticket";
  config: {
    ticket_id?: string;
    status?: "pending" | "in-progress" | "testing" | "ready";
    priority?: "low" | "medium" | "high" | "urgent";
    assignee_id?: string;
  };
}

// Add Comment
export interface AddCommentAction extends AutomationActionBase {
  type: "add_comment";
  config: {
    ticket_id?: string;
    content: string;
    is_internal: boolean;
  };
}

// Create Ticket (for scheduled automations)
export interface CreateTicketAction extends AutomationActionBase {
  type: "create_ticket";
  config: {
    title: string;
    description: string;
    customer_id?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    assignee_id?: string;
  };
}

// Create Notification
export interface CreateNotificationAction extends AutomationActionBase {
  type: "create_notification";
  config: {
    user_id?: string;
    type: string;
    title: string;
    body: string;
    link?: string;
  };
}

// Assign Ticket
export interface AssignTicketAction extends AutomationActionBase {
  type: "assign_ticket";
  config: {
    ticket_id?: string;
    assignee_id: string;
  };
}

// Update Device
export interface UpdateDeviceAction extends AutomationActionBase {
  type: "update_device";
  config: {
    device_id?: string;
    status?: "available" | "assigned" | "maintenance" | "retired";
    location_id?: string;
  };
}

// Union type
export type AutomationAction =
  | SendEmailAction
  | UpdateTicketAction
  | AddCommentAction
  | CreateTicketAction
  | CreateNotificationAction
  | AssignTicketAction
  | UpdateDeviceAction;

// Actions container
export interface ActionsList {
  actions: AutomationAction[];
}

// Action type metadata for UI
export interface ActionTypeDef {
  value: AutomationActionType;
  label: string;
  icon: string;
  description: string;
}

export const AUTOMATION_ACTION_TYPES: ActionTypeDef[] = [
  {
    value: "send_email",
    label: "Invia email",
    icon: "mail",
    description: "Invia un'email a un destinatario specifico",
  },
  {
    value: "update_ticket",
    label: "Aggiorna ticket",
    icon: "ticket",
    description: "Modifica stato, priorità o assegnatario di un ticket",
  },
  {
    value: "add_comment",
    label: "Aggiungi commento",
    icon: "message-square",
    description: "Aggiungi una nota o commento a un ticket",
  },
  {
    value: "create_ticket",
    label: "Crea ticket",
    icon: "plus-circle",
    description: "Crea un nuovo ticket (utile per automazioni schedulate)",
  },
  {
    value: "create_notification",
    label: "Crea notifica",
    icon: "bell",
    description: "Invia una notifica in-app a un utente",
  },
  {
    value: "assign_ticket",
    label: "Assegna ticket",
    icon: "user-check",
    description: "Assegna un ticket a un tecnico specifico",
  },
  {
    value: "update_device",
    label: "Aggiorna dispositivo",
    icon: "monitor",
    description: "Modifica stato o sede di un dispositivo",
  },
];

// Helper to get action type definition
export function getActionTypeDef(type: AutomationActionType): ActionTypeDef | undefined {
  return AUTOMATION_ACTION_TYPES.find((a) => a.value === type);
}

// Create default action for type
export function createDefaultAction(type: AutomationActionType): AutomationAction {
  const base = {
    id: `action-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    order: 0,
  };

  switch (type) {
    case "send_email":
      return {
        ...base,
        type: "send_email",
        config: { to: "", subject: "", body: "", is_html: false },
      };
    case "update_ticket":
      return {
        ...base,
        type: "update_ticket",
        config: {},
      };
    case "add_comment":
      return {
        ...base,
        type: "add_comment",
        config: { content: "", is_internal: true },
      };
    case "create_ticket":
      return {
        ...base,
        type: "create_ticket",
        config: { title: "", description: "" },
      };
    case "create_notification":
      return {
        ...base,
        type: "create_notification",
        config: { type: "info", title: "", body: "", link: "" },
      };
    case "assign_ticket":
      return {
        ...base,
        type: "assign_ticket",
        config: { assignee_id: "" },
      };
    case "update_device":
      return {
        ...base,
        type: "update_device",
        config: {},
      };
    default:
      return {
        ...base,
        type: "send_email",
        config: { to: "", subject: "", body: "", is_html: false },
      };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION TRIGGER DSL
// ═══════════════════════════════════════════════════════════════════════════════

export type AutomationTriggerType =
  | "ticket_created"
  | "ticket_updated"
  | "sla_due"
  | "warranty_due"
  | "scheduled";

// Base trigger interface
export interface AutomationTriggerBase {
  type: AutomationTriggerType;
}

// Ticket Created
export interface TicketCreatedTrigger extends AutomationTriggerBase {
  type: "ticket_created";
  config: Record<string, never>; // No additional config needed
}

// Ticket Updated
export interface TicketUpdatedTrigger extends AutomationTriggerBase {
  type: "ticket_updated";
  config: {
    fields?: string[]; // Optional: trigger only when specific fields change
  };
}

// SLA Due (warning)
export interface SlaDueTrigger extends AutomationTriggerBase {
  type: "sla_due";
  config: {
    hours_before: number; // Hours before SLA deadline to trigger
  };
}

// Warranty Due (expiring soon)
export interface WarrantyDueTrigger extends AutomationTriggerBase {
  type: "warranty_due";
  config: {
    days_before: number; // Days before warranty expiry to trigger
  };
}

// Scheduled
export interface ScheduledTrigger extends AutomationTriggerBase {
  type: "scheduled";
  config: {
    cron: string; // Cron expression
    timezone?: string; // Optional timezone, defaults to system
  };
}

// Union type
export type AutomationTrigger =
  | TicketCreatedTrigger
  | TicketUpdatedTrigger
  | SlaDueTrigger
  | WarrantyDueTrigger
  | ScheduledTrigger;

// Default configs
export const DEFAULT_TRIGGER_CONFIGS: Record<AutomationTriggerType, Record<string, unknown>> = {
  ticket_created: {},
  ticket_updated: {},
  sla_due: { hours_before: 24 },
  warranty_due: { days_before: 30 },
  scheduled: { cron: "0 8 * * *", timezone: "Europe/Rome" },
};

// Create default trigger
export function createDefaultTrigger(type: AutomationTriggerType): AutomationTrigger {
  switch (type) {
    case "ticket_created":
      return { type: "ticket_created", config: {} };
    case "ticket_updated":
      return { type: "ticket_updated", config: {} };
    case "sla_due":
      return { type: "sla_due", config: { hours_before: 24 } };
    case "warranty_due":
      return { type: "warranty_due", config: { days_before: 30 } };
    case "scheduled":
      return { type: "scheduled", config: { cron: "0 8 * * *" } };
    default:
      return { type: "ticket_created", config: {} };
  }
}

// Trigger type metadata for UI
export interface TriggerTypeDef {
  value: AutomationTriggerType;
  label: string;
  description: string;
  icon: string;
  requiresConfig: boolean;
}

export const AUTOMATION_TRIGGER_TYPES: TriggerTypeDef[] = [
  {
    value: "ticket_created",
    label: "Nuovo ticket",
    description: "Quando viene creato un nuovo ticket",
    icon: "ticket",
    requiresConfig: false,
  },
  {
    value: "ticket_updated",
    label: "Ticket aggiornato",
    description: "Quando un ticket esistente viene modificato",
    icon: "refresh",
    requiresConfig: false,
  },
  {
    value: "sla_due",
    label: "SLA in scadenza",
    description: "Quando un ticket si avvicina alla scadenza SLA",
    icon: "clock",
    requiresConfig: true,
  },
  {
    value: "warranty_due",
    label: "Garanzia in scadenza",
    description: "Quando la garanzia di un dispositivo sta per scadere",
    icon: "shield",
    requiresConfig: true,
  },
  {
    value: "scheduled",
    label: "Schedulato",
    description: "Esecuzione automatica con orario predefinito",
    icon: "calendar",
    requiresConfig: true,
  },
];

// Helper to get trigger type definition
export function getTriggerTypeDef(type: AutomationTriggerType): TriggerTypeDef | undefined {
  return AUTOMATION_TRIGGER_TYPES.find((t) => t.value === type);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION FLOW DSL
// ═══════════════════════════════════════════════════════════════════════════════

export interface AutomationFlow {
  id?: string; // Optional: set when editing existing
  name: string;
  description?: string;
  category?: string;
  trigger: AutomationTrigger;
  conditions: ConditionsGroup;
  actions: AutomationAction[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Input type for forms (without auto-generated fields)
export interface AutomationFlowInput {
  name: string;
  description?: string;
  category?: string;
  trigger: AutomationTrigger;
  conditions: ConditionsGroup;
  actions: AutomationAction[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERIALIZATION / DESERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

// Type mappers for backward compatibility
export function mapTriggerTypeToLegacy(type: AutomationTriggerType): string {
  const mapping: Record<AutomationTriggerType, string> = {
    ticket_created: "ticket_created",
    ticket_updated: "ticket_updated",
    sla_due: "sla_warning",
    warranty_due: "warranty_expiring_soon",
    scheduled: "scheduled",
  };
  return mapping[type];
}

export function mapLegacyTriggerType(type: string): AutomationTriggerType {
  const mapping: Record<string, AutomationTriggerType> = {
    ticket_created: "ticket_created",
    ticket_updated: "ticket_updated",
    sla_warning: "sla_due",
    warranty_expiring_soon: "warranty_due",
    scheduled: "scheduled",
  };
  return mapping[type] || "ticket_created";
}

// Serialize trigger to legacy format
export function serializeTrigger(trigger: AutomationTrigger): Record<string, unknown> {
  return {
    type: mapTriggerTypeToLegacy(trigger.type),
    config: trigger.config,
  };
}

// Deserialize trigger from legacy format
export function deserializeTrigger(def: Record<string, unknown>): AutomationTrigger {
  const type = mapLegacyTriggerType(def.type as string);
  const config = (def.config as Record<string, unknown>) || {};

  switch (type) {
    case "ticket_created":
      return { type: "ticket_created", config: {} };
    case "ticket_updated":
      return {
        type: "ticket_updated",
        config: { fields: config.fields as string[] | undefined },
      };
    case "sla_due":
      return {
        type: "sla_due",
        config: { hours_before: (config.hours_before as number) ?? 24 },
      };
    case "warranty_due":
      return {
        type: "warranty_due",
        config: { days_before: (config.days_before as number) ?? 30 },
      };
    case "scheduled":
      return {
        type: "scheduled",
        config: {
          cron: (config.cron as string) ?? "0 8 * * *",
          timezone: config.timezone as string | undefined,
        },
      };
    default:
      return { type: "ticket_created", config: {} };
  }
}

// Serialize conditions to legacy format
export function serializeConditions(conditions: ConditionsGroup): Record<string, unknown>[] {
  return conditions.conditions.map((c) => ({
    id: c.id,
    type: mapConditionOperatorToLegacy(c.operator),
    config: {
      field: c.field,
      value: Array.isArray(c.value) ? c.value.join(",") : String(c.value),
    },
  }));
}

// Deserialize conditions from legacy format
export function deserializeConditions(defs: Record<string, unknown>[]): ConditionsGroup {
  if (!defs || defs.length === 0) {
    return { conditions: [], logic: "AND" };
  }

  return {
    conditions: defs.map((def) => ({
      id: (def.id as string) || `cond-${Date.now()}-${Math.random()}`,
      field: (def.config as Record<string, unknown>)?.field as string,
      operator: mapLegacyConditionType(def.type as string),
      value: parseConditionValue((def.config as Record<string, unknown>)?.value),
      valueType: "string",
    })),
    logic: "AND", // Legacy doesn't support logic toggle, default to AND
  };
}

// Helper to map operator to legacy condition type
function mapConditionOperatorToLegacy(operator: ConditionOperator): string {
  const mapping: Record<ConditionOperator, string> = {
    eq: "field_equals",
    neq: "field_not_equals",
    contains: "field_contains",
    gt: "field_greater_than",
    lt: "field_less_than",
    in: "field_equals", // Multi-value handled differently in legacy
  };
  return mapping[operator];
}

// Helper to map legacy condition type to operator
function mapLegacyConditionType(type: string): ConditionOperator {
  const mapping: Record<string, ConditionOperator> = {
    field_equals: "eq",
    field_not_equals: "neq",
    field_contains: "contains",
    field_greater_than: "gt",
    field_less_than: "lt",
    field_starts_with: "contains",
    field_ends_with: "contains",
    priority_high: "eq",
    tag_contains: "contains",
  };
  return mapping[type] || "eq";
}

// Parse condition value from legacy format
function parseConditionValue(value: unknown): string | number | string[] {
  if (typeof value === "string" && value.includes(",")) {
    return value.split(",").map((v) => v.trim());
  }
  if (typeof value === "number") {
    return value;
  }
  return String(value ?? "");
}

// Serialize actions to legacy format
export function serializeActions(actions: AutomationAction[]): Record<string, unknown>[] {
  return actions.map((action) => {
    const base = {
      id: action.id,
    };

    switch (action.type) {
      case "send_email":
        return {
          ...base,
          type: "send_email",
          config: action.config,
        };
      case "update_ticket":
        return {
          ...base,
          type: "update_ticket_status",
          config: {
            ticket_id: action.config.ticket_id,
            status: action.config.status,
          },
        };
      case "add_comment":
        return {
          ...base,
          type: "create_notification",
          config: {
            type: "ticket_comment",
            title: "Nuovo commento",
            body: action.config.content,
          },
        };
      case "create_ticket":
        return {
          ...base,
          type: "create_notification",
          config: {
            type: "auto_create_ticket",
            title: action.config.title,
            body: action.config.description,
          },
        };
      case "create_notification":
        return {
          ...base,
          type: "create_notification",
          config: action.config,
        };
      case "assign_ticket":
        return {
          ...base,
          type: "assign_ticket",
          config: action.config,
        };
      case "update_device":
        return {
          ...base,
          type: "update_device_status",
          config: {
            device_id: action.config.device_id,
            status: action.config.status,
          },
        };
      default:
        return { ...base, type: "send_email", config: {} };
    }
  });
}

// Deserialize actions from legacy format
export function deserializeActions(defs: Record<string, unknown>[]): AutomationAction[] {
  return defs.map((def, index) => {
    const base = {
      id: (def.id as string) || `action-${Date.now()}-${index}`,
      order: index,
    };

    const type = def.type as string;
    const config = (def.config as Record<string, unknown>) || {};

    switch (type) {
      case "send_email":
        return {
          ...base,
          type: "send_email",
          config: {
            to: (config.to as string) || "",
            subject: (config.subject as string) || "",
            body: (config.body as string) || "",
            is_html: (config.is_html as boolean) || false,
          },
        };
      case "update_ticket_status":
        return {
          ...base,
          type: "update_ticket",
          config: {
            ticket_id: config.ticket_id as string | undefined,
            status: config.status as "pending" | "in-progress" | "testing" | "ready" | undefined,
          },
        };
      case "create_notification":
        return {
          ...base,
          type: "create_notification",
          config: {
            user_id: config.user_id as string | undefined,
            type: (config.type as string) || "ticket_status_changed",
            title: (config.title as string) || "",
            body: (config.body as string) || "",
            link: config.link as string | undefined,
          },
        };
      case "assign_ticket":
        return {
          ...base,
          type: "assign_ticket",
          config: {
            ticket_id: config.ticket_id as string | undefined,
            assignee_id: (config.assignee_id as string) || "",
          },
        };
      case "update_device_status":
        return {
          ...base,
          type: "update_device",
          config: {
            device_id: config.device_id as string | undefined,
            status: config.status as "available" | "assigned" | "maintenance" | "retired" | undefined,
          },
        };
      default:
        return {
          ...base,
          type: "send_email",
          config: { to: "", subject: "", body: "", is_html: false },
        };
    }
  });
}

// Serialize complete flow to legacy format for API
export function serializeFlow(flow: AutomationFlow): Record<string, unknown> {
  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    category: flow.category,
    trigger_definition: serializeTrigger(flow.trigger),
    conditions_definition: serializeConditions(flow.conditions),
    actions_definition: serializeActions(flow.actions),
    is_active: flow.is_active,
    created_at: flow.created_at,
    updated_at: flow.updated_at,
  };
}

// Deserialize complete flow from API response
export function deserializeFlow(data: Record<string, unknown>): AutomationFlow {
  return {
    id: data.id as string | undefined,
    name: (data.name as string) || "",
    description: data.description as string | undefined,
    category: data.category as string | undefined,
    trigger: deserializeTrigger(data.trigger_definition as Record<string, unknown>),
    conditions: deserializeConditions((data.conditions_definition as Record<string, unknown>[]) || []),
    actions: deserializeActions((data.actions_definition as Record<string, unknown>[]) || []),
    is_active: (data.is_active as boolean) ?? true,
    created_at: data.created_at as string | undefined,
    updated_at: data.updated_at as string | undefined,
  };
}
