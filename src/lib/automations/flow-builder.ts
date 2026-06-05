import { randomUUID } from "@/lib/random-uuid";
import type {
  ActionDef,
  AutomationFlowDefinition,
  FlowDefinitionMeta,
  WizardFlowPayload,
} from "@/types/automation";

/**
 * Builds a React Flow nodes/edges definition from a wizard payload.
 *
 * Converts the flat wizard form data (`WizardFlowPayload`) into the
 * structured `AutomationFlowDefinition` format used by React Flow for
 * visual rendering of automation pipelines.
 *
 * The trigger is always positioned at `(0, 0)`. Each action is placed
 * at `x: 300` with a vertical offset of `120px` per action, creating
 * a left-to-right flow layout.
 *
 * @param flowObj - The raw wizard payload containing trigger and action definitions
 * @returns A React Flow-compatible definition with positioned nodes, connecting edges,
 *          and metadata (wizard snapshot, summary, migration timestamp)
 *
 * @remarks This is a **pure function** — it does not access closures, external
 * state, or side effects beyond `randomUUID()`. Fully testable in isolation.
 *
 * @see {@link WizardFlowPayload} — input type
 * @see {@link AutomationFlowDefinition} — output type
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
