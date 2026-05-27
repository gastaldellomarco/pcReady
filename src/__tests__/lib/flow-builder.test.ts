import { describe, expect, it } from "vitest";
import { buildFlowDefinition } from "@/lib/automations/flow-builder";
import type { AutomationFlowDefinition, WizardFlowPayload } from "@/types/automation";

// ── Type-safe accessors for AutomationFlowDefinition nodes/edges ─────────
// Nodes and edges are typed as Array<Record<string, unknown>> in the schema,
// but buildFlowDefinition always produces a specific shape.

type FlowNode = {
  id: string;
  type: "trigger" | "action";
  data: { label: string; config?: Record<string, unknown> };
  position: { x: number; y: number };
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
};

function nodesOf(fd: AutomationFlowDefinition): FlowNode[] {
  return (fd.nodes ?? []) as FlowNode[];
}

function edgesOf(fd: AutomationFlowDefinition): FlowEdge[] {
  return (fd.edges ?? []) as FlowEdge[];
}

// ── Payload factories ───────────────────────────────────────────────────

function makePayload(overrides: Partial<WizardFlowPayload> = {}): WizardFlowPayload {
  return {
    name: "Test Flow",
    description: "A test flow",
    category: "Generale",
    trigger_definition: { type: "ticket_created", config: {} },
    actions_definition: [
      {
        id: "act-1",
        type: "send_email",
        config: { subject: "Hello", body: "Test body", is_html: false },
      },
    ],
    conditions_definition: [],
    schedule_definition: null,
    summary: "Sends email on ticket creation",
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("buildFlowDefinition", () => {
  // ── Basic structure ──────────────────────────────────────────────

  it("returns an object with nodes, edges, and meta", () => {
    const result = buildFlowDefinition(makePayload());

    expect(result).toHaveProperty("nodes");
    expect(result).toHaveProperty("edges");
    expect(result).toHaveProperty("meta");
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
  });

  it("builds 1 trigger node + 1 action node (2 nodes total) for a single-action payload", () => {
    const result = buildFlowDefinition(makePayload());
    const nodes = nodesOf(result);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.type).toBe("trigger");
    expect(nodes[1]!.type).toBe("action");
  });

  it("creates one edge connecting trigger -> action for a single-action payload", () => {
    const result = buildFlowDefinition(makePayload());
    const nodes = nodesOf(result);
    const edges = edgesOf(result);

    expect(edges).toHaveLength(1);
    expect(edges[0]!.source).toBe(nodes[0]!.id);
    expect(edges[0]!.target).toBe(nodes[1]!.id);
  });

  // ── Trigger node details ─────────────────────────────────────────

  it("sets trigger node id prefixed with 'trigger-'", () => {
    const result = buildFlowDefinition(makePayload());

    expect(nodesOf(result)[0]!.id).toMatch(/^trigger-/);
  });

  it("sets trigger node position at (0, 0)", () => {
    const result = buildFlowDefinition(makePayload());

    expect(nodesOf(result)[0]!.position).toEqual({ x: 0, y: 0 });
  });

  it("uses the payload trigger_definition.type as the trigger node label", () => {
    const result = buildFlowDefinition(makePayload());

    expect(nodesOf(result)[0]!.data.label).toBe("ticket_created");
  });

  it("falls back to 'trigger' label when trigger_definition is not provided", () => {
    const result = buildFlowDefinition(
      makePayload({ trigger_definition: undefined } as WizardFlowPayload),
    );

    expect(nodesOf(result)[0]!.data.label).toBe("trigger");
  });

  // ── Action node details ──────────────────────────────────────────

  it("sets action node id prefixed with 'action-'", () => {
    const result = buildFlowDefinition(makePayload());

    expect(nodesOf(result)[1]!.id).toMatch(/^action-/);
  });

  it("sets action node data.label to the action type", () => {
    const result = buildFlowDefinition(makePayload());

    expect(nodesOf(result)[1]!.data.label).toBe("send_email");
  });

  it("sets action node data.config to the action config", () => {
    const result = buildFlowDefinition(makePayload());

    expect(nodesOf(result)[1]!.data.config).toEqual({
      subject: "Hello",
      body: "Test body",
      is_html: false,
    });
  });

  it("positions action nodes with increasing y offsets (120px apart)", () => {
    const result = buildFlowDefinition(
      makePayload({
        actions_definition: [
          { id: "a1", type: "send_email", config: {} },
          { id: "a2", type: "assign_ticket", config: { assignee_id: "u1" } },
          { id: "a3", type: "update_ticket_status", config: {} },
        ],
      }),
    );
    const nodes = nodesOf(result);

    expect(nodes).toHaveLength(4); // trigger + 3 actions
    expect(nodes[1]!.position).toEqual({ x: 300, y: 0 });
    expect(nodes[2]!.position).toEqual({ x: 300, y: 120 });
    expect(nodes[3]!.position).toEqual({ x: 300, y: 240 });
  });

  // ── Multiple actions ─────────────────────────────────────────────

  it("builds correct number of nodes for multiple actions (1 trigger + N actions)", () => {
    const result = buildFlowDefinition(
      makePayload({
        actions_definition: [
          { id: "a1", type: "send_email", config: {} },
          { id: "a2", type: "assign_ticket", config: { assignee_id: "u1" } },
          { id: "a3", type: "create_notification", config: {} },
        ],
      }),
    );

    expect(nodesOf(result)).toHaveLength(4);
  });

  it("creates N edges all sourced from the trigger node", () => {
    const result = buildFlowDefinition(
      makePayload({
        actions_definition: [
          { id: "a1", type: "send_email", config: {} },
          { id: "a2", type: "assign_ticket", config: { assignee_id: "u1" } },
        ],
      }),
    );
    const nodes = nodesOf(result);
    const edges = edgesOf(result);

    expect(edges).toHaveLength(2);
    for (const edge of edges) {
      expect(edge.source).toBe(nodes[0]!.id);
    }
  });

  it("edge ids follow format 'e-{triggerId}-{actionId}'", () => {
    const result = buildFlowDefinition(makePayload());
    const nodes = nodesOf(result);

    const triggerId = nodes[0]!.id;
    const actionId = nodes[1]!.id;
    expect(edgesOf(result)[0]!.id).toBe(`e-${triggerId}-${actionId}`);
  });

  // ── Meta ─────────────────────────────────────────────────────────

  it("stores the full wizard payload in meta.wizard", () => {
    const payload = makePayload();
    const result = buildFlowDefinition(payload);

    expect(result.meta!.wizard).toEqual(payload);
  });

  it("stores the payload summary in meta.summary", () => {
    const result = buildFlowDefinition(
      makePayload({ summary: "Custom summary text" }),
    );

    expect(result.meta!.summary).toBe("Custom summary text");
  });

  it("sets meta.migrated_at to an ISO timestamp", () => {
    const result = buildFlowDefinition(makePayload());

    expect(result.meta!.migrated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
    );
  });

  // ── Edge cases ───────────────────────────────────────────────────

  it("returns empty nodes/edges when actions_definition is empty", () => {
    const result = buildFlowDefinition(
      makePayload({ actions_definition: [] }),
    );
    const nodes = nodesOf(result);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.type).toBe("trigger");
    expect(edgesOf(result)).toHaveLength(0);
  });

  it("returns empty nodes/edges when actions_definition is undefined", () => {
    const result = buildFlowDefinition(
      makePayload({ actions_definition: undefined }),
    );

    expect(nodesOf(result)).toHaveLength(1);
    expect(edgesOf(result)).toHaveLength(0);
  });

  it("is a pure function: same input -> same output structure (UUIDs may differ)", () => {
    const payload = makePayload();
    const r1Nodes = nodesOf(buildFlowDefinition(payload));
    const r2Nodes = nodesOf(buildFlowDefinition(payload));

    expect(r1Nodes).toHaveLength(r2Nodes.length);
    expect(r1Nodes[0]!.type).toBe(r2Nodes[0]!.type);
    expect(r1Nodes[0]!.data.label).toBe(r2Nodes[0]!.data.label);
    expect(buildFlowDefinition(payload).meta!.wizard).toEqual(
      buildFlowDefinition(payload).meta!.wizard,
    );
  });

  it("preserves all known action types on action nodes", () => {
    const result = buildFlowDefinition(
      makePayload({
        actions_definition: [
          { id: "a1", type: "send_email", config: {} },
          { id: "a2", type: "update_ticket_status", config: {} },
          { id: "a3", type: "create_notification", config: {} },
          { id: "a4", type: "update_device_status", config: {} },
          { id: "a5", type: "assign_ticket", config: { assignee_id: "u1" } },
        ],
      }),
    );
    const nodes = nodesOf(result);

    expect(nodes).toHaveLength(6); // trigger + 5 actions
    const actionLabels = nodes.slice(1).map((n) => n.data.label);
    expect(actionLabels).toEqual([
      "send_email",
      "update_ticket_status",
      "create_notification",
      "update_device_status",
      "assign_ticket",
    ]);
  });
});
