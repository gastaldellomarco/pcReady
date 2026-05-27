// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AutomationFlow, AutomationRule } from "@/types/automation";

// ── Factory helpers ──────────────────────────────────────────────────────

const mockUserId = "user-0000-0000-0000-000000000001";
const mockAccessToken = "token-mock-123";

function createRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: "rule-1",
    name: "Test Rule",
    description: "Test description",
    category: "Generale",
    active: true,
    version: 1,
    updated_at: "2026-01-01T00:00:00.000Z",
    summary: null,
    last_run_at: null,
    flow_definition: undefined,
    ...overrides,
  };
}

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockToggleMut = vi.hoisted(() => ({
  mutateAsync: vi.fn<(arg: { id: string; active: boolean }) => Promise<void>>(),
}));

const mockDuplicateMut = vi.hoisted(() => ({
  mutateAsync: vi.fn<(arg: { id: string; name: string }) => Promise<string | null>>(),
}));

const mockDeleteMut = vi.hoisted(() => ({
  mutateAsync: vi.fn<(id: string) => Promise<void>>(),
}));

const mockArchiveMut = vi.hoisted(() => ({
  mutateAsync: vi.fn<(arg: { id: string; fd: unknown }) => Promise<void>>(),
}));

const mockCreateMut = vi.hoisted(() => ({
  mutateAsync: vi.fn<(arg: Partial<AutomationFlow>) => Promise<{ id: string }>>(),
}));

const mockUpdateMut = vi.hoisted(() => ({
  mutateAsync: vi.fn<
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
  vi.fn(() => Promise.resolve({ data: { user: { id: mockUserId } }, error: null })),
);

const mockSupabaseSingle = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ data: { flow_definition: { meta: {} } }, error: null })),
);

const mockExecuteRun = vi.hoisted(() => vi.fn<(arg: unknown) => Promise<unknown>>());

const mockLoadRunStats = vi.hoisted(() => vi.fn());

const mockListAutomationRunLogs = vi.hoisted(() => vi.fn());

const mockListAllAutomationRunLogs = vi.hoisted(() => vi.fn());

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock("@/lib/automation-runs", () => ({
  getAutomationRunStats: mockLoadRunStats,
  runAutomationNow: mockExecuteRun,
  listAutomationRunLogs: mockListAutomationRunLogs,
  listAllAutomationRunLogs: mockListAllAutomationRunLogs,
}));

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
    useDeleteAutomation: () => mockDeleteMut,
    useDuplicateAutomation: () => mockDuplicateMut,
    useArchiveAutomation: () => mockArchiveMut,
    useToggleAutomation: () => mockToggleMut,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSupabaseSingle,
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
    if (fn === mockExecuteRun) return mockExecuteRun;
    if (fn === mockLoadRunStats) return mockLoadRunStats;
    if (fn === mockListAutomationRunLogs) return mockListAutomationRunLogs;
    if (fn === mockListAllAutomationRunLogs) return mockListAllAutomationRunLogs;
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

// ── Import hook under test (after mocks) ─────────────────────────────────

import { useAutomationRules } from "@/hooks/useAutomationRules";

// ── Helpers for confirmRunRuleAction log ─────────────────────────────────

function createRunLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-log-001",
    automation_id: "rule-1",
    triggered_at: "2026-06-01T12:00:00.000Z",
    triggered_by: "manual",
    status: "success",
    duration_ms: 1200,
    trigger_payload: null,
    actions_executed: null,
    error_message: null,
    is_dry_run: false,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("useAutomationRules actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToggleMut.mutateAsync.mockResolvedValue(undefined);
    mockDuplicateMut.mutateAsync.mockResolvedValue("new-rule-id");
    mockDeleteMut.mutateAsync.mockResolvedValue(undefined);
    mockArchiveMut.mutateAsync.mockResolvedValue(undefined);
    mockCreateVersion.mockResolvedValue(undefined);
    mockGetUser.mockResolvedValue({ data: { user: { id: mockUserId } }, error: null });
    mockSupabaseSingle.mockResolvedValue({
      data: { flow_definition: { meta: {} } },
      error: null,
    });
    mockExecuteRun.mockResolvedValue(createRunLog());
    mockLoadRunStats.mockResolvedValue({ stats: {}, kpis: null });
  });

  // ── toggleRule ───────────────────────────────────────────────────────

  describe("toggleRule", () => {
    it("calls toggleMut with inverted active state", async () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "rule-1", active: true });

      await act(async () => {
        await result.current.toggleRule(rule);
      });

      expect(mockToggleMut.mutateAsync).toHaveBeenCalledTimes(1);
      expect(mockToggleMut.mutateAsync).toHaveBeenCalledWith({
        id: "rule-1",
        active: false,
      });
    });

    it("toggles from false to true", async () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "rule-2", active: false });

      await act(async () => {
        await result.current.toggleRule(rule);
      });

      expect(mockToggleMut.mutateAsync).toHaveBeenCalledWith({
        id: "rule-2",
        active: true,
      });
    });

    it("shows error toast when toggleMut fails", async () => {
      mockToggleMut.mutateAsync.mockRejectedValue(new Error("Toggle error"));

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "rule-1" });

      await act(async () => {
        await result.current.toggleRule(rule);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Toggle error");
    });

    it("handles non-Error rejection gracefully", async () => {
      mockToggleMut.mutateAsync.mockRejectedValue("fail");

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "rule-1" });

      await act(async () => {
        await result.current.toggleRule(rule);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore toggle automazione");
    });
  });

  // ── duplicateRule ────────────────────────────────────────────────────

  describe("duplicateRule", () => {
    it("calls duplicateMut with correct id and name", async () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "rule-1", name: "My Automation", description: "desc", category: "Notifica" });

      await act(async () => {
        await result.current.duplicateRule(rule);
      });

      expect(mockDuplicateMut.mutateAsync).toHaveBeenCalledTimes(1);
      expect(mockDuplicateMut.mutateAsync).toHaveBeenCalledWith({
        id: "rule-1",
        name: "My Automation (Copia)",
      });
    });

    it("calls createVersion after successful duplicate", async () => {
      mockDuplicateMut.mutateAsync.mockResolvedValue("duped-id-999");

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "rule-1", name: "My Rule", description: "A desc", category: "Cat" });

      await act(async () => {
        await result.current.duplicateRule(rule);
      });

      expect(mockCreateVersion).toHaveBeenCalledTimes(1);
      const cvArgs = mockCreateVersion.mock.calls[0]!;
      expect(cvArgs[0]).toBe("automation_flows");
      expect(cvArgs[1]).toBe("duped-id-999");
      expect(cvArgs[5]).toBe("create");
    });

    it("shows success toast after duplicate", async () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "rule-1" });

      await act(async () => {
        await result.current.duplicateRule(rule);
      });

      expect(mockToast.success).toHaveBeenCalledWith("Automazione duplicata");
    });

    it("shows error toast when duplicateMut fails", async () => {
      mockDuplicateMut.mutateAsync.mockRejectedValue(new Error("Dup error"));

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "rule-1" });

      await act(async () => {
        await result.current.duplicateRule(rule);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Dup error");
    });

    it("handles non-Error rejection for duplicate", async () => {
      mockDuplicateMut.mutateAsync.mockRejectedValue("duplicate fail");

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "rule-1" });

      await act(async () => {
        await result.current.duplicateRule(rule);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore duplicazione");
    });
  });

  // ── deleteRule / confirmDeleteRuleAction ─────────────────────────────

  describe("deleteRule / confirmDeleteRuleAction", () => {
    it("deleteRule sets confirmDeleteRule to the given rule", () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "del-1" });

      act(() => {
        result.current.deleteRule(rule);
      });

      expect(result.current.confirmDeleteRule).toEqual(rule);
    });

    it("confirmDeleteRuleAction calls deleteMut with rule id", async () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "del-1" });

      act(() => {
        result.current.deleteRule(rule);
      });

      await act(async () => {
        await result.current.confirmDeleteRuleAction();
      });

      expect(mockDeleteMut.mutateAsync).toHaveBeenCalledWith("del-1");
    });

    it("confirmDeleteRuleAction clears confirmDeleteRule after success", async () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "del-1" });

      act(() => {
        result.current.deleteRule(rule);
      });
      expect(result.current.confirmDeleteRule).not.toBeNull();

      await act(async () => {
        await result.current.confirmDeleteRuleAction();
      });

      expect(result.current.confirmDeleteRule).toBeNull();
    });

    it("confirmDeleteRuleAction shows success toast", async () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "del-1" });

      act(() => {
        result.current.deleteRule(rule);
      });

      await act(async () => {
        await result.current.confirmDeleteRuleAction();
      });

      expect(mockToast.success).toHaveBeenCalledWith("Automazione eliminata");
    });

    it("confirmDeleteRuleAction shows error toast on failure", async () => {
      mockDeleteMut.mutateAsync.mockRejectedValue(new Error("Delete error"));

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "del-1" });

      act(() => {
        result.current.deleteRule(rule);
      });

      await act(async () => {
        await result.current.confirmDeleteRuleAction();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Delete error");
    });

    it("confirmDeleteRuleAction does nothing when confirmDeleteRule is null", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.confirmDeleteRuleAction();
      });

      expect(mockDeleteMut.mutateAsync).not.toHaveBeenCalled();
    });
  });

  // ── archiveRule / confirmArchiveRuleAction ───────────────────────────

  describe("archiveRule / confirmArchiveRuleAction", () => {
    it("archiveRule sets confirmArchiveRule to the given rule", () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "arc-1" });

      act(() => {
        result.current.archiveRule(rule);
      });

      expect(result.current.confirmArchiveRule).toEqual(rule);
    });

    it("confirmArchiveRuleAction calls archiveMut with id and fd", async () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "arc-1", flow_definition: { meta: {} } });

      act(() => {
        result.current.archiveRule(rule);
      });

      await act(async () => {
        await result.current.confirmArchiveRuleAction();
      });

      expect(mockArchiveMut.mutateAsync).toHaveBeenCalledTimes(1);
      const callArg = mockArchiveMut.mutateAsync.mock.calls[0]![0] as { id: string; fd: Record<string, unknown> };
      expect(callArg.id).toBe("arc-1");
      expect((callArg.fd.meta as Record<string, unknown>).archived).toBe(true);
    });

    it("confirmArchiveRuleAction calls createVersion after archive", async () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "arc-1", flow_definition: { meta: {} } });

      act(() => {
        result.current.archiveRule(rule);
      });

      await act(async () => {
        await result.current.confirmArchiveRuleAction();
      });

      expect(mockCreateVersion).toHaveBeenCalledTimes(1);
      const cvArgs = mockCreateVersion.mock.calls[0]!;
      expect(cvArgs[0]).toBe("automation_flows");
      expect(cvArgs[1]).toBe("arc-1");
      expect(cvArgs[5]).toBe("update");
    });

    it("confirmArchiveRuleAction clears confirmArchiveRule after success", async () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "arc-1" });

      act(() => {
        result.current.archiveRule(rule);
      });
      expect(result.current.confirmArchiveRule).not.toBeNull();

      await act(async () => {
        await result.current.confirmArchiveRuleAction();
      });

      expect(result.current.confirmArchiveRule).toBeNull();
    });

    it("confirmArchiveRuleAction shows success toast", async () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "arc-1" });

      act(() => {
        result.current.archiveRule(rule);
      });

      await act(async () => {
        await result.current.confirmArchiveRuleAction();
      });

      expect(mockToast.success).toHaveBeenCalledWith("Automazione archiviata");
    });

    it("confirmArchiveRuleAction shows error toast on failure", async () => {
      mockArchiveMut.mutateAsync.mockRejectedValue(new Error("Archive error"));

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "arc-1" });

      act(() => {
        result.current.archiveRule(rule);
      });

      await act(async () => {
        await result.current.confirmArchiveRuleAction();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Archive error");
    });

    it("confirmArchiveRuleAction does nothing when confirmArchiveRule is null", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.confirmArchiveRuleAction();
      });

      expect(mockArchiveMut.mutateAsync).not.toHaveBeenCalled();
    });
  });

  // ── runRule / confirmRunRuleAction ───────────────────────────────────

  describe("runRule / confirmRunRuleAction", () => {
    it("runRule (non-dry) sets confirmRunRule to the rule", () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "run-1" });

      act(() => {
        result.current.runRule(rule, false);
      });

      expect(result.current.confirmRunRule).toEqual(rule);
    });

    it("runRule (dry run) opens dry run dialog instead", () => {
      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "dry-1" });

      act(() => {
        result.current.runRule(rule, true);
      });

      expect(result.current.dryRunRule).toEqual(rule);
      expect(result.current.dryRunDialogOpen).toBe(true);
      expect(result.current.confirmRunRule).toBeNull();
    });

    it("confirmRunRuleAction calls executeRun with correct params", async () => {
      mockExecuteRun.mockResolvedValue(createRunLog({ id: "log-ok" }));

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "run-1" });

      act(() => {
        result.current.runRule(rule, false);
      });

      await act(async () => {
        await result.current.confirmRunRuleAction();
      });

      expect(mockExecuteRun).toHaveBeenCalledTimes(1);
      const callArg = mockExecuteRun.mock.calls[0]![0] as { data: Record<string, unknown> };
      expect(callArg.data.automationId).toBe("run-1");
      expect(callArg.data.isDryRun).toBe(false);
      expect(callArg.data.triggerPayload).toEqual({ source: "manual_run" });
    });

    it("confirmRunRuleAction clears confirmRunRule after success", async () => {
      mockExecuteRun.mockResolvedValue(createRunLog());

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "run-1" });

      act(() => {
        result.current.runRule(rule, false);
      });
      expect(result.current.confirmRunRule).not.toBeNull();

      await act(async () => {
        await result.current.confirmRunRuleAction();
      });

      expect(result.current.confirmRunRule).toBeNull();
    });

    it("confirmRunRuleAction sets confirmRunLoading during execution", async () => {
      let resolveLog: (value: unknown) => void;
      mockExecuteRun.mockReturnValue(
        new Promise((resolve) => {
          resolveLog = resolve;
        }),
      );

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "run-1" });

      act(() => {
        result.current.runRule(rule, false);
      });

      // Start action without awaiting
      act(() => {
        result.current.confirmRunRuleAction();
      });

      expect(result.current.confirmRunLoading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolveLog!(createRunLog());
        await new Promise((r) => setTimeout(r, 10));
      });

      expect(result.current.confirmRunLoading).toBe(false);
    });

    it("confirmRunRuleAction shows error toast on failure", async () => {
      mockExecuteRun.mockRejectedValue(new Error("Run failed"));

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "run-1" });

      act(() => {
        result.current.runRule(rule, false);
      });

      await act(async () => {
        await result.current.confirmRunRuleAction();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Run failed");
      expect(result.current.confirmRunLoading).toBe(false);
    });

    it("confirmRunRuleAction handles non-Error rejection", async () => {
      mockExecuteRun.mockRejectedValue("fail");

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "run-1" });

      act(() => {
        result.current.runRule(rule, false);
      });

      await act(async () => {
        await result.current.confirmRunRuleAction();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Run non riuscita");
    });

    it("confirmRunRuleAction calls loadStats and refetch after success", async () => {
      mockExecuteRun.mockResolvedValue(createRunLog());

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "run-1" });

      act(() => {
        result.current.runRule(rule, false);
      });

      await act(async () => {
        await result.current.confirmRunRuleAction();
      });

      expect(mockLoadRunStats).toHaveBeenCalled();
      expect(mockListQuery.refetch).toHaveBeenCalled();
    });

    it("confirmRunRuleAction shows success toast", async () => {
      mockExecuteRun.mockResolvedValue(createRunLog());

      const { result } = renderHook(() => useAutomationRules());
      const rule = createRule({ id: "run-1" });

      act(() => {
        result.current.runRule(rule, false);
      });

      await act(async () => {
        await result.current.confirmRunRuleAction();
      });

      expect(mockToast.success).toHaveBeenCalledWith("Run manuale completata");
    });

    it("confirmRunRuleAction does nothing when confirmRunRule is null", async () => {
      const { result } = renderHook(() => useAutomationRules());

      await act(async () => {
        await result.current.confirmRunRuleAction();
      });

      expect(mockExecuteRun).not.toHaveBeenCalled();
    });
  });

});
