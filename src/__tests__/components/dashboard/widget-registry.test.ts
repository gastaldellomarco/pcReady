// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  createDefaultLayoutForRole,
  DASHBOARD_WIDGETS,
  type WidgetId,
  type DashboardLayout,
} from "@/components/dashboard/widget-registry";

// ── Helpers ──────────────────────────────────────────────────────────────

const ALL_WIDGET_IDS: ReadonlySet<WidgetId> = new Set(DASHBOARD_WIDGETS.map((w) => w.id));

/** Returns the set of visible widget IDs from a layout. */
function visibleIds(layout: DashboardLayout): Set<WidgetId> {
  return new Set(layout.widgets.filter((w) => w.visible).map((w) => w.id));
}

/** Returns the set of hidden widget IDs from a layout. */
function hiddenIds(layout: DashboardLayout): Set<WidgetId> {
  return new Set(layout.widgets.filter((w) => !w.visible).map((w) => w.id));
}

// ── Role expectations ────────────────────────────────────────────────────

const ADMIN_VISIBLE = ALL_WIDGET_IDS; // admin sees everything

const TECH_VISIBLE: ReadonlySet<WidgetId> = new Set([
  "stat-cards",
  "analytics-card",
  "devices-without-ticket",
  "recent-tickets",
  "status-distribution",
  "technician-heatmap",
  "recent-activity",
  "overdue-tickets",
  "team-activity",
  "technician-stats",
  "warranty-overview",
  "maintenance-overview",
  "kanban-wip-limits",
]);

const TECH_HIDDEN: ReadonlySet<WidgetId> = new Set([
  "tickets-without-device",
  "trend-chart",
  "critical-events",
]);

const VIEWER_VISIBLE: ReadonlySet<WidgetId> = new Set([
  "stat-cards",
  "analytics-card",
  "trend-chart",
  "recent-tickets",
  "status-distribution",
  "warranty-overview",
]);

const VIEWER_HIDDEN: ReadonlySet<WidgetId> = new Set([
  "devices-without-ticket",
  "tickets-without-device",
  "technician-heatmap",
  "recent-activity",
  "overdue-tickets",
  "team-activity",
  "technician-stats",
  "critical-events",
  "maintenance-overview",
  "kanban-wip-limits",
]);

// ── Tests ────────────────────────────────────────────────────────────────

describe("createDefaultLayoutForRole", () => {
  // ── Admin ────────────────────────────────────────────────────────

  describe("admin role", () => {
    it("returns a layout with all 16 widgets visible", () => {
      const layout = createDefaultLayoutForRole("admin");

      expect(layout.widgets).toHaveLength(16);
      expect(visibleIds(layout)).toEqual(ADMIN_VISIBLE);
      expect(hiddenIds(layout)).toEqual(new Set());
    });

    it("assigns sequential order values 0–15", () => {
      const layout = createDefaultLayoutForRole("admin");

      layout.widgets.forEach((w, i) => {
        expect(w.order).toBe(i);
      });
    });

    it("includes every registered widget ID", () => {
      const layout = createDefaultLayoutForRole("admin");

      const ids = new Set(layout.widgets.map((w) => w.id));
      expect(ids).toEqual(ALL_WIDGET_IDS);
    });

    it("every widget has correct shape (id, order, visible)", () => {
      const layout = createDefaultLayoutForRole("admin");

      layout.widgets.forEach((w) => {
        expect(w).toHaveProperty("id");
        expect(w).toHaveProperty("order");
        expect(w).toHaveProperty("visible");
        expect(typeof w.id).toBe("string");
        expect(typeof w.order).toBe("number");
        expect(typeof w.visible).toBe("boolean");
      });
    });
  });

  // ── Tech ─────────────────────────────────────────────────────────

  describe("tech role", () => {
    it("returns a layout with all 16 widgets (13 visible, 3 hidden)", () => {
      const layout = createDefaultLayoutForRole("tech");

      expect(layout.widgets).toHaveLength(16);
      expect(visibleIds(layout)).toEqual(TECH_VISIBLE);
      expect(hiddenIds(layout)).toEqual(TECH_HIDDEN);
    });

    it("includes kanban-wip-limits as visible", () => {
      const layout = createDefaultLayoutForRole("tech");

      const wipWidget = layout.widgets.find((w) => w.id === "kanban-wip-limits");
      expect(wipWidget).toBeDefined();
      expect(wipWidget!.visible).toBe(true);
    });

    it("hides tickets-without-device, trend-chart, and critical-events", () => {
      const layout = createDefaultLayoutForRole("tech");

      expect(layout.widgets.find((w) => w.id === "tickets-without-device")!.visible).toBe(false);
      expect(layout.widgets.find((w) => w.id === "trend-chart")!.visible).toBe(false);
      expect(layout.widgets.find((w) => w.id === "critical-events")!.visible).toBe(false);
    });

    it("assigns sequential order values 0–15", () => {
      const layout = createDefaultLayoutForRole("tech");

      layout.widgets.forEach((w, i) => {
        expect(w.order).toBe(i);
      });
    });
  });

  // ── Viewer ───────────────────────────────────────────────────────

  describe("viewer role", () => {
    it("returns a layout with all 16 widgets (6 visible, 10 hidden)", () => {
      const layout = createDefaultLayoutForRole("viewer");

      expect(layout.widgets).toHaveLength(16);
      expect(visibleIds(layout)).toEqual(VIEWER_VISIBLE);
      expect(hiddenIds(layout)).toEqual(VIEWER_HIDDEN);
    });

    it("shows only overview widgets: stat-cards, analytics-card, trend-chart, recent-tickets, status-distribution, warranty-overview", () => {
      const layout = createDefaultLayoutForRole("viewer");

      const ids = visibleIds(layout);
      expect(ids.has("stat-cards")).toBe(true);
      expect(ids.has("analytics-card")).toBe(true);
      expect(ids.has("trend-chart")).toBe(true);
      expect(ids.has("recent-tickets")).toBe(true);
      expect(ids.has("status-distribution")).toBe(true);
      expect(ids.has("warranty-overview")).toBe(true);
    });

    it("hides operational and sensitive widgets (heatmap, team, stats, kanban-wip, etc.)", () => {
      const layout = createDefaultLayoutForRole("viewer");

      const hidden = hiddenIds(layout);
      expect(hidden.has("technician-heatmap")).toBe(true);
      expect(hidden.has("team-activity")).toBe(true);
      expect(hidden.has("technician-stats")).toBe(true);
      expect(hidden.has("overdue-tickets")).toBe(true);
      expect(hidden.has("critical-events")).toBe(true);
      expect(hidden.has("maintenance-overview")).toBe(true);
      expect(hidden.has("kanban-wip-limits")).toBe(true);
    });

    it("assigns sequential order values 0–15", () => {
      const layout = createDefaultLayoutForRole("viewer");

      layout.widgets.forEach((w, i) => {
        expect(w.order).toBe(i);
      });
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("does not mutate the DASHBOARD_WIDGETS array", () => {
      const originalCount = DASHBOARD_WIDGETS.length;

      createDefaultLayoutForRole("admin");
      createDefaultLayoutForRole("tech");
      createDefaultLayoutForRole("viewer");

      expect(DASHBOARD_WIDGETS).toHaveLength(originalCount);
    });

    it("each layout returns a new object (immutable)", () => {
      const adminLayout = createDefaultLayoutForRole("admin");
      const techLayout = createDefaultLayoutForRole("tech");

      expect(adminLayout).not.toBe(techLayout);
      expect(adminLayout.widgets).not.toBe(techLayout.widgets);
    });

    it("visible widgets order matches DASHBOARD_WIDGETS order", () => {
      const layout = createDefaultLayoutForRole("admin");

      layout.widgets.forEach((w, i) => {
        expect(w.id).toBe(DASHBOARD_WIDGETS[i].id);
      });
    });
  });
});
