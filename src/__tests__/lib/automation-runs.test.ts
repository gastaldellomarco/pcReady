import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/notifications.server", () => ({
  createNotificationForAdmins: vi.fn().mockResolvedValue(undefined),
}));

const automationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const triggeredBy = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const mockState = vi.hoisted(() => ({
  flow: {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Test flow",
    active: true,
    trigger_definition: { type: "manual" },
    flow_definition: { meta: {}, nodes: [] },
    actions_definition: [] as unknown[],
  } as Record<string, unknown>,
  logResponse: {
    id: "log-1",
    automation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    triggered_at: new Date().toISOString(),
    triggered_by: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    status: "skipped",
    duration_ms: 4,
    trigger_payload: {} as Record<string, unknown> | null,
    actions_executed: [
      {
        action: "validate_flow",
        status: "skipped",
        result: { reason: "Nessuna action configurata" },
      },
    ],
    error_message: null as string | null,
    is_dry_run: false,
  },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "automation_flows") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockState.flow, error: null })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        };
      }
      if (table === "automation_run_logs") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: mockState.logResponse, error: null })),
            })),
          })),
        };
      }
      return {};
    }),
  },
}));

describe("automation-runs.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.flow = {
      id: automationId,
      name: "Test flow",
      active: true,
      trigger_definition: { type: "manual" },
      flow_definition: { meta: {}, nodes: [] },
      actions_definition: [],
    };
    mockState.logResponse = {
      id: "log-1",
      automation_id: automationId,
      triggered_at: new Date().toISOString(),
      triggered_by: triggeredBy,
      status: "skipped",
      duration_ms: 4,
      trigger_payload: {},
      actions_executed: [
        {
          action: "validate_flow",
          status: "skipped",
          result: { reason: "Nessuna action configurata" },
        },
      ],
      error_message: null,
      is_dry_run: false,
    };
  });

  it("computeHealth returns never_run for empty logs", async () => {
    const { computeHealth } = await import("@/lib/automation-runs.server");
    expect(computeHealth([])).toBe("never_run");
  });

  it("computeHealth detects failing when last three are errors", async () => {
    const { computeHealth } = await import("@/lib/automation-runs.server");
    expect(
      computeHealth([
        { status: "error" },
        { status: "error" },
        { status: "error" },
        { status: "success" },
      ]),
    ).toBe("failing");
  });

  it("computeHealth returns healthy when recent runs are success", async () => {
    const { computeHealth } = await import("@/lib/automation-runs.server");
    expect(
      computeHealth([{ status: "success" }, { status: "success" }, { status: "success" }]),
    ).toBe("healthy");
  });

  it("executeAutomationRun marks skipped when no actions configured", async () => {
    const { executeAutomationRun } = await import("@/lib/automation-runs.server");
    const log = await executeAutomationRun({
      automationId,
      triggeredBy,
      isDryRun: false,
      triggerPayload: {},
    });
    expect(log.status).toBe("skipped");
  });

  it("executeAutomationRun dry run notifies admins when a simulated action fails", async () => {
    mockState.flow = {
      id: automationId,
      name: "Test flow",
      active: true,
      trigger_definition: { type: "manual" },
      flow_definition: { meta: {}, nodes: [] },
      actions_definition: [{ type: "noop", config: { force_error: true } }],
    };
    mockState.logResponse = {
      ...mockState.logResponse,
      status: "error",
      is_dry_run: true,
      error_message: "Errore simulato dalla configurazione action",
      actions_executed: [],
    };

    const { createNotificationForAdmins } = await import("@/lib/notifications.server");
    const { executeAutomationRun } = await import("@/lib/automation-runs.server");

    await executeAutomationRun({
      automationId,
      triggeredBy,
      isDryRun: true,
      triggerPayload: {},
    });

    expect(createNotificationForAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "automation_failed",
        title: expect.stringContaining("Test flow"),
      }),
    );
  });
});
