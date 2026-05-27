import { randomUUID } from "@/lib/random-uuid";
import type { ActionDef, AutomationFlowDefinition, FlowDefinitionMeta, WizardFlowPayload } from "@/types/automation";

/**
 * Pure function: builds a React Flow definition from a wizard payload.
 * Does not access closures or external state — fully testable in isolation.
 */
export function buildFlowDefinition(flowObj: WizardFlowPayload): AutomationFlowDefinition {
  const triggerId = `trigger-${randomUUID()}`;
  const actionNodes = (flowObj.actions_definition || []).map((a: ActionDef, idx: number) => ({
    id: `action-${randomUUID()}`,
    type: "action",
    data: { label: a.type, config: a.config },
    position: { x: 300, y: idx * 120 },
  }));
  const nodes = [
    {
      id: triggerId,
      type: "trigger",
      data: { label: flowObj.trigger_definition?.type || "trigger" },
      position: { x: 0, y: 0 },
    },
    ...actionNodes,
  ];
  const edges = actionNodes.map((an: { id: string }) => ({
    id: `e-${triggerId}-${an.id}`,
    source: triggerId,
    target: an.id,
  }));
  const meta: FlowDefinitionMeta = {
    wizard: flowObj,
    summary: flowObj.summary,
    migrated_at: new Date().toISOString(),
  };
  return { nodes, edges, meta };
}
