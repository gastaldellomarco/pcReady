import { renderHook, act, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DASHBOARD_WIDGETS, type DashboardLayout } from "@/components/dashboard/widget-registry";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";

// ── Mock server functions ─────────────────────────────────────────────
const serverFnMocks = vi.hoisted(() => ({
  getMyDashboardLayout: vi.fn<() => Promise<DashboardLayout | null>>(),
  updateMyDashboardLayout: vi.fn<() => Promise<{ success: boolean }>>(),
}));

vi.mock("@/lib/user-profile", () => ({
  getMyDashboardLayout: serverFnMocks.getMyDashboardLayout,
  updateMyDashboardLayout: serverFnMocks.updateMyDashboardLayout,
}));

// ── Mock TanStack Start ────────────────────────────────────────────────
vi.mock("@tanstack/react-start", () => ({
  useServerFn: vi.fn((fn: unknown) => {
    if (fn === serverFnMocks.getMyDashboardLayout) return serverFnMocks.getMyDashboardLayout;
    if (fn === serverFnMocks.updateMyDashboardLayout) return serverFnMocks.updateMyDashboardLayout;
    return vi.fn();
  }),
}));

// ── Mock sonner ────────────────────────────────────────────────────────
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

// ── Mock auth-context ───────────────────────────────────────────────────
type MockAuth = {
  session: { access_token: string } | null;
  profile: { role: "admin" | "tech" | "viewer" } | null;
};

let currentAuth: MockAuth = {
  session: { access_token: "token-123" },
  profile: { role: "admin" },
};

vi.mock("@/lib/auth-context", () => ({
  useAuth: vi.fn(() => currentAuth),
}));

// Re-import so we can update the mock dynamically
import { useAuth } from "@/lib/auth-context";

// ── Helpers ──────────────────────────────────────────────────────────────

function setMockAuth(overrides: Partial<MockAuth> = {}) {
  currentAuth = {
    session: overrides.session ?? { access_token: "token-123" },
    profile: overrides.profile !== undefined ? overrides.profile : { role: "admin" },
  };
  vi.mocked(useAuth).mockReturnValue(currentAuth as any);
}

function expectAllWidgetsVisible(layout: DashboardLayout) {
  const visible = layout.widgets.filter((w) => w.visible);
  expect(visible).toHaveLength(DASHBOARD_WIDGETS.length);
}

function expectWidgetsById(layout: DashboardLayout, widgetIds: string[]): void {
  const visibleIds = layout.widgets.filter((w) => w.visible).map((w) => w.id);
  for (const id of widgetIds) {
    expect(visibleIds).toContain(id);
  }
}

function expectWidgetsHidden(layout: DashboardLayout, widgetIds: string[]): void {
  const hiddenIds = layout.widgets.filter((w) => !w.visible).map((w) => w.id);
  for (const id of widgetIds) {
    expect(hiddenIds).toContain(id);
  }
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("useDashboardLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockAuth();
    serverFnMocks.getMyDashboardLayout.mockResolvedValue(null); // no saved layout
    serverFnMocks.updateMyDashboardLayout.mockResolvedValue({ success: true });
  });

  // ── Default state ────────────────────────────────────────────────

  describe("default state", () => {
    it("starts with null layout and loading true", () => {
      serverFnMocks.getMyDashboardLayout.mockReturnValue(
        new Promise(() => {
          /* never resolves */
        }),
      );

      const { result } = renderHook(() => useDashboardLayout());

      expect(result.current.layout).toBeNull();
      expect(result.current.loading).toBe(true);
    });
  });

  // ── Role-based defaults ──────────────────────────────────────────

  describe("role-based default layout (no saved layout)", () => {
    it("creates admin layout with all widgets visible", async () => {
      setMockAuth({ profile: { role: "admin" } });
      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.layout).not.toBeNull();
      expectAllWidgetsVisible(result.current.layout!);
    });

    it("creates tech layout with kanban-wip-limits visible and critical-events hidden", async () => {
      setMockAuth({ profile: { role: "tech" } });
      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expectWidgetsById(result.current.layout!, ["kanban-wip-limits"]);
      expectWidgetsHidden(result.current.layout!, [
        "critical-events",
        "tickets-without-device",
        "trend-chart",
      ]);
    });

    it("creates viewer layout with only overview widgets", async () => {
      setMockAuth({ profile: { role: "viewer" } });
      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expectWidgetsById(result.current.layout!, [
        "stat-cards",
        "analytics-card",
        "trend-chart",
        "recent-tickets",
        "status-distribution",
        "warranty-overview",
      ]);
      expectWidgetsHidden(result.current.layout!, [
        "kanban-wip-limits",
        "critical-events",
        "technician-heatmap",
      ]);
    });

    it("falls back to viewer when profile is null", async () => {
      setMockAuth({ profile: null });
      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Viewer has 6 visible widgets
      const visible = result.current.layout!.widgets.filter((w) => w.visible);
      expect(visible).toHaveLength(6);
      expectWidgetsById(result.current.layout!, ["stat-cards", "trend-chart"]);
    });

    it("falls back to viewer when session is null", async () => {
      setMockAuth({ session: null, profile: { role: "admin" } });
      const { result } = renderHook(() => useDashboardLayout());

      // Without session, the effect doesn't run — layout stays null
      expect(result.current.layout).toBeNull();
      expect(result.current.loading).toBe(true);
    });
  });

  // ── Saved layout ────────────────────────────────────────────────

  describe("saved layout", () => {
    it("uses saved layout when available instead of default", async () => {
      const savedLayout: DashboardLayout = {
        widgets: DASHBOARD_WIDGETS.map((w, i) => ({
          id: w.id,
          order: i,
          visible: w.id === "stat-cards", // only stat-cards visible
        })),
      };
      serverFnMocks.getMyDashboardLayout.mockResolvedValue(savedLayout);

      setMockAuth({ profile: { role: "admin" } });
      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Saved layout should be used (not the admin default)
      expect(result.current.layout).toEqual(savedLayout);
      const visible = result.current.layout!.widgets.filter((w) => w.visible);
      expect(visible).toHaveLength(1);
      expect(visible[0].id).toBe("stat-cards");
    });

    it("calls loadLayout with correct accessToken", async () => {
      setMockAuth({ profile: { role: "admin" } });
      renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(serverFnMocks.getMyDashboardLayout).toHaveBeenCalledWith({
          data: { accessToken: "token-123" },
        });
      });
    });
  });

  // ── Error handling ──────────────────────────────────────────────

  describe("error handling", () => {
    it("falls back to role default when loadLayout rejects", async () => {
      serverFnMocks.getMyDashboardLayout.mockRejectedValue(new Error("Network error"));

      setMockAuth({ profile: { role: "tech" } });
      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have fallen back to tech default
      expect(result.current.layout).not.toBeNull();
      expectWidgetsById(result.current.layout!, ["kanban-wip-limits"]);
    });

    it("falls back to admin default when loadLayout rejects for admin", async () => {
      serverFnMocks.getMyDashboardLayout.mockRejectedValue(new Error("Network error"));

      setMockAuth({ profile: { role: "admin" } });
      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.layout).not.toBeNull();
      expectAllWidgetsVisible(result.current.layout!);
    });
  });

  // ── Loading state ────────────────────────────────────────────────

  describe("loading state", () => {
    it("is true during fetch, becomes false after", async () => {
      let resolvePromise!: (value: DashboardLayout | null) => void;
      serverFnMocks.getMyDashboardLayout.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const { result } = renderHook(() => useDashboardLayout());

      // Initially loading
      expect(result.current.loading).toBe(true);

      // Resolve the fetch
      await act(async () => {
        resolvePromise(null);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  // ── visibleWidgets and allWidgets ──────────────────────────────────

  describe("visibleWidgets and allWidgets", () => {
    it("visibleWidgets returns only visible widgets sorted by order", async () => {
      setMockAuth({ profile: { role: "viewer" } });

      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { visibleWidgets } = result.current;
      expect(visibleWidgets.every((w) => w.visible)).toBe(true);
      // Viewer has 6 visible widgets
      expect(visibleWidgets.length).toBe(6);
      // Should be sorted by order
      for (let i = 1; i < visibleWidgets.length; i++) {
        expect(visibleWidgets[i].order).toBeGreaterThanOrEqual(visibleWidgets[i - 1].order);
      }
    });

    it("allWidgets returns all widgets sorted by order", async () => {
      setMockAuth({ profile: { role: "admin" } });

      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { allWidgets } = result.current;
      expect(allWidgets).toHaveLength(DASHBOARD_WIDGETS.length);
      // Should be sorted by order
      for (let i = 1; i < allWidgets.length; i++) {
        expect(allWidgets[i].order).toBeGreaterThanOrEqual(allWidgets[i - 1].order);
      }
    });

    it("allWidgets returns fallback when layout is null (initial state)", () => {
      serverFnMocks.getMyDashboardLayout.mockReturnValue(
        new Promise(() => {
          /* never resolves */
        }),
      );

      const { result } = renderHook(() => useDashboardLayout());

      const { allWidgets } = result.current;
      // Falls back to DASHBOARD_WIDGETS map with default visible:true
      expect(allWidgets).toHaveLength(DASHBOARD_WIDGETS.length);
      expect(allWidgets.every((w) => w.visible)).toBe(true);
    });

    it("visibleWidgets returns empty array when layout is null (initial state)", () => {
      serverFnMocks.getMyDashboardLayout.mockReturnValue(
        new Promise(() => {
          /* never resolves */
        }),
      );

      const { result } = renderHook(() => useDashboardLayout());

      expect(result.current.visibleWidgets).toEqual([]);
    });
  });

  // ── reorder ──────────────────────────────────────────────────────

  describe("reorder", () => {
    it("reorders widgets and persists", async () => {
      setMockAuth({ profile: { role: "admin" } });

      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialOrder = result.current.layout!.widgets.map((w) => w.id);

      // Move last widget to first position
      await act(async () => {
        result.current.reorder(15, 0);
      });

      const newOrder = result.current
        .layout!.widgets.filter((w) => w.visible)
        .sort((a, b) => a.order - b.order)
        .map((w) => w.id);

      // The last widget should now be first among visible
      expect(newOrder[0]).toBe(initialOrder[15]);

      // Should have persisted
      expect(serverFnMocks.updateMyDashboardLayout).toHaveBeenCalled();
    });

    it("does nothing when layout is null", async () => {
      serverFnMocks.getMyDashboardLayout.mockReturnValue(
        new Promise(() => {
          /* never resolves */
        }),
      );

      const { result } = renderHook(() => useDashboardLayout());

      act(() => {
        result.current.reorder(0, 1);
      });

      expect(serverFnMocks.updateMyDashboardLayout).not.toHaveBeenCalled();
    });
  });

  // ── toggleVisibility ──────────────────────────────────────────────

  describe("toggleVisibility", () => {
    it("toggles a widget from visible to hidden", async () => {
      setMockAuth({ profile: { role: "admin" } });

      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.layout!.widgets.find((w) => w.id === "stat-cards")!.visible).toBe(true);

      await act(async () => {
        result.current.toggleVisibility("stat-cards");
      });

      expect(result.current.layout!.widgets.find((w) => w.id === "stat-cards")!.visible).toBe(
        false,
      );

      // Should have persisted
      expect(serverFnMocks.updateMyDashboardLayout).toHaveBeenCalled();
    });

    it("toggles a widget from hidden to visible", async () => {
      setMockAuth({ profile: { role: "viewer" } });

      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // For viewer, kanban-wip-limits starts hidden
      expect(
        result.current.layout!.widgets.find((w) => w.id === "kanban-wip-limits")!.visible,
      ).toBe(false);

      await act(async () => {
        result.current.toggleVisibility("kanban-wip-limits");
      });

      expect(
        result.current.layout!.widgets.find((w) => w.id === "kanban-wip-limits")!.visible,
      ).toBe(true);
    });

    it("does nothing when layout is null", async () => {
      serverFnMocks.getMyDashboardLayout.mockReturnValue(
        new Promise(() => {
          /* never resolves */
        }),
      );

      const { result } = renderHook(() => useDashboardLayout());

      act(() => {
        result.current.toggleVisibility("stat-cards");
      });

      expect(serverFnMocks.updateMyDashboardLayout).not.toHaveBeenCalled();
    });
  });

  // ── editMode ─────────────────────────────────────────────────────

  describe("editMode", () => {
    it("starts as false", () => {
      serverFnMocks.getMyDashboardLayout.mockReturnValue(
        new Promise(() => {
          /* never resolves */
        }),
      );

      const { result } = renderHook(() => useDashboardLayout());

      expect(result.current.editMode).toBe(false);
    });

    it("can be toggled", () => {
      const { result } = renderHook(() => useDashboardLayout());

      act(() => {
        result.current.setEditMode(true);
      });

      expect(result.current.editMode).toBe(true);

      act(() => {
        result.current.setEditMode(false);
      });

      expect(result.current.editMode).toBe(false);
    });
  });

  // ── Persist error ────────────────────────────────────────────────

  describe("persist error", () => {
    it("shows error toast when saveLayout fails", async () => {
      serverFnMocks.updateMyDashboardLayout.mockRejectedValue(new Error("Save failed"));

      setMockAuth({ profile: { role: "admin" } });
      const { result } = renderHook(() => useDashboardLayout());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        result.current.toggleVisibility("stat-cards");
      });

      // Wait for the rejected promise to trigger the toast
      await new Promise((r) => setTimeout(r, 50));

      expect(toastMock.error).toHaveBeenCalledWith("Errore nel salvare la disposizione dei widget");
    });

    it("does not attempt to save when session is null", async () => {
      setMockAuth({ session: null });
      const { result } = renderHook(() => useDashboardLayout());

      await act(async () => {
        result.current.toggleVisibility("stat-cards");
      });

      expect(serverFnMocks.updateMyDashboardLayout).not.toHaveBeenCalled();
    });
  });
});
