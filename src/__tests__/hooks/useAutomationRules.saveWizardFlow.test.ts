// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AutomationFlow, AutomationRule, WizardFlowPayload } from "@/types/automation";

// ── Mock data factories ────────────────────────────────────────────────

const mockUserId = "user-0000-0000-0000-000000000001";
const mockAccessToken = "token-mock-123";

function validPayload(overrides: Partial<WizardFlowPayload> = {}): WizardFlowPayload {
  return {
    name: "Test Automation",
    description: "A test automation",
    category: "Generale",
    trigger_definition: { type: "manual", config: {} },
    actions_definition: [
      {
        id: "act-1",
        type: "send_email",
        config: {
          subject: "Test email",
          body: "This is a test email body",
        },
      },
    ],
    conditions_definition: [],
    schedule_definition: undefined,
    summary: "Test summary",
    ...overrides,
  };
}

function createEditingRule(): AutomationRule {
  return {
    id: "rule-existing-id",
    name: "Existing Rule",
    description: "Old desc",
    category: "Notifica",
    active: false,
    version: 1,
    updated_at: "2026-01-01T00:00:00.000Z",
    summary: "Old summary",
    last_run_at: null,
    flow_definition: undefined,
  };
}

// ── Hoisted mocks (available before module mocking) ─────────────────────

const mockCreateMut = vi.hoisted(() => ({
  mutateAsync: vi.fn<(arg: Partial<AutomationFlow>) => Promise<{ id: string }>>(),
}));

const mockUpdateMut = vi.hoisted(() => ({
  mutateAsync: vi
    .fn<
      (arg: { id: string; payload: Partial<AutomationFlow> }) => Promise<Partial<AutomationFlow>>
    >(),
}));

const mockListQuery = vi.hoisted(() => ({
  data: [] as AutomationRule[],
  isLoading: false,
  refetch: vi.fn(),
}));

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

const mockCreateVersion = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<void>>());

const mockRandomUuid = vi.hoisted(() => vi.fn(() => "uuid-mock-1"));

const mockGetUser = vi.hoisted(() =>
  vi.fn(() =>
    Promise.resolve({ data: { user: { id: mockUserId } }, error: null }),
  ),
);

// ── Module mocks ────────────────────────────────────────────────────────

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    isAdmin: true,
    session: { access_token: mockAccessToken },
    user: { id: mockUserId },
    profile: { id: mockUserId, role: "admin" },
    loading: false,
    profileLoading: false,
    authError: null,
    canEdit: true,
    refreshProfile: vi.fn(),
    signOut: vi.fn(),
  }),
  Ctx: { $$typeof: Symbol.for("react.context"), _currentValue: undefined },
}));

vi.mock("@/lib/queries/automations", () => ({
  default: {
    useAutomationFlows: () => mockListQuery,
    useCreateAutomation: () => mockCreateMut,
    useUpdateAutomation: () => mockUpdateMut,
    useDeleteAutomation: () => ({ mutateAsync: vi.fn() }),
    useDuplicateAutomation: () => ({ mutateAsync: vi.fn() }),
    useArchiveAutomation: () => ({ mutateAsync: vi.fn() }),
    useToggleAutomation: () => ({ mutateAsync: vi.fn() }),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() =>
            Promise.resolve({ data: {}, error: null }),
          ),
        })),
      })),
    })),
  },
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: vi.fn(() => ({
    handler: vi.fn((fn: unknown) => fn),
  })),
  useServerFn: vi.fn((fn: unknown) => {
    if (typeof fn === "function") return fn;
    return vi.fn();
  }),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/lib/versioning", () => ({
  createVersion: mockCreateVersion,
}));

vi.mock("@/lib/random-uuid", () => ({
  randomUUID: mockRandomUuid,
}));

vi.mock("@/lib/automations/flow-validation", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/automations/flow-validation")>(
      "@/lib/automations/flow-validation",
    );
  return actual;
});

// ── Import del hook sotto test (dopo i mock) ───────────────────────────

import { useAutomationRules } from "@/hooks/useAutomationRules";

// ── Tests ───────────────────────────────────────────────────────────────

describe("useAutomationRules.saveWizardFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMut.mutateAsync.mockResolvedValue({ id: "new-rule-id" });
    mockUpdateMut.mutateAsync.mockResolvedValue({
      id: "rule-existing-id",
      name: "Test Automation",
    });
    mockCreateVersion.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });
  });

  // ── Validation ──────────────────────────────────────────────────────

  describe("validation", () => {
    it("calls validateWizardPayload before saving", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      // Should have called createMut (validation passed)
      expect(mockCreateMut.mutateAsync).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledWith("Automazione creata");
    });

    it("shows toast.error when name is empty", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(validPayload({ name: "" }));
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Validazione fallita"),
        expect.any(Object),
      );
      // Should NOT call createMut
      expect(mockCreateMut.mutateAsync).not.toHaveBeenCalled();
    });

    it("shows toast.error when trigger type is missing", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(
          validPayload({
            trigger_definition: undefined,
          } as WizardFlowPayload),
        );
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Validazione fallita"),
        expect.any(Object),
      );
      expect(mockCreateMut.mutateAsync).not.toHaveBeenCalled();
    });

    it("shows toast.error when actions list is empty", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(
          validPayload({ actions_definition: [] }),
        );
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Validazione fallita"),
        expect.any(Object),
      );
      expect(mockCreateMut.mutateAsync).not.toHaveBeenCalled();
    });

    it("shows toast.error when action config is missing required fields", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(
          validPayload({
            actions_definition: [
              {
                id: "act-bad",
                type: "send_email",
                config: { subject: "", body: "" },
              },
            ],
          }),
        );
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringContaining("Validazione fallita"),
        expect.any(Object),
      );
      expect(mockCreateMut.mutateAsync).not.toHaveBeenCalled();
    });
  });

  // ── Create mode ─────────────────────────────────────────────────────

  describe("create mode (no editingRule)", () => {
    it("calls createMut.mutateAsync with correct payload after validation passes", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      expect(mockCreateMut.mutateAsync).toHaveBeenCalledTimes(1);
      const payload = mockCreateMut.mutateAsync.mock.calls[0]![0] as Partial<AutomationFlow>;
      expect(payload.name).toBe("Test Automation");
      expect(payload.description).toBe("A test automation");
      expect(payload.category).toBe("Generale");
      expect(payload.active).toBe(false);
      expect(payload.version).toBe(1);
      expect(payload.created_by).toBe(mockUserId);
      expect(payload.updated_by).toBe(mockUserId);
      expect(payload.flow_definition).toBeDefined();
    });

    it("calls createVersion after successful create", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      expect(mockCreateVersion).toHaveBeenCalledTimes(1);
      const cvArgs = mockCreateVersion.mock.calls[0]!;
      expect(cvArgs[0]).toBe("automation_flows");
      expect(cvArgs[5]).toBe("create");
    });

    it("shows success toast after create", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      expect(mockToast.success).toHaveBeenCalledWith("Automazione creata");
    });

    it("closes builder after successful create", async () => {
      const { result } = renderHook(() => useAutomationRules());

      // Open builder first
      act(() => result.current.setBuilderOpen(true));
      expect(result.current.builderOpen).toBe(true);

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      expect(result.current.builderOpen).toBe(false);
    });

    it("shows error toast when createMut fails", async () => {
      mockCreateMut.mutateAsync.mockRejectedValue(
        new Error("Database error"),
      );

      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      expect(mockToast.error).toHaveBeenCalledWith("Database error");
    });
  });

  // ── Edit mode ───────────────────────────────────────────────────────

  describe("edit mode (editingRule set)", () => {
    const editingRule = createEditingRule();

    it("calls updateMut instead of createMut when editingRule is set", async () => {
      const { result } = renderHook(() => useAutomationRules());

      // Set editing rule
      act(() => {
        result.current.openEditDialog(editingRule);
      });
      expect(result.current.editingRule?.id).toBe("rule-existing-id");

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      expect(mockUpdateMut.mutateAsync).toHaveBeenCalledTimes(1);
      expect(mockCreateMut.mutateAsync).not.toHaveBeenCalled();
    });

    it("calls updateMut with correct id and payload", async () => {
      const { result } = renderHook(() => useAutomationRules());

      act(() => {
        result.current.openEditDialog(editingRule);
      });

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      const callArg = mockUpdateMut.mutateAsync.mock.calls[0]![0] as {
        id: string;
        payload: Partial<AutomationFlow>;
      };
      expect(callArg.id).toBe("rule-existing-id");
      expect(callArg.payload.name).toBe("Test Automation");
      expect(callArg.payload.version).toBe(2); // previous version + 1
    });

    it("calls createVersion after successful update", async () => {
      const { result } = renderHook(() => useAutomationRules());

      act(() => {
        result.current.openEditDialog(editingRule);
      });

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      expect(mockCreateVersion).toHaveBeenCalledTimes(1);
      const cvUpdateArgs = mockCreateVersion.mock.calls[0]!;
      expect(cvUpdateArgs[0]).toBe("automation_flows");
      expect(cvUpdateArgs[5]).toBe("update");
    });

    it("shows success toast after update", async () => {
      const { result } = renderHook(() => useAutomationRules());

      act(() => {
        result.current.openEditDialog(editingRule);
      });

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      expect(mockToast.success).toHaveBeenCalledWith("Automazione aggiornata");
    });

    it("closes builder after successful update", async () => {
      const { result } = renderHook(() => useAutomationRules());

      act(() => {
        result.current.openEditDialog(editingRule);
        result.current.setBuilderOpen(true);
      });

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      expect(result.current.builderOpen).toBe(false);
    });

    it("shows error toast when updateMut fails", async () => {
      mockUpdateMut.mutateAsync.mockRejectedValue(
        new Error("Update failed"),
      );

      const { result } = renderHook(() => useAutomationRules());

      act(() => {
        result.current.openEditDialog(editingRule);
      });

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      expect(mockToast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  // ── Payload structure ───────────────────────────────────────────────

  describe("payload structure", () => {
    it("builds correct flow_definition with trigger and action nodes", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      const payload = mockCreateMut.mutateAsync.mock.calls[0]![0] as Partial<AutomationFlow>;
      const fd = payload.flow_definition as {
        nodes: Array<{ id: string; type: string; data: { label: string }; position: { x: number; y: number } }>;
        edges: Array<{ id: string; source: string; target: string }>;
        meta: { wizard: WizardFlowPayload };
      };

      // Should have trigger + action nodes
      expect(fd.nodes.length).toBeGreaterThanOrEqual(2);
      expect(fd.nodes[0]!.type).toBe("trigger");
      expect(fd.nodes[1]!.type).toBe("action");

      // Should have edge connecting trigger -> action
      expect(fd.edges.length).toBe(1);
      expect(fd.edges[0]!.source).toBe(fd.nodes[0]!.id);
      expect(fd.edges[0]!.target).toBe(fd.nodes[1]!.id);

      // Should store wizard data in meta
      expect(fd.meta.wizard).toBeDefined();
    });

    it("handles multiple actions correctly", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(
          validPayload({
            actions_definition: [
              {
                id: "act-multi-1",
                type: "send_email",
                config: { subject: "Email 1", body: "Body 1" },
              },
              {
                id: "act-multi-2",
                type: "update_ticket_status",
                config: { status: "in_progress" },
              },
            ],
          }),
        );
      });

      const payload = mockCreateMut.mutateAsync.mock.calls[0]![0] as Partial<AutomationFlow>;
      const fd = payload.flow_definition as { nodes: unknown[]; edges: unknown[] };

      // 1 trigger + 2 actions = 3 nodes
      expect(fd.nodes.length).toBe(3);
      // 1 trigger → 2 actions = 2 edges
      expect(fd.edges.length).toBe(2);
    });

    it("sets version to 1 for new rules", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.saveWizardFlow(validPayload());
      });

      const payload = mockCreateMut.mutateAsync.mock.calls[0]![0] as Partial<AutomationFlow>;
      expect(payload.version).toBe(1);
    });
  });
});
