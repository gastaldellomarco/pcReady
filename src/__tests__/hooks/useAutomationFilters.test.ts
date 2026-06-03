import { renderHook, act } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { useAutomationFilters } from "@/hooks/useAutomationFilters";
import {
  getRuleTriggerType,
  TRIGGER_TYPE_LABELS,
  TRIGGER_TYPE_OPTIONS,
} from "@/lib/automation-constants";
import type { AutomationRunStats } from "@/lib/automation-runs";
import type { AutomationRule } from "@/types/automation";

// ── Factory helpers ─────────────────────────────────────────────

function createRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: "rule-1",
    name: "Default Rule",
    description: "Default description",
    category: "Generale",
    active: true,
    version: 2,
    updated_at: "2026-06-01T00:00:00.000Z",
    summary: "Default summary",
    last_run_at: "2026-06-01T10:00:00.000Z",
    flow_definition: { meta: {} },
    ...overrides,
  };
}

function createStats(overrides: Partial<AutomationRunStats> = {}): AutomationRunStats {
  return {
    automation_id: "rule-1",
    success: 10,
    error: 2,
    dry_run: 1,
    skipped: 0,
    health: "healthy",
    recent: [],
    ...overrides,
  };
}

const emptyStats: Record<string, AutomationRunStats> = {};

// ── Tests ────────────────────────────────────────────────────────

describe("useAutomationFilters", () => {
  describe("default state", () => {
    it("returns all rules when no filters are active", () => {
      const rules = [createRule({ id: "1", name: "A" }), createRule({ id: "2", name: "B" })];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      expect(result.current.filteredRules).toHaveLength(2);
      expect(result.current.categoryFilter).toBeNull();
      expect(result.current.searchQuery).toBe("");
      expect(result.current.errorFilter).toBe("all");
      expect(result.current.sortBy).toBe("created");
      expect(result.current.sortOrder).toBe("desc");
    });

    it("returns empty array when no rules", () => {
      const { result } = renderHook(() => useAutomationFilters([], emptyStats));
      expect(result.current.filteredRules).toHaveLength(0);
    });
  });

  describe("category filter", () => {
    it("filters rules by exact category", () => {
      const rules = [
        createRule({ id: "1", name: "Notifica", category: "Notifica" }),
        createRule({ id: "2", name: "Stato", category: "Stato" }),
      ];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setCategoryFilter("Notifica"));

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("1");
    });

    it("shows all rules when category filter is null", () => {
      const rules = [
        createRule({ id: "1", category: "Notifica" }),
        createRule({ id: "2", category: "Stato" }),
      ];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setCategoryFilter("Notifica"));
      act(() => result.current.setCategoryFilter(null));

      expect(result.current.filteredRules).toHaveLength(2);
    });

    it("shows no rules for non-existent category", () => {
      const rules = [createRule({ id: "1", category: "Notifica" })];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setCategoryFilter("Schedulazione"));

      expect(result.current.filteredRules).toHaveLength(0);
    });
  });

  describe("search query", () => {
    it("filters by name (case insensitive)", () => {
      const rules = [
        createRule({ id: "1", name: "Welcome Email" }),
        createRule({ id: "2", name: "Status Update" }),
      ];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setSearchQuery("welcome"));

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("1");
    });

    it("filters by summary (case insensitive)", () => {
      const rules = [
        createRule({ id: "1", name: "A", summary: "Sends welcome email" }),
        createRule({ id: "2", name: "B", summary: "Updates ticket status" }),
      ];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setSearchQuery("TICKET"));

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("2");
    });

    it("shows empty when search matches nothing", () => {
      const rules = [createRule({ id: "1", name: "Email Rule" })];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setSearchQuery("zzzzz"));

      expect(result.current.filteredRules).toHaveLength(0);
    });

    it("clearing search shows all rules", () => {
      const rules = [createRule({ id: "1", name: "A" }), createRule({ id: "2", name: "B" })];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setSearchQuery("A"));
      act(() => result.current.setSearchQuery(""));

      expect(result.current.filteredRules).toHaveLength(2);
    });
  });

  describe("trigger type filter", () => {
    it("filters by trigger type from wizard meta", () => {
      const rules = [
        createRule({
          id: "1",
          name: "Ticket Created",
          flow_definition: {
            meta: { wizard: { trigger_definition: { type: "ticket_created" } } },
          },
        }),
        createRule({
          id: "2",
          name: "Manual",
          flow_definition: { meta: { wizard: { trigger_definition: { type: "manual" } } } },
        }),
      ];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setTriggerTypeFilter("ticket_created"));

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("1");
    });

    it("defaults to manual when no wizard data", () => {
      const rules = [createRule({ id: "1", flow_definition: undefined })];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setTriggerTypeFilter("manual"));

      expect(result.current.filteredRules).toHaveLength(1);
    });

    it("empty trigger filter shows all", () => {
      const rules = [
        createRule({ id: "1", flow_definition: { meta: { wizard: { trigger_definition: { type: "ticket_created" } } } } }),
        createRule({ id: "2", flow_definition: { meta: { wizard: { trigger_definition: { type: "manual" } } } } }),
      ];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      expect(result.current.filteredRules).toHaveLength(2);
    });
  });

  describe("error filter", () => {
    const rules = [
      createRule({ id: "1", name: "Active", active: true }),
      createRule({ id: "2", name: "Inactive", active: false }),
    ];
    const statsWithErrors: Record<string, AutomationRunStats> = {
      "1": createStats({ health: "failing", error: 5 }),
      "2": createStats({ health: "healthy", error: 0 }),
    };

    it('"errors" shows only rules with failing health', () => {
      const { result } = renderHook(() => useAutomationFilters(rules, statsWithErrors));

      act(() => result.current.setErrorFilter("errors"));

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("1");
    });

    it('"errors" excludes never_run rules', () => {
      const neverRun = createRule({ id: "3", name: "Never Run" });
      const stats: Record<string, AutomationRunStats> = {
        ...statsWithErrors,
        "3": createStats({ automation_id: "3", health: "never_run" }),
      };
      const { result } = renderHook(() => useAutomationFilters([...rules, neverRun], stats));

      act(() => result.current.setErrorFilter("errors"));

      expect(result.current.filteredRules).toHaveLength(1);
    });

    it('"active" shows only active rules', () => {
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setErrorFilter("active"));

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("1");
    });

    it('"inactive" shows only inactive rules', () => {
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setErrorFilter("inactive"));

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("2");
    });

    it('"all" shows every rule', () => {
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      expect(result.current.filteredRules).toHaveLength(2);
    });
  });

  describe("sorting", () => {
    const rules = [
      createRule({ id: "1", name: "B Rule", updated_at: "2026-01-01T00:00:00.000Z", last_run_at: null }),
      createRule({ id: "2", name: "A Rule", updated_at: "2026-06-01T00:00:00.000Z", last_run_at: "2026-06-01T00:00:00.000Z" }),
    ];
    const stats: Record<string, AutomationRunStats> = {
      "1": createStats({ automation_id: "1", success: 5 }),
      "2": createStats({ automation_id: "2", success: 20 }),
    };

    it("sorts by name ascending", () => {
      const { result } = renderHook(() => useAutomationFilters(rules, stats));

      act(() => {
        result.current.setSortBy("name");
        result.current.setSortOrder("asc");
      });

      expect(result.current.filteredRules[0].id).toBe("2"); // A Rule first
      expect(result.current.filteredRules[1].id).toBe("1"); // B Rule second
    });

    it("sorts by name descending", () => {
      const { result } = renderHook(() => useAutomationFilters(rules, stats));

      act(() => {
        result.current.setSortBy("name");
        result.current.setSortOrder("desc");
      });

      expect(result.current.filteredRules[0].id).toBe("1"); // B Rule first
    });

    it("sorts by last_run (null last yields 0)", () => {
      const { result } = renderHook(() => useAutomationFilters(rules, stats));

      act(() => {
        result.current.setSortBy("last_run");
        result.current.setSortOrder("asc");
      });

      // Rule 1 has null last_run_at, so 0 timestamp → comes first in asc
      expect(result.current.filteredRules[0].id).toBe("1");
    });

    it("sorts by executions using runStats success count", () => {
      const { result } = renderHook(() => useAutomationFilters(rules, stats));

      act(() => {
        result.current.setSortBy("executions");
        result.current.setSortOrder("desc");
      });

      expect(result.current.filteredRules[0].id).toBe("2"); // 20 executions
      expect(result.current.filteredRules[1].id).toBe("1"); // 5 executions
    });

    it("sorts by created (updated_at as proxy) descending by default", () => {
      const { result } = renderHook(() => useAutomationFilters(rules, stats));

      // Default: sortBy="created", sortOrder="desc"
      expect(result.current.filteredRules[0].id).toBe("2"); // newer
      expect(result.current.filteredRules[1].id).toBe("1"); // older
    });
  });

  describe("combined filters", () => {
    it("applies category + search simultaneously", () => {
      const rules = [
        createRule({ id: "1", name: "Welcome Email", category: "Notifica" }),
        createRule({ id: "2", name: "Status Email", category: "Notifica" }),
        createRule({ id: "3", name: "Ticket Close", category: "Stato" }),
      ];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => {
        result.current.setCategoryFilter("Notifica");
        result.current.setSearchQuery("Welcome");
      });

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("1");
    });

    it("applies trigger + error + sort simultaneously", () => {
      const rules = [
        createRule({
          id: "1", name: "A", active: true,
          flow_definition: { meta: { wizard: { trigger_definition: { type: "ticket_created" } } } },
        }),
        createRule({
          id: "2", name: "B", active: false,
          flow_definition: { meta: { wizard: { trigger_definition: { type: "manual" } } } },
        }),
        createRule({
          id: "3", name: "C", active: true,
          flow_definition: { meta: { wizard: { trigger_definition: { type: "ticket_created" } } } },
        }),
      ];
      const stats: Record<string, AutomationRunStats> = {
        "1": createStats({ health: "healthy" }),
        "3": createStats({ health: "failing", error: 3 }),
      };
      const { result } = renderHook(() => useAutomationFilters(rules, stats));

      act(() => {
        result.current.setTriggerTypeFilter("ticket_created");
        result.current.setErrorFilter("errors");
      });

      // Only rule 3 matches: ticket_created trigger + failing health
      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("3");
    });
  });

  describe("status filter (lifecycle)", () => {
    it("filters by 'active' status", () => {
      const rules = [
        createRule({ id: "1", active: true }),
        createRule({ id: "2", active: false, version: 1 }),
      ];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setStatusFilter("active"));

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("1");
    });

    it("filters by 'draft' status (version 1, not active)", () => {
      const rules = [
        createRule({ id: "1", active: false, version: 1 }),
        createRule({ id: "2", active: true }),
      ];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setStatusFilter("draft"));

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("1");
    });

    it("filters by 'archived' status via flow_definition meta", () => {
      const rules = [
        createRule({ id: "1", flow_definition: { meta: { archived: true } } }),
        createRule({ id: "2" }),
      ];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setStatusFilter("archived"));

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("1");
    });

    it("filters by 'paused' status via flow_definition meta", () => {
      const rules = [
        createRule({ id: "1", flow_definition: { meta: { paused: true } } }),
        createRule({ id: "2" }),
      ];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setStatusFilter("paused"));

      expect(result.current.filteredRules).toHaveLength(1);
      expect(result.current.filteredRules[0].id).toBe("1");
    });

    it("returns empty when no rules match status", () => {
      const rules = [createRule({ id: "1", active: true })];
      const { result } = renderHook(() => useAutomationFilters(rules, emptyStats));

      act(() => result.current.setStatusFilter("archived"));

      expect(result.current.filteredRules).toHaveLength(0);
    });
  });

  describe("getRuleTriggerType utility", () => {
    it("extracts trigger type from wizard meta", () => {
      const rule = createRule({
        flow_definition: { meta: { wizard: { trigger_definition: { type: "scheduled" } } } },
      });
      expect(getRuleTriggerType(rule)).toBe("scheduled");
    });

    it("returns manual when no wizard data", () => {
      expect(getRuleTriggerType(createRule({ flow_definition: undefined }))).toBe("manual");
    });

    it("returns manual when trigger_definition is empty", () => {
      const rule = createRule({
        flow_definition: { meta: { wizard: { trigger_definition: { type: "manual", config: {} } } } },
      } as AutomationRule);
      expect(getRuleTriggerType(rule)).toBe("manual");
    });
  });

  describe("TRIGGER_TYPE_OPTIONS", () => {
    it("has all trigger types", () => {
      const values = TRIGGER_TYPE_OPTIONS.map((o) => o.value);
      expect(values).toContain("");
      expect(values).toContain("ticket_created");
      expect(values).toContain("manual");
      expect(values).toContain("scheduled");
      expect(values).toContain("sla_breached");
    });

    it("first option is empty with 'Tutti i trigger' label", () => {
      expect(TRIGGER_TYPE_OPTIONS[0]).toEqual({ value: "", label: "Tutti i trigger" });
    });
  });

  describe("TRIGGER_TYPE_LABELS", () => {
    it("has labels for all common trigger types", () => {
      expect(TRIGGER_TYPE_LABELS.ticket_created).toBe("Ticket creato");
      expect(TRIGGER_TYPE_LABELS.manual).toBe("Manuale");
      expect(TRIGGER_TYPE_LABELS.scheduled).toBe("Schedulato");
      expect(TRIGGER_TYPE_LABELS.sla_breached).toBe("SLA violato");
    });
  });
});
