// Domain types for advanced automation conditions
// These types provide a cleaner abstraction over the legacy ConditionDef

/**
 * Comparison operators for condition evaluation.
 *
 * - `eq` / `neq`: exact match / negated match (works with strings, numbers, references)
 * - `contains`: substring match (string fields only)
 * - `gt` / `lt`: numeric comparison (number fields only)
 * - `in`: multi-value membership check (works with select and reference fields)
 */
export type ConditionOperator = "eq" | "neq" | "contains" | "gt" | "lt" | "in";

/**
 * Logical operator that joins multiple conditions within a group.
 *
 * - `"AND"`: all conditions must match — more restrictive, reduces false positives
 * - `"OR"`: any condition must match — broader, useful for alternative criteria
 *
 * @see ConditionsGroup for how this is applied
 */
export type ConditionLogic = "AND" | "OR";

/**
 * Describes the data type expected for a condition value.
 *
 * - `"string"`: plain text comparison (supports `eq`, `neq`, `contains`)
 * - `"number"`: numeric comparison (supports `eq`, `neq`, `gt`, `lt`)
 * - `"list"`: array of values for the `in` operator
 * - `"reference"`: foreign-key ID (e.g. `customer_id`, `assignee_id`); behaves like
 *   `"string"` for comparison but the UI should render a lookup selector instead of
 *   a free-text field
 *
 * @see AutomationCondition.valueType
 * @see ConditionFieldDef.type for the UI field type this maps to
 */
export type ValueType = "string" | "number" | "list" | "reference";

/**
 * A single condition that checks a field against a value.
 *
 * The `valueType` field determines how `value` is interpreted:
 * - `"string"` / `"number"`: `value` is a single scalar
 * - `"list"`: `value` is a `string[]`
 * - `"reference"`: `value` is the ID string of the referenced entity; the UI should
 *   resolve it via a lookup (e.g. an async autocomplete or entity picker)
 *
 * `label` is an optional user-friendly description, used exclusively by the UI for
 * display purposes. It is **not** persisted to the API.
 */
export interface AutomationCondition {
  id: string;
  field: string; // ticket.status, ticket.priority, etc.
  operator: ConditionOperator;
  value: string | number | string[];
  valueType: ValueType;
  label?: string; // user-friendly label (optional, for UI)
}

/**
 * A group of conditions joined by a logical operator.
 *
 * When `logic` is `"AND"` every condition must evaluate to true for the group to pass.
 * When it is `"OR"` only one condition needs to match.
 *
 * **Important**: the legacy API serialization always returns `AND` because the old
 * format does not support logic toggling. Deserialised groups will therefore have
 * `logic: "AND"` regardless of the original input.
 *
 * @see serializeConditions for details on the legacy format limitation
 * @see AutomationCondition
 */
export interface ConditionsGroup {
  conditions: AutomationCondition[];
  logic: ConditionLogic;
}

/**
 * Metadata descriptor for a field that can be used in conditions.
 *
 * The `type` property drives which operators and input controls the UI shows:
 * - `"string"` → text input, operators: eq / neq / contains
 * - `"number"` → number input, operators: eq / neq / gt / lt
 * - `"select"` → dropdown, operators: eq / neq / in
 * - `"reference"` → entity picker, operators: eq / neq / in
 *
 * When `type` is `"select"`, the `options` array provides the available choices.
 */
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

/**
 * Returns the field definition for the given field value.
 *
 * @param fieldValue - The dot-notation field key (e.g. `"ticket.status"`)
 * @returns The matching `ConditionFieldDef`, or `undefined` if not found
 */
export function getFieldDef(fieldValue: string): ConditionFieldDef | undefined {
  return AUTOMATION_CONDITION_FIELDS.find((f) => f.value === fieldValue);
}

/**
 * Returns the operators available for a given field.
 *
 * @param fieldValue - The dot-notation field key (e.g. `"ticket.status"`)
 * @returns Array of operator options with labels, or an empty array if the field is unknown
 * @see OPERATORS_BY_FIELD_TYPE for the full mapping
 */
export function getOperatorsForField(
  fieldValue: string
): { value: ConditionOperator; label: string }[] {
  const field = getFieldDef(fieldValue);
  if (!field) return [];
  return OPERATORS_BY_FIELD_TYPE[field.type] || [];
}

/**
 * Creates a condition with sensible defaults for a new blank row in the conditions editor.
 *
 * @returns A new `AutomationCondition` with a unique ID and default values
 */
export function createDefaultCondition(): AutomationCondition {
  return {
    id: `cond-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    field: "ticket.status",
    operator: "eq",
    value: "",
    valueType: "string",
  };
}

/**
 * Checks whether an operator accepts multiple values (as an array).
 *
 * @param operator - The operator to check
 * @returns `true` if the operator is `"in"` (multi-value), `false` otherwise
 */
export function isMultiValueOperator(operator: ConditionOperator): boolean {
  return operator === "in";
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * All supported action types for automation flows.
 *
 * - `send_email`: sends an email to a configured address
 * - `update_ticket`: modifies ticket status, priority, and/or assignee
 * - `add_comment`: appends an internal or public note to a ticket
 * - `create_ticket`: generates a new ticket (useful for scheduled automations)
 * - `create_notification`: dispatches an in-app notification to a user
 * - `assign_ticket`: assigns a ticket to a specific technician
 * - `update_device`: changes device status or location
 */
export type AutomationActionType =
  | "send_email"
  | "update_ticket"
  | "add_comment"
  | "create_ticket"
  | "create_notification"
  | "assign_ticket"
  | "update_device";

/**
 * Common fields shared by every action type.
 */
export interface AutomationActionBase {
  id: string;
  type: AutomationActionType;
  order: number;
}

/**
 * Sends an email to a specified recipient.
 *
 * The email body supports plain text or HTML depending on `is_html`.
 */
export interface SendEmailAction extends AutomationActionBase {
  type: "send_email";
  config: {
    to: string;
    subject: string;
    body: string;
    is_html: boolean;
  };
}

/**
 * Updates one or more fields of an existing ticket.
 *
 * All config fields are optional so that callers can change only what they need.
 */
export interface UpdateTicketAction extends AutomationActionBase {
  type: "update_ticket";
  config: {
    ticket_id?: string;
    status?: "pending" | "in-progress" | "testing" | "ready";
    priority?: "low" | "medium" | "high" | "urgent";
    assignee_id?: string;
  };
}

/**
 * Appends a comment to a ticket.
 *
 * Use `is_internal` to control visibility: internal comments are visible only to
 * technicians, public ones are visible to the client portal too.
 */
export interface AddCommentAction extends AutomationActionBase {
  type: "add_comment";
  config: {
    ticket_id?: string;
    content: string;
    is_internal: boolean;
  };
}

/**
 * Creates a new ticket from the automation action configuration.
 *
 * This action is most useful in **scheduled** automations (e.g. "every Monday
 * create a recurring ticket").
 */
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

/**
 * Dispatches an in-app notification to a user.
 *
 * The optional `link` field lets the notification navigate to a specific page when
 * clicked.
 */
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

/**
 * Assigns a ticket to a specific technician.
 *
 * The `ticket_id` is optional and derived from context at runtime if omitted.
 */
export interface AssignTicketAction extends AutomationActionBase {
  type: "assign_ticket";
  config: {
    ticket_id?: string;
    assignee_id: string;
  };
}

/**
 * Updates the status or location of a device.
 *
 * The `device_id` is optional and derived from context at runtime if omitted.
 */
export interface UpdateDeviceAction extends AutomationActionBase {
  type: "update_device";
  config: {
    device_id?: string;
    status?: "available" | "assigned" | "maintenance" | "retired";
    location_id?: string;
  };
}

/**
 * Union of all supported automation action types.
 *
 * Use type narrowing (`switch` / `if`) on the `type` discriminant to access the
 * specific `config` shape of each action.
 */
export type AutomationAction =
  | SendEmailAction
  | UpdateTicketAction
  | AddCommentAction
  | CreateTicketAction
  | CreateNotificationAction
  | AssignTicketAction
  | UpdateDeviceAction;

/**
 * Container for a list of automation actions.
 */
export interface ActionsList {
  actions: AutomationAction[];
}

/**
 * Metadata descriptor for an action type, used by the UI to render the
 * action-picker dropdown and default configuration forms.
 */
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

/**
 * Returns the action type definition for the given type.
 *
 * @param type - The action type to look up
 * @returns The matching `ActionTypeDef`, or `undefined` if not found
 */
export function getActionTypeDef(type: AutomationActionType): ActionTypeDef | undefined {
  return AUTOMATION_ACTION_TYPES.find((a) => a.value === type);
}

/**
 * Creates a default action of the specified type, populating its config with
 * sensible zero-values (empty strings, `false`, empty objects).
 *
 * @param type - The action type to create
 * @returns A new `AutomationAction` instance with a unique ID and default config
 * @throws Never throws — unknown types fall back to `send_email`
 */
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

/**
 * All supported trigger types for automation flows.
 *
 * - `ticket_created`: fires immediately after a new ticket is created
 * - `ticket_updated`: fires when an existing ticket is modified
 * - `sla_due`: fires when a ticket's SLA deadline is approaching
 * - `warranty_due`: fires when a device warranty is about to expire
 * - `scheduled`: fires on a cron schedule
 */
export type AutomationTriggerType =
  | "ticket_created"
  | "ticket_updated"
  | "sla_due"
  | "warranty_due"
  | "scheduled";

/**
 * Common fields shared by every trigger type.
 */
export interface AutomationTriggerBase {
  type: AutomationTriggerType;
}

/**
 * Fires immediately after a ticket is created.
 * No additional configuration is required.
 */
export interface TicketCreatedTrigger extends AutomationTriggerBase {
  type: "ticket_created";
  config: Record<string, never>; // No additional config needed
}

/**
 * Fires when an existing ticket is modified.
 *
 * Use `fields` to restrict the trigger to specific field changes. When `fields`
 * is omitted or empty, any update triggers the automation.
 */
export interface TicketUpdatedTrigger extends AutomationTriggerBase {
  type: "ticket_updated";
  config: {
    fields?: string[]; // Optional: trigger only when specific fields change
  };
}

/**
 * Fires a configurable number of hours before a ticket's SLA deadline.
 */
export interface SlaDueTrigger extends AutomationTriggerBase {
  type: "sla_due";
  config: {
    hours_before: number; // Hours before SLA deadline to trigger
  };
}

/**
 * Fires a configurable number of days before a device warranty expires.
 */
export interface WarrantyDueTrigger extends AutomationTriggerBase {
  type: "warranty_due";
  config: {
    days_before: number; // Days before warranty expiry to trigger
  };
}

/**
 * Fires on a cron-based schedule.
 *
 * The `timezone` field is optional; when omitted the system timezone is used.
 * Note: not all backend environments may support custom timezones.
 */
export interface ScheduledTrigger extends AutomationTriggerBase {
  type: "scheduled";
  config: {
    cron: string; // Cron expression
    timezone?: string; // Optional timezone, defaults to system
  };
}

/**
 * Union of all supported trigger types.
 *
 * Use type narrowing on the `type` discriminant to access the specific `config`
 * shape of each trigger.
 */
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

/**
 * Creates a default trigger of the specified type.
 *
 * @param type - The trigger type to create
 * @returns A new `AutomationTrigger` with sensible default configuration
 */
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

/**
 * Metadata descriptor for a trigger type, used by the UI to render the
 * trigger-picker dropdown and default configuration panels.
 */
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

/**
 * Returns the trigger type definition for the given type.
 *
 * @param type - The trigger type to look up
 * @returns The matching `TriggerTypeDef`, or `undefined` if not found
 */
export function getTriggerTypeDef(type: AutomationTriggerType): TriggerTypeDef | undefined {
  return AUTOMATION_TRIGGER_TYPES.find((t) => t.value === type);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION FLOW DSL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A complete automation flow combining trigger, conditions, and actions.
 *
 * **Optional fields** and when they are populated:
 * - `id`: set by the API when an existing flow is loaded; `undefined` for new flows
 * - `description`: human-readable summary, optional for simple flows
 * - `category`: grouping tag for organising flows (e.g. `"sla"`, `"maintenance"`)
 * - `created_at` / `updated_at`: timestamps populated by the API after save
 *
 * @see AutomationFlowInput for the form input variant (without auto-generated fields)
 */
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

/**
 * Input shape for automation flow forms.
 *
 * Unlike {@link AutomationFlow}, this type omits server-managed fields (`id`,
 * `is_active`, `created_at`, `updated_at`). It represents the data collected
 * from the UI before saving.
 *
 * Use `serializeFlow` (which adds the missing fields) to convert this into
 * the payload expected by the API.
 */
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

/**
 * Maps a DSL trigger type to its legacy string representation for the REST API.
 *
 * @param type - The new DSL trigger type (e.g. `"sla_due"`)
 * @returns The legacy string (e.g. `"sla_warning"`)
 * @see mapLegacyTriggerType for the reverse operation
 */
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

/**
 * Maps a legacy trigger string back to a DSL trigger type.
 *
 * **Fallback behaviour**: if the legacy string is unknown (e.g. a new value added
 * by a future API version), the function defaults to `"ticket_created"` to avoid
 * crashing the UI.
 *
 * @param type - The legacy trigger string from the API (e.g. `"sla_warning"`)
 * @returns The corresponding DSL trigger type, or `"ticket_created"` as fallback
 * @see mapTriggerTypeToLegacy for the reverse operation
 */
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

/**
 * Serializes a DSL trigger object into the legacy API format.
 *
 * @param trigger - The DSL trigger to serialize
 * @returns A plain object compatible with the legacy trigger payload
 * @see deserializeTrigger for the reverse operation
 */
export function serializeTrigger(trigger: AutomationTrigger): Record<string, unknown> {
  return {
    type: mapTriggerTypeToLegacy(trigger.type),
    config: trigger.config,
  };
}

/**
 * Deserialises a legacy API trigger payload back into a DSL trigger object.
 *
 * Missing or undefined config values are replaced with sensible defaults.
 *
 * @param def - The legacy trigger payload from the API
 * @returns A fully typed `AutomationTrigger` instance
 * @see serializeTrigger for the reverse operation
 */
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

/**
 * Serializes conditions into the legacy API array format.
 *
 * **Known limitation**: the `in` operator is mapped to `field_equals` (the legacy
 * equivalent of `eq`). This means multi-value conditions from the new DSL are
 * serialised as a single comma-separated string, losing the semantic distinction
 * between "equals" and "in".
 *
 * @param conditions - The DSL conditions group to serialize
 * @returns An array of legacy condition objects
 * @see deserializeConditions for the reverse operation
 */
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

/**
 * Deserialises a legacy API conditions array back into a DSL `ConditionsGroup`.
 *
 * The legacy format does not support the `logic` field, so the returned group
 * always uses `"AND"`.
 *
 * @param defs - The legacy conditions array from the API
 * @returns A fully typed `ConditionsGroup` (defaults to empty group when input is
 *   nullish or empty)
 * @see serializeConditions for the reverse operation
 */
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

/**
 * Maps a DSL `ConditionOperator` to the legacy condition type string.
 *
 * **Note on `in` operator**: the `in` operator maps to `field_equals` because the
 * legacy format handles multi-value via comma-separated strings rather than arrays.
 *
 * @param operator - The DSL operator
 * @returns The legacy condition type string
 * @see mapLegacyConditionType for the reverse operation
 */
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

/**
 * Maps a legacy condition type string back to a DSL `ConditionOperator`.
 *
 * Several legacy types (`field_starts_with`, `field_ends_with`, `tag_contains`)
 * all map to `"contains"` since the new DSL does not distinguish between them.
 *
 * @param type - The legacy condition type string
 * @returns The corresponding DSL operator, or `"eq"` as fallback
 * @see mapConditionOperatorToLegacy for the reverse operation
 */
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

/**
 * Parses a condition value from the legacy API format into the DSL type system.
 *
 * **Comma-separated strings**: if the value is a string that contains commas, it
 * is automatically split into a `string[]`. This preserves the legacy behaviour
 * where multi-value conditions were encoded as comma-separated text.
 *
 * @param value - The raw value from the legacy API (may be string, number, or nullish)
 * @returns The parsed value as `string`, `number`, or `string[]`
 */
function parseConditionValue(value: unknown): string | number | string[] {
  if (typeof value === "string" && value.includes(",")) {
    return value.split(",").map((v) => v.trim());
  }
  if (typeof value === "number") {
    return value;
  }
  return String(value ?? "");
}

/**
 * Serializes a list of DSL actions into the legacy API array format.
 *
 * **Action type mapping** (DSL → legacy):
 * - `send_email` → `send_email`
 * - `update_ticket` → `update_ticket_status` (only status is mapped)
 * - `add_comment` → `create_notification` with type `ticket_comment`
 * - `create_ticket` → `create_notification` with type `auto_create_ticket`
 * - `create_notification` → `create_notification`
 * - `assign_ticket` → `assign_ticket`
 * - `update_device` → `update_device_status` (only status is mapped)
 *
 * @param actions - The DSL actions to serialize
 * @returns An array of legacy action objects
 * @see deserializeActions for the reverse operation
 */
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

/**
 * Deserialises a legacy actions array from the API back into DSL action objects.
 *
 * @param defs - The legacy actions array from the API
 * @returns An array of fully typed `AutomationAction` instances
 * @see serializeActions for the reverse operation
 */
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

/**
 * Serializes a complete `AutomationFlow` into the legacy API payload format.
 *
 * This function:
 * 1. Maps the DSL trigger type to its legacy equivalent
 * 2. Converts conditions to the legacy array format (with the `in` → `field_equals` loss)
 * 3. Maps action types to their legacy equivalents
 *
 * @param flow - The DSL flow to serialize
 * @returns A flat record compatible with the legacy REST API payload
 * @see deserializeFlow for the reverse operation
 */
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

/**
 * Deserialises a legacy API flow payload into a complete `AutomationFlow`.
 *
 * Missing or `null` sub-objects are replaced with sensible defaults:
 * - `trigger_definition` → defaults to `ticket_created`
 * - `conditions_definition` → empty conditions group with `AND` logic
 * - `actions_definition` → empty array
 * - `is_active` → `true`
 *
 * @param data - The legacy flow payload from the API
 * @returns A fully typed `AutomationFlow` instance
 * @see serializeFlow for the reverse operation
 */
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
