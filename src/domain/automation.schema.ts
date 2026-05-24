import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION TRIGGER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const TicketCreatedTriggerSchema = z.object({
  type: z.literal("ticket_created"),
  config: z.object({}),
});

export const TicketUpdatedTriggerSchema = z.object({
  type: z.literal("ticket_updated"),
  config: z.object({
    fields: z.array(z.string()).optional(),
  }),
});

export const SlaDueTriggerSchema = z.object({
  type: z.literal("sla_due"),
  config: z.object({
    hours_before: z.number().min(1).max(168).default(24),
  }),
});

export const WarrantyDueTriggerSchema = z.object({
  type: z.literal("warranty_due"),
  config: z.object({
    days_before: z.number().min(1).max(365).default(30),
  }),
});

export const ScheduledTriggerSchema = z.object({
  type: z.literal("scheduled"),
  config: z.object({
    cron: z.string().min(1, "Espressione cron richiesta"),
    timezone: z.string().optional(),
  }),
});

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

export const AutomationConditionSchema = z.object({
  id: z.string(),
  field: z.string().min(1, "Campo richiesto"),
  operator: z.enum(["eq", "neq", "contains", "gt", "lt", "in"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  valueType: z.enum(["string", "number", "list", "reference"]),
  label: z.string().optional(),
});

export const ConditionsGroupSchema = z.object({
  conditions: z.array(AutomationConditionSchema),
  logic: z.enum(["AND", "OR"]),
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION ACTION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

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

const AssignTicketActionSchema = z.object({
  id: z.string(),
  type: z.literal("assign_ticket"),
  order: z.number(),
  config: z.object({
    ticket_id: z.string().optional(),
    assignee_id: z.string().min(1, "Assegnatario richiesto"),
  }),
});

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

export const AutomationActionSchema = z.discriminatedUnion("type", [
  SendEmailActionSchema,
  UpdateTicketActionSchema,
  AddCommentActionSchema,
  CreateTicketActionSchema,
  CreateNotificationActionSchema,
  AssignTicketActionSchema,
  UpdateDeviceActionSchema,
]);

export const ActionsListSchema = z.object({
  actions: z.array(AutomationActionSchema),
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION FLOW INPUT SCHEMA (for form validation)
// ═══════════════════════════════════════════════════════════════════════════════

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

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
}

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

// Format errors for display
export function formatValidationErrors(errors: ValidationError[]): Record<string, string> {
  return errors.reduce((acc, error) => {
    acc[error.path] = error.message;
    return acc;
  }, {} as Record<string, string>);
}
