import { z } from "zod";

// ─── Trigger Definition ───────────────────────────────────────────────

export const TRIGGER_TYPES = [
  "ticket_created",
  "ticket_updated",
  "checklist_completed",
  "sla_warning",
  "sla_breached",
  "warranty_expiring_soon",
  "warranty_expired",
  "scheduled",
  "manual",
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const TriggerDefSchema = z.object({
  type: z.enum(TRIGGER_TYPES),
  config: z.record(z.unknown()).optional(),
});

export type TriggerDef = z.infer<typeof TriggerDefSchema>;

// ─── Condition Definition ─────────────────────────────────────────────

export const CONDITION_TYPES = [
  "field_equals",
  "field_not_equals",
  "field_greater_than",
  "field_less_than",
  "field_contains",
  "field_starts_with",
  "field_ends_with",
  "priority_high",
  "tag_contains",
] as const;

export type ConditionType = (typeof CONDITION_TYPES)[number];

export const ConditionConfigSchema = z.object({
  field: z.string().optional(),
  value: z.string().optional(),
});

export type ConditionConfig = z.infer<typeof ConditionConfigSchema>;

export const ConditionDefSchema = z.object({
  id: z.string(),
  type: z.enum(CONDITION_TYPES),
  config: ConditionConfigSchema.optional(),
});

export type ConditionDef = z.infer<typeof ConditionDefSchema>;

// ─── Action Definition ────────────────────────────────────────────────

export const ACTION_TYPES = [
  "send_email",
  "update_ticket_status",
  "create_notification",
  "update_device_status",
  "assign_ticket",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/** Per-action config schemas for runtime validation (mirrors server-side schemas). */
export const SendEmailConfigSchema = z.object({
  to: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  is_html: z.boolean().optional(),
});
export type SendEmailConfig = z.infer<typeof SendEmailConfigSchema>;

export const UpdateTicketStatusConfigSchema = z.object({
  ticket_id: z.string().optional(),
  status: z.string().optional(),
});
export type UpdateTicketStatusConfig = z.infer<typeof UpdateTicketStatusConfigSchema>;

export const CreateNotificationConfigSchema = z.object({
  user_id: z.string().optional(),
  type: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  link: z.string().optional(),
});
export type CreateNotificationConfig = z.infer<typeof CreateNotificationConfigSchema>;

export const UpdateDeviceStatusConfigSchema = z.object({
  device_id: z.string().optional(),
  status: z.string().optional(),
});
export type UpdateDeviceStatusConfig = z.infer<typeof UpdateDeviceStatusConfigSchema>;

export const AssignTicketConfigSchema = z.object({
  ticket_id: z.string().optional(),
  assignee_id: z.string().optional(),
});
export type AssignTicketConfig = z.infer<typeof AssignTicketConfigSchema>;

export const ActionConfigSchema = z.record(z.unknown());
export type ActionConfig = Record<string, unknown>;

export const ActionDefSchema = z.object({
  id: z.string(),
  type: z.enum(ACTION_TYPES),
  config: ActionConfigSchema.optional(),
});

export type ActionDef = z.infer<typeof ActionDefSchema>;

// ─── Schedule Definition ──────────────────────────────────────────────

export const SCHEDULE_TYPES = ["none", "cron", "interval"] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export const ScheduleDefSchema = z.object({
  type: z.enum(SCHEDULE_TYPES).optional(),
  cron: z.string().optional(),
  interval: z.string().optional(),
});

export type ScheduleDef = z.infer<typeof ScheduleDefSchema>;

// ─── Wizard Payload (Flow Builder) ────────────────────────────────────

export const WizardFlowPayloadSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  trigger_definition: TriggerDefSchema.nullable().optional(),
  conditions_definition: z.array(ConditionDefSchema).optional(),
  actions_definition: z.array(ActionDefSchema).optional(),
  schedule_definition: ScheduleDefSchema.nullable().optional(),
  summary: z.string().optional(),
  version: z.number().optional(),
  changeNote: z.string().optional(),
});

export type WizardFlowPayload = z.infer<typeof WizardFlowPayloadSchema>;

// ─── Flow Definition (stored in JSON) ─────────────────────────────────

/** Flow definition meta — extended with archive and version info. */
export const FlowDefinitionMetaSchema = z
  .object({
    archived: z.boolean().optional(),
    paused: z.boolean().optional(),
    wizard: WizardFlowPayloadSchema.optional(),
    summary: z.string().optional(),
    migrated_at: z.string().optional(),
    last_run_at: z.string().optional(),
    last_run_status: z.string().optional(),
    archived_at: z.string().optional(),
    archived_by: z.string().optional(),
    archive_reason: z.string().optional(),
    changed_fields: z.record(z.unknown()).optional(),
  })
  .catchall(z.unknown());

export type FlowDefinitionMeta = z.infer<typeof FlowDefinitionMetaSchema>;

/** Contenuto JSON `automation_flows.flow_definition` (nodi React Flow + meta wizard). */
export const AutomationFlowDefinitionSchema = z
  .object({
    nodes: z.array(z.record(z.string(), z.unknown())).optional(),
    edges: z.array(z.record(z.string(), z.unknown())).optional(),
    meta: FlowDefinitionMetaSchema.optional(),
  })
  .catchall(z.unknown());

export type AutomationFlowDefinition = z.infer<typeof AutomationFlowDefinitionSchema>;

// ─── Automation Rule (from DB) ────────────────────────────────────────

export const AutomationRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  active: z.boolean(),
  version: z.number(),
  updated_at: z.string().nullable(),
  summary: z.string().nullable().optional(),
  last_run_at: z.string().nullable().optional(),
  flow_definition: AutomationFlowDefinitionSchema.optional(),
});

export type AutomationRule = z.infer<typeof AutomationRuleSchema>;

// ─── Automation Flow (full DB row) ────────────────────────────────────

export const AutomationFlowSchema = AutomationRuleSchema.extend({
  trigger_definition: TriggerDefSchema.nullable().optional(),
  conditions_definition: z.array(ConditionDefSchema).nullable().optional(),
  actions_definition: z.array(ActionDefSchema).nullable().optional(),
  schedule_definition: ScheduleDefSchema.nullable().optional(),
  created_at: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional(),
});

export type AutomationFlow = z.infer<typeof AutomationFlowSchema>;

// ─── Version Snapshot ─────────────────────────────────────────────────

/** Shape of a version snapshot stored in entity_versions for automation_flows. */
export const AutomationVersionSnapshotSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  active: z.boolean().optional(),
  version: z.number().optional(),
  flow_definition: AutomationFlowDefinitionSchema.optional(),
  trigger_definition: TriggerDefSchema.nullable().optional(),
  conditions_definition: z.array(ConditionDefSchema).nullable().optional(),
  actions_definition: z.array(ActionDefSchema).nullable().optional(),
  schedule_definition: ScheduleDefSchema.nullable().optional(),
  created_by: z.string().nullable().optional(),
  updated_by: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
});

export type AutomationVersionSnapshot = z.infer<typeof AutomationVersionSnapshotSchema>;

// ─── Archive Metadata ─────────────────────────────────────────────────

export const ArchiveMetadataSchema = z.object({
  archived: z.literal(true),
  archived_at: z.string().optional(),
  archived_by: z.string().optional(),
  archive_reason: z.string().optional(),
  source_version: z.number().optional(),
});

export type ArchiveMetadata = z.infer<typeof ArchiveMetadataSchema>;

// ─── Activity Log ─────────────────────────────────────────────────────

export const ActivityLogSchema = z.object({
  id: z.string(),
  type: z.enum(["auto", "user", "system"]),
  message: z.string(),
  created_at: z.string(),
});

export type ActivityLog = z.infer<typeof ActivityLogSchema>;

// ─── Run Log ──────────────────────────────────────────────────────────

export const AutomationRunLogSchema = z.object({
  id: z.string(),
  automation_id: z.string(),
  triggered_at: z.string(),
  triggered_by: z.string().nullable(),
  status: z.enum(["success", "error", "dry_run", "skipped"]),
  duration_ms: z.number().nullable(),
  trigger_payload: z.record(z.unknown()).nullable(),
  actions_executed: z
    .array(
      z.object({
        action: z.string(),
        status: z.enum(["success", "error", "skipped"]),
        blockId: z.string().optional(),
        blockType: z.enum(["trigger", "condition", "action"]).optional(),
        input: z.record(z.unknown()).optional(),
        details: z.record(z.unknown()).optional(),
        result: z.unknown().optional(),
        error: z.string().optional(),
      }),
    )
    .nullable(),
  error_message: z.string().nullable(),
  is_dry_run: z.boolean(),
});
