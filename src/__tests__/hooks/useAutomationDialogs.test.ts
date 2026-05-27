// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutomationDialogs } from "@/hooks/useAutomationDialogs";
import type { AutomationRule } from "@/types/automation";

function createRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: "rule-1",
    name: "Test Rule",
    description: "Test",
    category: "Generale",
    active: true,
    version: 1,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("useAutomationDialogs", () => {
  it("starts with all states at default values", () => {
    const { result } = renderHook(() => useAutomationDialogs());

    expect(result.current.confirmDeleteRule).toBeNull();
    expect(result.current.confirmArchiveRule).toBeNull();
    expect(result.current.confirmRunRule).toBeNull();
    expect(result.current.confirmRunLoading).toBe(false);
    expect(result.current.dryRunRule).toBeNull();
    expect(result.current.dryRunDialogOpen).toBe(false);
  });

  describe("delete dialog", () => {
    it("setConfirmDeleteRule sets the rule to confirm", () => {
      const { result } = renderHook(() => useAutomationDialogs());
      const rule = createRule({ id: "del-1" });

      act(() => result.current.setConfirmDeleteRule(rule));

      expect(result.current.confirmDeleteRule).toEqual(rule);
    });

    it("cancelDeleteRule clears the rule", () => {
      const { result } = renderHook(() => useAutomationDialogs());
      const rule = createRule({ id: "del-1" });

      act(() => result.current.setConfirmDeleteRule(rule));
      act(() => result.current.cancelDeleteRule());

      expect(result.current.confirmDeleteRule).toBeNull();
    });
  });

  describe("archive dialog", () => {
    it("setConfirmArchiveRule sets the rule to confirm", () => {
      const { result } = renderHook(() => useAutomationDialogs());
      const rule = createRule({ id: "arc-1" });

      act(() => result.current.setConfirmArchiveRule(rule));

      expect(result.current.confirmArchiveRule).toEqual(rule);
    });

    it("cancelArchiveRule clears the rule", () => {
      const { result } = renderHook(() => useAutomationDialogs());
      const rule = createRule({ id: "arc-1" });

      act(() => result.current.setConfirmArchiveRule(rule));
      act(() => result.current.cancelArchiveRule());

      expect(result.current.confirmArchiveRule).toBeNull();
    });
  });

  describe("run dialog", () => {
    it("setConfirmRunRule sets the rule to confirm", () => {
      const { result } = renderHook(() => useAutomationDialogs());
      const rule = createRule({ id: "run-1" });

      act(() => result.current.setConfirmRunRule(rule));

      expect(result.current.confirmRunRule).toEqual(rule);
    });

    it("cancelRunRule clears the rule", () => {
      const { result } = renderHook(() => useAutomationDialogs());
      const rule = createRule({ id: "run-1" });

      act(() => result.current.setConfirmRunRule(rule));
      act(() => result.current.cancelRunRule());

      expect(result.current.confirmRunRule).toBeNull();
    });

    it("setConfirmRunLoading toggles loading state", () => {
      const { result } = renderHook(() => useAutomationDialogs());

      expect(result.current.confirmRunLoading).toBe(false);

      act(() => result.current.setConfirmRunLoading(true));
      expect(result.current.confirmRunLoading).toBe(true);

      act(() => result.current.setConfirmRunLoading(false));
      expect(result.current.confirmRunLoading).toBe(false);
    });
  });

  describe("dry run dialog", () => {
    it("setDryRunRule sets the rule", () => {
      const { result } = renderHook(() => useAutomationDialogs());
      const rule = createRule({ id: "dry-1" });

      act(() => result.current.setDryRunRule(rule));

      expect(result.current.dryRunRule).toEqual(rule);
    });

    it("setDryRunDialogOpen controls dialog visibility", () => {
      const { result } = renderHook(() => useAutomationDialogs());

      expect(result.current.dryRunDialogOpen).toBe(false);

      act(() => result.current.setDryRunDialogOpen(true));
      expect(result.current.dryRunDialogOpen).toBe(true);

      act(() => result.current.setDryRunDialogOpen(false));
      expect(result.current.dryRunDialogOpen).toBe(false);
    });
  });

  describe("state isolation", () => {
    it("states do not interfere with each other", () => {
      const { result } = renderHook(() => useAutomationDialogs());
      const rule1 = createRule({ id: "r1" });
      const rule2 = createRule({ id: "r2" });

      act(() => {
        result.current.setConfirmDeleteRule(rule1);
        result.current.setConfirmArchiveRule(rule2);
        result.current.setConfirmRunRule(rule1);
      });

      expect(result.current.confirmDeleteRule?.id).toBe("r1");
      expect(result.current.confirmArchiveRule?.id).toBe("r2");
      expect(result.current.confirmRunRule?.id).toBe("r1");

      act(() => result.current.cancelDeleteRule());

      expect(result.current.confirmDeleteRule).toBeNull();
      expect(result.current.confirmArchiveRule?.id).toBe("r2"); // unaffected
      expect(result.current.confirmRunRule?.id).toBe("r1"); // unaffected
    });
  });
});
