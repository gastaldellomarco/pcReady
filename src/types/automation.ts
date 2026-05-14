import { z } from "zod";

/** Contenuto JSON `automation_flows.flow_definition` (nodi React Flow + meta wizard). */
const AutomationFlowDefinitionSchema = z
  .object({
    nodes: z.array(z.record(z.string(), z.unknown())).optional(),
    edges: z.array(z.record(z.string(), z.unknown())).optional(),
    meta: z
      .object({
        archived: z.boolean().optional(),
        paused: z.boolean().optional(),
        wizard: z.record(z.unknown()).optional(),
        summary: z.string().optional(),
        migrated_at: z.string().optional(),
      })
      .catchall(z.unknown())
      .optional(),
  })
  .catchall(z.unknown());

export type AutomationFlowDefinition = z.infer<typeof AutomationFlowDefinitionSchema>;

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

export const ActivityLogSchema = z.object({
  id: z.string(),
  type: z.enum(["auto", "user", "system"]),
  message: z.string(),
  created_at: z.string(),
});

export type ActivityLog = z.infer<typeof ActivityLogSchema>;

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
