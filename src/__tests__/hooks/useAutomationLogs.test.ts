// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAutomationLogs } from "@/hooks/useAutomationLogs";
import type { AutomationRule } from "@/types/automation";
import type { AutomationRunLog } from "@/lib/automation-runs";

// ── Mock @/lib/automation-runs (evita la catena createServerFn) ─────────
const serverFnMocks = vi.hoisted(() => ({
  listAutomationRunLogs: vi.fn(),
  listAllAutomationRunLogs: vi.fn(),
}));

vi.mock("@/lib/automation-runs", () => ({
  listAutomationRunLogs: serverFnMocks.listAutomationRunLogs,
  listAllAutomationRunLogs: serverFnMocks.listAllAutomationRunLogs,
}));

// ── Mock useServerFn (TanStack Start) ───────────────────────────────────
vi.mock("@tanstack/react-start", () => ({
  useServerFn: vi.fn((fn: unknown) => {
    if (fn === serverFnMocks.listAutomationRunLogs)
      return serverFnMocks.listAutomationRunLogs;
    if (fn === serverFnMocks.listAllAutomationRunLogs)
      return serverFnMocks.listAllAutomationRunLogs;
    return vi.fn();
  }),
}));

// ── Mock sonner ─────────────────────────────────────────────────────────
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

// ── Factory helpers ─────────────────────────────────────────────────────

function createRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: "rule-1",
    name: "Test Rule",
    description: "Test description",
    category: "Generale",
    active: true,
    version: 1,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createLog(
  overrides: Partial<AutomationRunLog> & {
    automation_flows?: { name: string };
  } = {},
): AutomationRunLog & { automation_flows?: { name: string } } {
  return {
    id: "log-1",
    automation_id: "rule-1",
    triggered_at: "2026-01-01T12:00:00.000Z",
    triggered_by: "manual",
    status: "success",
    duration_ms: 1500,
    trigger_payload: null,
    actions_executed: null,
    error_message: null,
    is_dry_run: false,
    ...overrides,
  };
}

const loggedSession = { access_token: "token-123" };
const emptySession = null;

describe("useAutomationLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("default state", () => {
    it("starts with all state at default values", () => {
      const { result } = renderHook(() => useAutomationLogs(emptySession));

      expect(result.current.logsByRule).toEqual({});
      expect(result.current.logsOpenRuleId).toBeNull();
      expect(result.current.loadingLogsRuleId).toBeNull();
      expect(result.current.globalLogsOpen).toBe(false);
      expect(result.current.globalLogs).toEqual([]);
      expect(result.current.globalLogsLoading).toBe(false);
      expect(result.current.globalLogsFilter).toEqual({
        ruleId: "",
        status: "",
        dateFrom: "",
        dateTo: "",
      });
    });
  });

  describe("toggleLogs", () => {
    it("opens logs for a rule and fetches them", async () => {
      const mockLogs = [createLog({ id: "log-1" })];
      serverFnMocks.listAutomationRunLogs.mockResolvedValue(mockLogs);

      const { result } = renderHook(() => useAutomationLogs(loggedSession));
      const rule = createRule({ id: "rule-1" });

      await act(async () => {
        await result.current.toggleLogs(rule);
      });

      expect(result.current.logsOpenRuleId).toBe("rule-1");
      expect(result.current.logsByRule["rule-1"]).toEqual(mockLogs);
      expect(serverFnMocks.listAutomationRunLogs).toHaveBeenCalledTimes(1);
      expect(
        serverFnMocks.listAutomationRunLogs.mock.calls[0][0].data
          .automationId,
      ).toBe("rule-1");
    });

    it("closes logs when tapping the same rule again", async () => {
      serverFnMocks.listAutomationRunLogs.mockResolvedValue([createLog()]);

      const { result } = renderHook(() => useAutomationLogs(loggedSession));
      const rule = createRule({ id: "rule-1" });

      await act(async () => {
        await result.current.toggleLogs(rule);
      });
      expect(result.current.logsOpenRuleId).toBe("rule-1");

      await act(async () => {
        await result.current.toggleLogs(rule);
      });
      expect(result.current.logsOpenRuleId).toBeNull();

      expect(serverFnMocks.listAutomationRunLogs).toHaveBeenCalledTimes(1);
    });

    it("does not refetch if logs are already cached", async () => {
      serverFnMocks.listAutomationRunLogs.mockResolvedValue([createLog()]);

      const { result } = renderHook(() => useAutomationLogs(loggedSession));
      const rule = createRule({ id: "rule-1" });

      await act(async () => {
        await result.current.toggleLogs(rule);
      });
      await act(async () => {
        await result.current.toggleLogs(rule);
      });
      await act(async () => {
        await result.current.toggleLogs(rule);
      });

      expect(result.current.logsOpenRuleId).toBe("rule-1");
      expect(serverFnMocks.listAutomationRunLogs).toHaveBeenCalledTimes(1);
    });

    it("does nothing if session is null", async () => {
      const { result } = renderHook(() => useAutomationLogs(emptySession));
      const rule = createRule({ id: "rule-1" });

      await act(async () => {
        await result.current.toggleLogs(rule);
      });

      expect(result.current.logsOpenRuleId).toBe("rule-1");
      expect(serverFnMocks.listAutomationRunLogs).not.toHaveBeenCalled();
    });

    it("sets loadingLogsRuleId during fetch and clears it after", async () => {
      serverFnMocks.listAutomationRunLogs.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([createLog()]), 100),
          ),
      );

      const { result } = renderHook(() => useAutomationLogs(loggedSession));
      const rule = createRule({ id: "rule-1" });

      // Start toggle without awaiting — loading state should be set immediately
      act(() => {
        result.current.toggleLogs(rule);
      });

      expect(result.current.loadingLogsRuleId).toBe("rule-1");

      // Wait for fetch to complete
      await act(async () => {
        await new Promise((r) => setTimeout(r, 200));
      });

      expect(result.current.loadingLogsRuleId).toBeNull();
    });

    it("shows toast error when fetch fails", async () => {
      serverFnMocks.listAutomationRunLogs.mockRejectedValue(
        new Error("Errore di rete"),
      );

      const { result } = renderHook(() => useAutomationLogs(loggedSession));
      const rule = createRule({ id: "rule-1" });

      await act(async () => {
        await result.current.toggleLogs(rule);
      });

      expect(toastMock.error).toHaveBeenCalledWith("Errore di rete");
      expect(result.current.loadingLogsRuleId).toBeNull();
    });

    it("handles non-Error rejection gracefully", async () => {
      serverFnMocks.listAutomationRunLogs.mockRejectedValue("server crash");

      const { result } = renderHook(() => useAutomationLogs(loggedSession));
      const rule = createRule({ id: "rule-1" });

      await act(async () => {
        await result.current.toggleLogs(rule);
      });

      expect(toastMock.error).toHaveBeenCalledWith(
        "Errore caricamento storico",
      );
    });
  });

  describe("global logs", () => {
    it("loadGlobalLogs fetches all logs and sets them", async () => {
      const mockLogs = [
        createLog({ id: "glog-1", automation_flows: { name: "Test Rule" } }),
      ];
      serverFnMocks.listAllAutomationRunLogs.mockResolvedValue(mockLogs);

      const { result } = renderHook(() => useAutomationLogs(loggedSession));

      await act(async () => {
        await result.current.loadGlobalLogs();
      });

      expect(result.current.globalLogs).toEqual(mockLogs);
      expect(result.current.globalLogsLoading).toBe(false);
    });

    it("loadGlobalLogs does nothing without session", async () => {
      const { result } = renderHook(() => useAutomationLogs(emptySession));

      await act(async () => {
        await result.current.loadGlobalLogs();
      });

      expect(serverFnMocks.listAllAutomationRunLogs).not.toHaveBeenCalled();
      expect(result.current.globalLogsLoading).toBe(false);
    });

    it("loadGlobalLogs shows toast on error", async () => {
      serverFnMocks.listAllAutomationRunLogs.mockRejectedValue(
        new Error("API error"),
      );

      const { result } = renderHook(() => useAutomationLogs(loggedSession));

      await act(async () => {
        await result.current.loadGlobalLogs();
      });

      expect(toastMock.error).toHaveBeenCalledWith("API error");
      expect(result.current.globalLogsLoading).toBe(false);
    });

    it("loadGlobalLogs handles non-Error rejection gracefully", async () => {
      serverFnMocks.listAllAutomationRunLogs.mockRejectedValue("fail");

      const { result } = renderHook(() => useAutomationLogs(loggedSession));

      await act(async () => {
        await result.current.loadGlobalLogs();
      });

      expect(toastMock.error).toHaveBeenCalledWith(
        "Errore caricamento log globali",
      );
    });

    it("auto-loads globalLogs when globalLogsOpen becomes true", async () => {
      serverFnMocks.listAllAutomationRunLogs.mockResolvedValue([
        createLog({ id: "glog-1" }),
      ]);

      const { result } = renderHook(() => useAutomationLogs(loggedSession));

      act(() => {
        result.current.setGlobalLogsOpen(true);
      });

      await waitFor(() => {
        expect(serverFnMocks.listAllAutomationRunLogs).toHaveBeenCalled();
      });
    });

    it("does not auto-load globalLogs when session is null", async () => {
      const { result } = renderHook(() => useAutomationLogs(emptySession));

      act(() => {
        result.current.setGlobalLogsOpen(true);
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(serverFnMocks.listAllAutomationRunLogs).not.toHaveBeenCalled();
    });

    it("setGlobalLogsFilter updates filter state", () => {
      const { result } = renderHook(() => useAutomationLogs(loggedSession));

      act(() => {
        result.current.setGlobalLogsFilter({
          ruleId: "rule-1",
          status: "error",
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31",
        });
      });

      expect(result.current.globalLogsFilter).toEqual({
        ruleId: "rule-1",
        status: "error",
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
      });
    });

    it("applies filter params when calling loadGlobalLogs", async () => {
      serverFnMocks.listAllAutomationRunLogs.mockResolvedValue([]);

      const { result } = renderHook(() => useAutomationLogs(loggedSession));

      act(() => {
        result.current.setGlobalLogsFilter({
          ruleId: "rule-42",
          status: "success",
          dateFrom: "2026-06-01",
          dateTo: "",
        });
      });

      await act(async () => {
        await result.current.loadGlobalLogs();
      });

      const callArg =
        serverFnMocks.listAllAutomationRunLogs.mock.calls[0][0].data;
      expect(callArg.automationId).toBe("rule-42");
      expect(callArg.status).toBe("success");
      expect(callArg.dateFrom).toBe("2026-06-01");
      expect(callArg.dateTo).toBeUndefined();
    });
  });

  describe("exportLogsCsv", () => {
    beforeEach(() => {
      global.URL.createObjectURL = vi.fn(() => "blob:mock");
      global.URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      // Restore any spies that might have been added (e.g., document.createElement)
      vi.restoreAllMocks();
    });

    it("shows error toast when globalLogs is empty", () => {
      const { result } = renderHook(() => useAutomationLogs(loggedSession));

      act(() => {
        result.current.exportLogsCsv();
      });

      expect(toastMock.error).toHaveBeenCalledWith("Nessun log da esportare");
    });

    it("generates CSV with BOM and correct headers and triggers download", () => {
      const mockAnchor = {
        href: "",
        download: "",
        click: vi.fn(),
      };
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "a") return mockAnchor as unknown as HTMLAnchorElement;
        return originalCreateElement(tag);
      });

      const mockLogs = [
        createLog({
          id: "log-1",
          automation_id: "rule-1",
          automation_flows: { name: "Email Rule" },
          triggered_by: "ticket_created",
          triggered_at: "2026-01-01T12:00:00.000Z",
          status: "success",
          duration_ms: 1500,
          error_message: null,
        }),
      ];

      const { result } = renderHook(() => useAutomationLogs(loggedSession));
      act(() => {
        result.current.setGlobalLogs(mockLogs as any);
      });

      act(() => {
        result.current.exportLogsCsv();
      });

      expect(mockAnchor.download).toMatch(/^automation-logs-/);
      expect(mockAnchor.href).toBe("blob:mock");
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
      expect(toastMock.success).toHaveBeenCalledWith("Log esportati");
    });

    it("handles missing automation_flows name gracefully", () => {
      const mockAnchor = {
        href: "",
        download: "",
        click: vi.fn(),
      };
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "a") return mockAnchor as unknown as HTMLAnchorElement;
        return originalCreateElement(tag);
      });

      const mockLogs = [
        createLog({
          id: "log-2",
          automation_id: "rule-2",
          automation_flows: undefined,
        }),
      ];

      const { result } = renderHook(() => useAutomationLogs(loggedSession));
      act(() => {
        result.current.setGlobalLogs(mockLogs as any);
      });

      act(() => {
        result.current.exportLogsCsv();
      });

      expect(mockAnchor.click).toHaveBeenCalled();
      expect(toastMock.success).toHaveBeenCalled();
    });

    it("includes logs with error_message and dry_run status", () => {
      const mockAnchor = {
        href: "",
        download: "",
        click: vi.fn(),
      };
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "a") return mockAnchor as unknown as HTMLAnchorElement;
        return originalCreateElement(tag);
      });

      const mockLogs = [
        createLog({
          id: "log-3",
          status: "error",
          error_message: "Connection timeout",
          is_dry_run: true,
          duration_ms: null,
        }),
      ];

      const { result } = renderHook(() => useAutomationLogs(loggedSession));
      act(() => {
        result.current.setGlobalLogs(mockLogs as any);
      });

      act(() => {
        result.current.exportLogsCsv();
      });

      expect(mockAnchor.click).toHaveBeenCalled();
      expect(toastMock.success).toHaveBeenCalled();
    });
  });

  describe("state setters", () => {
    it("setLogsByRule updates state", () => {
      const { result } = renderHook(() => useAutomationLogs(loggedSession));
      const logs = [createLog()];

      act(() => {
        result.current.setLogsByRule({ "rule-1": logs });
      });

      expect(result.current.logsByRule["rule-1"]).toEqual(logs);
    });

    it("setLogsOpenRuleId updates state", () => {
      const { result } = renderHook(() => useAutomationLogs(loggedSession));

      act(() => {
        result.current.setLogsOpenRuleId("rule-42");
      });

      expect(result.current.logsOpenRuleId).toBe("rule-42");
    });

    it("setGlobalLogsOpen updates state", () => {
      const { result } = renderHook(() => useAutomationLogs(loggedSession));

      act(() => {
        result.current.setGlobalLogsOpen(true);
      });

      expect(result.current.globalLogsOpen).toBe(true);
    });

    it("setGlobalLogsLoading updates state", () => {
      const { result } = renderHook(() => useAutomationLogs(loggedSession));

      act(() => {
        result.current.setGlobalLogsLoading(true);
      });

      expect(result.current.globalLogsLoading).toBe(true);
    });
  });
});
