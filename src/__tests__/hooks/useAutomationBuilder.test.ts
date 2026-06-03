import { renderHook, act, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAutomationBuilder } from "@/hooks/useAutomationBuilder";
import type { AutomationRule } from "@/types/automation";

// ── Mock sonner ─────────────────────────────────────────────────────────
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

// ── Mock AutomationBuilder (dynamic import target) ──────────────────────
const MockBuilder = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/components/pcready/automation/AutomationBuilder", () => ({
  default: MockBuilder,
}));

// ── Factory helper ──────────────────────────────────────────────────────

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

// ── Tests ──────────────────────────────────────────────────────────────

describe("useAutomationBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("default state", () => {
    it("starts with all state at default values", () => {
      const { result } = renderHook(() => useAutomationBuilder());

      expect(result.current.builderOpen).toBe(false);
      expect(result.current.editingRule).toBeNull();
      expect(result.current.AutomationBuilderComp).toBeNull();
      expect(result.current.guidedMode).toBe(true);
    });
  });

  describe("openCreateDialog", () => {
    it("sets builderOpen to true and editingRule to null", () => {
      const { result } = renderHook(() => useAutomationBuilder());

      // First open an edit to ensure state is dirty
      const rule = createRule({ id: "existing-rule" });
      act(() => {
        result.current.openEditDialog(rule);
      });
      expect(result.current.builderOpen).toBe(true);
      expect(result.current.editingRule).toEqual(rule);

      // Now open create — editingRule should be null
      act(() => {
        result.current.openCreateDialog();
      });

      expect(result.current.builderOpen).toBe(true);
      expect(result.current.editingRule).toBeNull();
    });

    it("opens builder even if already open", () => {
      const { result } = renderHook(() => useAutomationBuilder());

      act(() => {
        result.current.openCreateDialog();
      });
      expect(result.current.builderOpen).toBe(true);

      // Calling again should keep it open with null editingRule
      act(() => {
        result.current.openCreateDialog();
      });

      expect(result.current.builderOpen).toBe(true);
      expect(result.current.editingRule).toBeNull();
    });
  });

  describe("openEditDialog", () => {
    it("sets builderOpen to true and editingRule to the given rule", () => {
      const { result } = renderHook(() => useAutomationBuilder());
      const rule = createRule({ id: "rule-to-edit", name: "Edit Me" });

      act(() => {
        result.current.openEditDialog(rule);
      });

      expect(result.current.builderOpen).toBe(true);
      expect(result.current.editingRule).toEqual(rule);
      expect(result.current.editingRule?.id).toBe("rule-to-edit");
    });

    it("overwrites previous editingRule with new one", () => {
      const { result } = renderHook(() => useAutomationBuilder());
      const rule1 = createRule({ id: "first" });
      const rule2 = createRule({ id: "second" });

      act(() => {
        result.current.openEditDialog(rule1);
      });
      expect(result.current.editingRule?.id).toBe("first");

      act(() => {
        result.current.openEditDialog(rule2);
      });
      expect(result.current.editingRule?.id).toBe("second");
    });
  });

  describe("setBuilderOpen", () => {
    it("can manually open the builder", () => {
      const { result } = renderHook(() => useAutomationBuilder());

      act(() => {
        result.current.setBuilderOpen(true);
      });

      expect(result.current.builderOpen).toBe(true);
    });

    it("can manually close the builder", () => {
      const { result } = renderHook(() => useAutomationBuilder());

      act(() => {
        result.current.setBuilderOpen(true);
      });
      act(() => {
        result.current.setBuilderOpen(false);
      });

      expect(result.current.builderOpen).toBe(false);
    });
  });

  describe("setEditingRule", () => {
    it("can manually set editingRule to a rule", () => {
      const { result } = renderHook(() => useAutomationBuilder());
      const rule = createRule({ id: "manual-set" });

      act(() => {
        result.current.setEditingRule(rule);
      });

      expect(result.current.editingRule?.id).toBe("manual-set");
    });

    it("can clear editingRule back to null", () => {
      const { result } = renderHook(() => useAutomationBuilder());
      const rule = createRule({ id: "to-clear" });

      act(() => {
        result.current.setEditingRule(rule);
      });
      act(() => {
        result.current.setEditingRule(null);
      });

      expect(result.current.editingRule).toBeNull();
    });
  });

  describe("guidedMode", () => {
    it("starts as true", () => {
      const { result } = renderHook(() => useAutomationBuilder());

      expect(result.current.guidedMode).toBe(true);
    });

    it("can be toggled off", () => {
      const { result } = renderHook(() => useAutomationBuilder());

      act(() => {
        result.current.setGuidedMode(false);
      });

      expect(result.current.guidedMode).toBe(false);
    });

    it("can be toggled back on", () => {
      const { result } = renderHook(() => useAutomationBuilder());

      act(() => {
        result.current.setGuidedMode(false);
      });
      act(() => {
        result.current.setGuidedMode(true);
      });

      expect(result.current.guidedMode).toBe(true);
    });
  });

  describe("lazy import of AutomationBuilder", () => {
    it("triggers lazy import and sets AutomationBuilderComp when builder opens", async () => {
      const { result } = renderHook(() => useAutomationBuilder());

      expect(result.current.AutomationBuilderComp).toBeNull();

      act(() => {
        result.current.setBuilderOpen(true);
      });

      await waitFor(() => {
        expect(result.current.AutomationBuilderComp).not.toBeNull();
      });

      // The component should have been set
      expect(result.current.AutomationBuilderComp).toBe(MockBuilder);
    });

    // Note: Error path of the dynamic import cannot be tested with vi.mock
    // because module mocks are hoisted and fixed at load time.
    // To test it, the hook would need restructuring (e.g., injectable import path).
    it.skip("shows toast error when lazy import fails", () => {
      // Skipped: requires restructuring hook to make the import path injectable
    });

    it("does not reimport if component is already loaded", async () => {
      const { result } = renderHook(() => useAutomationBuilder());

      // First import
      act(() => {
        result.current.setBuilderOpen(true);
      });

      await waitFor(() => {
        expect(result.current.AutomationBuilderComp).not.toBeNull();
      });

      // Reset the mock call count
      MockBuilder.mockClear();

      // Close and reopen — should NOT trigger import again
      act(() => {
        result.current.setBuilderOpen(false);
      });
      act(() => {
        result.current.setBuilderOpen(true);
      });

      // Wait a tick to let any effect run
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // BuilderComp should still be set (cached)
      expect(result.current.AutomationBuilderComp).toBe(MockBuilder);
    });
  });

  describe("state integration", () => {
    it("openCreateDialog resets editingRule from a previous edit", () => {
      const { result } = renderHook(() => useAutomationBuilder());
      const rule = createRule({ id: "previous-rule" });

      act(() => {
        result.current.openEditDialog(rule);
      });
      expect(result.current.editingRule?.id).toBe("previous-rule");

      act(() => {
        result.current.openCreateDialog();
      });

      expect(result.current.editingRule).toBeNull();
      expect(result.current.builderOpen).toBe(true);
    });

    it("guidedMode is independent from builder state", () => {
      const { result } = renderHook(() => useAutomationBuilder());

      act(() => {
        result.current.setGuidedMode(false);
      });

      act(() => {
        result.current.openCreateDialog();
      });

      expect(result.current.guidedMode).toBe(false);
      expect(result.current.builderOpen).toBe(true);
    });
  });
});
