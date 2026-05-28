import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION TRIGGER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Schema for a trigger that fires when a new ticket is created.
 * No additional configuration is required.
 */
export const TicketCreatedTriggerSchema = z.object({
  type: z.literal("ticket_created"),
  config: z.object({}),
});

/**
 * Schema for a trigger that fires when an existing ticket is updated.
 *
 * @description Accepts an optional `fields` array to filter which field changes
 * should activate the rule. An empty or omitted `fields` array means any update
 * triggers the automation.
 */
export const TicketUpdatedTriggerSchema = z.object({
  type: z.literal("ticket_updated"),
  config: z.object({
    fields: z.array(z.string()).optional(),
  }),
});

/**
 * Schema for a trigger that fires a configurable number of hours before an SLA deadline.
 *
 * @description `hours_before` defaults to 24 and is clamped between 1 and 168.
 */
export const SlaDueTriggerSchema = z.object({
  type: z.literal("sla_due"),
  config: z.object({
    hours_before: z.number().min(1).max(168).default(24),
  }),
});

/**
 * Schema for a trigger that fires a configurable number of days before a warranty expires.
 *
 * @description `days_before` defaults to 30 and is clamped between 1 and 365.
 */
export const WarrantyDueTriggerSchema = z.object({
  type: z.literal("warranty_due"),
  config: z.object({
    days_before: z.number().min(1).max(365).default(30),
  }),
});

/**
 * Schema for a trigger that fires on a custom cron schedule.
 *
 * @description The `cron` expression is required (e.g. `"0 9 * * 1"` for every Monday at 9 AM).
 * An optional `timezone` (e.g. `"Europe/Rome"`) can be provided for time-zone-aware scheduling.
 */
export const ScheduledTriggerSchema = z.object({
  type: z.literal("scheduled"),
  config: z.object({
    cron: z.string().min(1, "Espressione cron richiesta"),
    timezone: z.string().optional(),
  }),
});

/**
 * Discriminated union of all supported trigger schemas.
 * Uses the `type` field to discriminate between trigger variants.
 */
export const AutomationTriggerSchema = z.discriminatedUnion("type", [
  TicketCreatedTriggerSchema,
  TicketUpdatedTriggerSchema,
  SlaDueTriggerSchema,
  WarrantyDueTriggerSchema,
  ScheduledTriggerSchema,
]);

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION CONDITION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Schema for a single automation condition.
 *
 * @description Validates field-based conditions. `field` must be a non-empty string
 * referencing a ticket/device field name. `valueType` must be one of the supported types:
 * - `"string"` — plain text value
 * - `"number"` — numeric comparison (used with `gt`/`lt` operators)
 * - `"list"` — multi-value (used with `in` operator)
 * - `"reference"` — foreign-key reference (e.g. `assignee_id`)
 *
 * @see {@link AutomationCondition} in src/domain/automation.ts for the corresponding type.
 */
export const AutomationConditionSchema = z.object({
  id: z.string(),
  field: z.string().min(1, "Campo richiesto"),
  operator: z.enum(["eq", "neq", "contains", "gt", "lt", "in"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  valueType: z.enum(["string", "number", "list", "reference"]),
  label: z.string().optional(),
});

/**
 * Schema for a group of conditions combined with AND/OR logic.
 *
 * @description `conditions` must be a non-empty array of {@link AutomationConditionSchema}.
 * `logic` indicates whether all conditions must match (`"AND"`) or at least one (`"OR"`).
 * Note: the legacy API format only supports AND — serialization will flatten OR groups.
 *
 * @see {@link ConditionsGroup} in src/domain/automation.ts for the corresponding type.
 */
export const ConditionsGroupSchema = z.object({
  conditions: z.array(AutomationConditionSchema),
  logic: z.enum(["AND", "OR"]),
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION ACTION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Schema for a "send email" action.
 *
 * @description Sends an email notification. `subject` and `body` are required.
 * `is_html` controls whether the body is rendered as HTML (default: plain text).
 * `to` is optional — if omitted, the assigned technician's email is used.
 */
const SendEmailActionSchema = z.object({
  id: z.string(),
  type: z.literal("send_email"),
  order: z.number(),
  config: z.object({
    to: z.string().optional(),
    subject: z.string().min(1, "Oggetto email richiesto"),
    body: z.string().min(1, "Corpo email richiesto"),
    is_html: z.boolean().default(false),
  }),
});

/**
 * Schema for an "update ticket" action.
 *
 * @description Updates one or more fields on a ticket. Requires at least one of
 * `status`, `priority`, or `assignee_id` to be provided. `ticket_id` is optional —
 * if omitted, the current (triggering) ticket is updated.
 */
const UpdateTicketActionSchema = z.object({
  id: z.string(),
  type: z.literal("update_ticket"),
  order: z.number(),
  config: z.object({
    ticket_id: z.string().optional(),
    status: z.enum(["pending", "in-progress", "testing", "ready"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    assignee_id: z.string().optional(),
  }).refine(
    (data) => data.status || data.priority || data.assignee_id,
    { message: "Almeno un campo da aggiornare (stato, priorità o assegnatario)" }
  ),
});

/**
 * Schema for an "add comment" action.
 *
 * @description Adds a comment (internal or public) to a ticket. `content` is required.
 * `is_internal` defaults to `true` (only visible to technicians). `ticket_id` is optional —
 * if omitted, the current (triggering) ticket receives the comment.
 */
const AddCommentActionSchema = z.object({
  id: z.string(),
  type: z.literal("add_comment"),
  order: z.number(),
  config: z.object({
    ticket_id: z.string().optional(),
    content: z.string().min(1, "Contenuto del commento richiesto"),
    is_internal: z.boolean().default(true),
  }),
});

/**
 * Schema for a "create ticket" action.
 *
 * @description Creates a new ticket. `title` and `description` are required.
 * `customer_id`, `priority`, and `assignee_id` are optional.
 */
const CreateTicketActionSchema = z.object({
  id: z.string(),
  type: z.literal("create_ticket"),
  order: z.number(),
  config: z.object({
    title: z.string().min(1, "Titolo ticket richiesto"),
    description: z.string().min(1, "Descrizione ticket richiesta"),
    customer_id: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    assignee_id: z.string().optional(),
  }),
});

/**
 * Schema for a "create notification" action.
 *
 * @description Creates an in-app notification for a user. `type`, `title`, and `body`
 * are required. `user_id` is optional — if omitted, the ticket assignee receives it.
 * `link` is an optional URL to navigate to when the notification is clicked.
 */
const CreateNotificationActionSchema = z.object({
  id: z.string(),
  type: z.literal("create_notification"),
  order: z.number(),
  config: z.object({
    user_id: z.string().optional(),
    type: z.string().min(1, "Tipo notifica richiesto"),
    title: z.string().min(1, "Titolo notifica richiesto"),
    body: z.string().min(1, "Messaggio notifica richiesto"),
    link: z.string().optional(),
  }),
});

/**
 * Schema for an "assign ticket" action.
 *
 * @description Assigns a ticket to a specific technician. `assignee_id` is required.
 * `ticket_id` is optional — if omitted, the current (triggering) ticket is assigned.
 */
const AssignTicketActionSchema = z.object({
  id: z.string(),
  type: z.literal("assign_ticket"),
  order: z.number(),
  config: z.object({
    ticket_id: z.string().optional(),
    assignee_id: z.string().min(1, "Assegnatario richiesto"),
  }),
});

/**
 * Schema for an "update device" action.
 *
 * @description Updates one or more fields on a device. Requires at least one of
 * `status` or `location_id` to be provided. `device_id` is optional — if omitted,
 * the device linked to the current (triggering) ticket is updated.
 */
const UpdateDeviceActionSchema = z.object({
  id: z.string(),
  type: z.literal("update_device"),
  order: z.number(),
  config: z.object({
    device_id: z.string().optional(),
    status: z.enum(["available", "assigned", "maintenance", "retired"]).optional(),
    location_id: z.string().optional(),
  }).refine(
    (data) => data.status || data.location_id,
    { message: "Almeno un campo da aggiornare (stato o sede)" }
  ),
});

/**
 * Discriminated union of all supported action schemas.
 * Uses the `type` field to discriminate between action variants.
 *
 * @see {@link AutomationAction} in src/domain/automation.ts for the corresponding type.
 */
export const AutomationActionSchema = z.discriminatedUnion("type", [
  SendEmailActionSchema,
  UpdateTicketActionSchema,
  AddCommentActionSchema,
  CreateTicketActionSchema,
  CreateNotificationActionSchema,
  AssignTicketActionSchema,
  UpdateDeviceActionSchema,
]);

/**
 * Schema for a list of automation actions.
 *
 * @description Wraps an array of {@link AutomationActionSchema} under the `actions` key.
 */
export const ActionsListSchema = z.object({
  actions: z.array(AutomationActionSchema),
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION FLOW INPUT SCHEMA (for form validation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Schema for validating automation flow input from a form.
 *
 * @description This is the **input** schema used by the form validation layer.
 * It differs from {@link AutomationFlow} in that:
 * - `name` is required and capped at 200 characters
 * - `description` and `category` are optional strings
 * - `trigger` must be a valid {@link AutomationTriggerSchema}
 * - `conditions` must be a valid {@link ConditionsGroupSchema}
 * - `actions` must be a non-empty array of {@link AutomationActionSchema}
 *
 * Use {@link validateFlowInput} for safe parsing with detailed error reporting.
 *
 * @see {@link AutomationFlowInput} in src/domain/automation.ts for the corresponding type.
 */
export const AutomationFlowInputSchema = z.object({
  name: z.string().min(1, "Nome automazione richiesto").max(200),
  description: z.string().max(1000).optional(),
  category: z.string().optional(),
  trigger: AutomationTriggerSchema,
  conditions: ConditionsGroupSchema,
  actions: z.array(AutomationActionSchema).min(1, "Almeno un'azione richiesta"),
});

// Type export for form usage
export type AutomationFlowInputSchemaType = z.infer<typeof AutomationFlowInputSchema>;
export type AutomationTriggerSchemaType = z.infer<typeof AutomationTriggerSchema>;
export type AutomationActionSchemaType = z.infer<typeof AutomationActionSchema>;
export type AutomationConditionSchemaType = z.infer<typeof AutomationConditionSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION TYPES & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of a validation operation.
 *
 * @property valid - Whether the input passed validation
 * @property errors - List of {@link ValidationError} (empty if valid is true)
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * A single validation error.
 *
 * @property path - Dot-separated path to the field that failed validation (e.g. `"trigger.config.hours_before"`)
 * @property message - Human-readable error message (localised in Italian)
 */
export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Validates an entire automation flow input against the {@link AutomationFlowInputSchema}.
 *
 * @param input - Raw input to validate (typically parsed from a form submission)
 * @returns A {@link ValidationResult} with detailed error paths and messages
 *
 * @example
 * const result = validateFlowInput(formData);
 * if (!result.valid) {
 *   const formatted = formatValidationErrors(result.errors);
 *   setFieldErrors(formatted);
 * }
 *
 * @see {@link formatValidationErrors} for converting errors to a field-level map
 */
export function validateFlowInput(input: unknown): ValidationResult {
  const result = AutomationFlowInputSchema.safeParse(input);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  };
}

/**
 * Validates a trigger object against the {@link AutomationTriggerSchema}.
 *
 * @param trigger - Raw trigger data to validate
 * @returns A {@link ValidationResult} scoped to trigger fields only
 *
 * @example
 * const result = validateTrigger({ type: "sla_due", config: { hours_before: 12 } });
 * // → { valid: true, errors: [] }
 *
 * @see {@link AutomationTriggerSchema} for the supported trigger variants
 */
export function validateTrigger(trigger: unknown): ValidationResult {
  const result = AutomationTriggerSchema.safeParse(trigger);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  };
}

/**
 * Validates a conditions group against the {@link ConditionsGroupSchema}.
 *
 * @param conditions - Raw conditions data to validate
 * @returns A {@link ValidationResult} scoped to conditions fields only
 *
 * @example
 * const result = validateConditions({
 *   logic: "AND",
 *   conditions: [{ field: "priority", operator: "eq", value: "high", valueType: "string" }]
 * });
 *
 * @see {@link ConditionsGroupSchema} for the schema definition
 */
export function validateConditions(conditions: unknown): ValidationResult {
  const result = ConditionsGroupSchema.safeParse(conditions);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  };
}

/**
 * Validates an array of actions against the {@link AutomationActionSchema} discriminated union.
 *
 * @param actions - Raw actions array to validate (must contain at least one action)
 * @returns A {@link ValidationResult} scoped to action fields only
 *
 * @example
 * const result = validateActions([
 *   { id: "1", type: "add_comment", order: 0, config: { content: "Hello" } }
 * ]);
 *
 * @throws Never throws — returns a {@link ValidationResult} with `valid: false` on failure
 * @see {@link AutomationActionSchema} for the supported action variants
 */
export function validateActions(actions: unknown): ValidationResult {
  const result = z.array(AutomationActionSchema).min(1).safeParse(actions);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  };
}

/**
 * Validates a single condition object against the {@link AutomationConditionSchema}.
 *
 * @param condition - Raw condition data to validate
 * @returns A {@link ValidationResult} scoped to a single condition's fields
 *
 * @example
 * const result = validateCondition({
 *   field: "priority",
 *   operator: "eq",
 *   value: "high",
 *   valueType: "string"
 * });
 *
 * @see {@link AutomationConditionSchema} for the schema definition
 */
export function validateCondition(condition: unknown): ValidationResult {
  const result = AutomationConditionSchema.safeParse(condition);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  };
}

/**
 * Converts an array of {@link ValidationError} into a flat record keyed by field path.
 *
 * @description Useful for mapping Zod validation errors directly into form field
 * error maps (e.g. for controlled forms or react-hook-form).
 *
 * @param errors - The array of validation errors to format
 * @returns A record where keys are dot-separated field paths and values are error messages
 *
 * @example
 * const result = validateFlowInput(input);
 * if (!result.valid) {
 *   const fieldErrors = formatValidationErrors(result.errors);
 *   // → { "trigger.config.hours_before": "Expected number, received string" }
 * }
 *
 * @see {@link ValidationResult} for where validation errors originate
 */
export function formatValidationErrors(errors: ValidationError[]): Record<string, string> {
  return errors.reduce((acc, error) => {
    acc[error.path] = error.message;
    return acc;
  }, {} as Record<string, string>);
}
