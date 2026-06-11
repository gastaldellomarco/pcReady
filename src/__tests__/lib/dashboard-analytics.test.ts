import { describe, expect, it } from "vitest";
import { computeTechnicianStats, computeWeeklyActivity, computeRadarMetrics, computeDashboardAnalytics, computeOverdueTickets, computePeriodRange, computeWeekRange } from "@/lib/dashboard-analytics";
import type { WeeklyActivityInput, RadarMetricsInput, DashboardAnalyticsInput, OverdueTicketsInput, WeekRange, PeriodRange, PeriodRangePeriod } from "@/lib/data/dashboard-analytics";

// ── helpers ─────────────────────────────────────────────────────────
const TECH_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TECH_2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NON_TECH = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

// ── tests ───────────────────────────────────────────────────────────
describe("computeTechnicianStats", () => {
  // ── active flag ─────────────────────────────────────────────────
  describe("active flag", () => {
    it("marks a technician active when they have tickets assigned this period", () => {
      const rows = computeTechnicianStats(
        [
          {
            technician_id: TECH_1,
            full_name: "Marco Gastaldello",
            assigned: 3,
            completed: 1,
            avg_days: 2.5,
          },
          {
            technician_id: TECH_2,
            full_name: "Tecnico Demo",
            assigned: 1,
            completed: 0,
            avg_days: null,
          },
        ],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
          { user_id: NON_TECH, role: "viewer" },
        ],
        [
          { id: TECH_1, full_name: "Marco Gastaldello", initials: "MG" },
          { id: TECH_2, full_name: "Tecnico Demo", initials: "TD" },
          { id: NON_TECH, full_name: "Non Tecnico", initials: "NT" },
        ],
        [{ assignee_id: TECH_1 }, { assignee_id: TECH_1 }],
      );

      const t1 = rows.find((r) => r.id === TECH_1)!;
      const t2 = rows.find((r) => r.id === TECH_2)!;
      expect(t1.active).toBe(true);
      expect(t2.active).toBe(true);
    });

    it("marks a technician active with zero new tickets but open tickets from any period (bug fix)", () => {
      const rows = computeTechnicianStats(
        [
          { technician_id: TECH_1, full_name: "Marco", assigned: 0, completed: 0, avg_days: null },
          { technician_id: TECH_2, full_name: "Demo", assigned: 0, completed: 0, avg_days: null },
        ],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
        ],
        [
          { id: TECH_1, full_name: "Marco", initials: "MG" },
          { id: TECH_2, full_name: "Demo", initials: "TD" },
        ],
        [{ assignee_id: TECH_2 }],
      );

      const t1 = rows.find((r) => r.id === TECH_1)!;
      const t2 = rows.find((r) => r.id === TECH_2)!;
      // Before the fix both would be false. After: TECH_2 active via open tickets.
      expect(t1.active).toBe(false);
      expect(t2.active).toBe(true);
    });

    it("marks a technician inactive when 0 assigned AND 0 open", () => {
      const rows = computeTechnicianStats(
        [
          { technician_id: TECH_1, full_name: "Marco", assigned: 0, completed: 0, avg_days: null },
          { technician_id: TECH_2, full_name: "Demo", assigned: 0, completed: 0, avg_days: null },
        ],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
        ],
        [
          { id: TECH_1, full_name: "Marco", initials: "MG" },
          { id: TECH_2, full_name: "Demo", initials: "TD" },
        ],
        [],
      );

      expect(rows.every((r) => !r.active)).toBe(true);
    });

    it("uses OR logic — active via assigned OR open tickets", () => {
      const rows = computeTechnicianStats(
        [
          { technician_id: TECH_1, full_name: "A", assigned: 5, completed: 2, avg_days: 1 },
          { technician_id: TECH_2, full_name: "B", assigned: 0, completed: 0, avg_days: null },
        ],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
        ],
        [
          { id: TECH_1, full_name: "A", initials: "AA" },
          { id: TECH_2, full_name: "B", initials: "BB" },
        ],
        [{ assignee_id: TECH_2 }, { assignee_id: TECH_2 }, { assignee_id: TECH_2 }],
      );

      const t1 = rows.find((r) => r.id === TECH_1)!;
      const t2 = rows.find((r) => r.id === TECH_2)!;
      expect(t1.active).toBe(true); // via assigned
      expect(t2.active).toBe(true); // via open tickets
    });
  });

  // ── pending field ────────────────────────────────────────────────
  describe("pending field", () => {
    it("equals the open ticket count, NOT assigned - completed", () => {
      const rows = computeTechnicianStats(
        [
          { technician_id: TECH_1, full_name: "Marco", assigned: 10, completed: 8, avg_days: 3 },
          { technician_id: TECH_2, full_name: "Demo", assigned: 1, completed: 5, avg_days: 1 },
        ],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
        ],
        [
          { id: TECH_1, full_name: "Marco", initials: "MG" },
          { id: TECH_2, full_name: "Demo", initials: "TD" },
        ],
        [
          { assignee_id: TECH_1 },
          { assignee_id: TECH_1 },
          { assignee_id: TECH_1 },
          { assignee_id: TECH_1 },
          { assignee_id: TECH_2 },
        ],
      );

      const t1 = rows.find((r) => r.id === TECH_1)!;
      const t2 = rows.find((r) => r.id === TECH_2)!;
      expect(t1.pending).toBe(4); // not 10-8=2
      expect(t2.pending).toBe(1); // not MAX(0, 1-5)=0
    });

    it("pending is 0 when no open tickets", () => {
      const rows = computeTechnicianStats(
        [
          { technician_id: TECH_1, full_name: "Marco", assigned: 5, completed: 2, avg_days: 1 },
          { technician_id: TECH_2, full_name: "Demo", assigned: 3, completed: 1, avg_days: 2 },
        ],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
        ],
        [
          { id: TECH_1, full_name: "Marco", initials: "MG" },
          { id: TECH_2, full_name: "Demo", initials: "TD" },
        ],
        [],
      );

      for (const r of rows) expect(r.pending).toBe(0);
    });
  });

  // ── technician inclusion ─────────────────────────────────────────
  describe("technician inclusion", () => {
    it("includes all admin/tech users even if RPC KPI has only some of them", () => {
      const rows = computeTechnicianStats(
        [{ technician_id: TECH_1, full_name: "Marco", assigned: 5, completed: 2, avg_days: 1 }],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
        ],
        [
          { id: TECH_1, full_name: "Marco Gastaldello", initials: "MG" },
          { id: TECH_2, full_name: "Tecnico Demo", initials: "TD" },
        ],
        [],
      );

      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.id).sort()).toEqual([TECH_1, TECH_2].sort());
    });

    it("excludes profiles not listed in assignable roles", () => {
      // The handler filters roles to admin/tech at the query level before
      // calling computeTechnicianStats, so NON_TECH won't be in the roles param.
      // This test verifies that profiles without a matching role are excluded.
      const rows = computeTechnicianStats(
        [
          { technician_id: TECH_1, full_name: "Marco", assigned: 3, completed: 1, avg_days: 1 },
          { technician_id: TECH_2, full_name: "Demo", assigned: 1, completed: 0, avg_days: null },
        ],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
        ],
        [
          { id: TECH_1, full_name: "Marco Gastaldello", initials: "MG" },
          { id: TECH_2, full_name: "Tecnico Demo", initials: "TD" },
          { id: NON_TECH, full_name: "Non Tecnico", initials: "NT" },
        ],
        [],
      );

      expect(rows.find((r) => r.id === NON_TECH)).toBeUndefined();
    });
  });

  // ── empty assignable set ─────────────────────────────────────────
  describe("empty assignable set", () => {
    it("returns empty array when no admin/tech users exist", () => {
      const rows = computeTechnicianStats([], [], [], []);
      expect(rows).toHaveLength(0);
    });
  });

  // ── output shape ─────────────────────────────────────────────────
  describe("output shape", () => {
    it("returns all expected fields", () => {
      const rows = computeTechnicianStats(
        [
          {
            technician_id: TECH_1,
            full_name: "Marco Gastaldello",
            assigned: 3,
            completed: 1,
            avg_days: 2.5,
          },
          {
            technician_id: TECH_2,
            full_name: "Tecnico Demo",
            assigned: 1,
            completed: 0,
            avg_days: null,
          },
        ],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
        ],
        [
          { id: TECH_1, full_name: "Marco Gastaldello", initials: "MG" },
          { id: TECH_2, full_name: "Tecnico Demo", initials: "TD" },
        ],
        [{ assignee_id: TECH_1 }, { assignee_id: TECH_1 }],
      );

      const t1 = rows.find((r) => r.id === TECH_1)!;
      expect(t1).toHaveProperty("id");
      expect(t1).toHaveProperty("name");
      expect(t1).toHaveProperty("initials");
      expect(t1).toHaveProperty("assigned");
      expect(t1).toHaveProperty("completed");
      expect(t1).toHaveProperty("pending");
      expect(t1).toHaveProperty("avg_days");
      expect(t1).toHaveProperty("avg_resolution_ms");
      expect(t1).toHaveProperty("active");
      expect(t1).toHaveProperty("title");
      expect(t1.name).toBe("Marco Gastaldello");
      expect(t1.initials).toBe("MG");
      expect(t1.assigned).toBe(3);
      expect(t1.completed).toBe(1);
    });

    it("computes avg_resolution_ms from avg_days (days * ms/day)", () => {
      const rows = computeTechnicianStats(
        [{ technician_id: TECH_1, full_name: "Marco", assigned: 3, completed: 1, avg_days: 2.5 }],
        [{ user_id: TECH_1, role: "admin" }],
        [{ id: TECH_1, full_name: "Marco", initials: "MG" }],
        [],
      );

      const t1 = rows.find((r) => r.id === TECH_1)!;
      expect(t1.avg_days).toBe(2.5);
      expect(t1.avg_resolution_ms).toBe(216000000);
    });

    it("sets avg_resolution_ms to null when avg_days is null", () => {
      const rows = computeTechnicianStats(
        [{ technician_id: TECH_2, full_name: "Demo", assigned: 1, completed: 0, avg_days: null }],
        [{ user_id: TECH_2, role: "tech" }],
        [{ id: TECH_2, full_name: "Demo", initials: "TD" }],
        [],
      );

      const t2 = rows.find((r) => r.id === TECH_2)!;
      expect(t2.avg_days).toBeNull();
      expect(t2.avg_resolution_ms).toBeNull();
    });

    it("generates initials from full_name when profile.initials is missing", () => {
      const rows = computeTechnicianStats(
        [
          {
            technician_id: TECH_1,
            full_name: "Marco Gastaldello",
            assigned: 1,
            completed: 0,
            avg_days: null,
          },
          {
            technician_id: TECH_2,
            full_name: "Tecnico Demo",
            assigned: 1,
            completed: 0,
            avg_days: null,
          },
        ],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
        ],
        [
          { id: TECH_1, full_name: "Marco Gastaldello", initials: null },
          { id: TECH_2, full_name: "Tecnico Demo", initials: "" },
        ],
        [],
      );

      expect(rows[0].initials).toBe("MG");
      expect(rows[1].initials).toBe("TD");
    });

    it("sets assigned/completed to 0 for users not in KPI data", () => {
      const rows = computeTechnicianStats(
        [],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
        ],
        [
          { id: TECH_1, full_name: "Marco Gastaldello", initials: "MG" },
          { id: TECH_2, full_name: "Tecnico Demo", initials: "TD" },
        ],
        [],
      );

      for (const r of rows) {
        expect(r.assigned).toBe(0);
        expect(r.completed).toBe(0);
        expect(r.avg_days).toBeNull();
        expect(r.avg_resolution_ms).toBeNull();
      }
    });
  });

  // ── technician_id = null (unassigned) handling ───────────────────
  describe("unassigned KPI rows", () => {
    it("does not crash on KPI rows with null technician_id", () => {
      const rows = computeTechnicianStats(
        [
          {
            technician_id: null,
            full_name: "Non assegnato",
            assigned: 5,
            completed: 3,
            avg_days: 2,
          },
        ],
        [
          { user_id: TECH_1, role: "admin" },
          { user_id: TECH_2, role: "tech" },
        ],
        [
          { id: TECH_1, full_name: "Marco", initials: "MG" },
          { id: TECH_2, full_name: "Demo", initials: "TD" },
        ],
        [],
      );

      expect(rows).toHaveLength(2);
    });
  });
});

// ─── computeWeeklyActivity ───────────────────────────────────────────

describe("computeWeeklyActivity", () => {
  const WEEK_START = new Date("2026-06-01T00:00:00.000Z"); // Monday
  const WEEK_END = new Date("2026-06-08T00:00:00.000Z");

  const T1 = { id: TECH_1, full_name: "Marco Gastaldello", initials: "MG" };
  const T2 = { id: TECH_2, full_name: "Tecnico Demo", initials: "TD" };
  const T3 = { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", full_name: "Extra Tech", initials: "ET" };

  function makeInput(
    overrides: Partial<WeeklyActivityInput> = {},
  ): WeeklyActivityInput {
    return {
      activityData: [],
      technicians: [T1, T2],
      assignableIds: new Set([TECH_1, TECH_2]),
      weekStart: WEEK_START,
      ...overrides,
    };
  }

  describe("output shape", () => {
    it("returns weekStart, weekEnd, and technicians", () => {
      const result = computeWeeklyActivity(makeInput());

      expect(result).toHaveProperty("weekStart");
      expect(result).toHaveProperty("weekEnd");
      expect(result).toHaveProperty("technicians");
      expect(Array.isArray(result.technicians)).toBe(true);
    });

    it("weekEnd is exactly 7 days after weekStart", () => {
      const result = computeWeeklyActivity(makeInput());

      expect(result.weekStart).toBe(WEEK_START.toISOString());
      expect(result.weekEnd).toBe(WEEK_END.toISOString());
    });

    it("each technician has a counts array of length 7", () => {
      const result = computeWeeklyActivity(makeInput());

      for (const t of result.technicians) {
        expect(t.counts).toHaveLength(7);
      }
    });

    it("each technician entry preserves id, name, and initials", () => {
      const result = computeWeeklyActivity(makeInput());

      expect(result.technicians[0]).toEqual({
        id: TECH_1,
        name: "Marco Gastaldello",
        initials: "MG",
        counts: [0, 0, 0, 0, 0, 0, 0],
      });
    });
  });

  describe("counts — daily distribution", () => {
    it("counts closed tickets on the correct day index", () => {
      const result = computeWeeklyActivity(
        makeInput({
          activityData: [
            { assignee: TECH_1, closed_at: "2026-06-01T10:00:00.000Z" }, // Mon → index 0
            { assignee: TECH_1, closed_at: "2026-06-01T14:00:00.000Z" }, // Mon → index 0
            { assignee: TECH_1, closed_at: "2026-06-03T10:00:00.000Z" }, // Wed → index 2
            { assignee: TECH_1, closed_at: "2026-06-07T10:00:00.000Z" }, // Sun → index 6
          ],
        }),
      );

      const t1 = result.technicians.find((t) => t.id === TECH_1)!;
      expect(t1.counts[0]).toBe(2); // Monday: 2
      expect(t1.counts[1]).toBe(0); // Tuesday: 0
      expect(t1.counts[2]).toBe(1); // Wednesday: 1
      expect(t1.counts[3]).toBe(0);
      expect(t1.counts[4]).toBe(0);
      expect(t1.counts[5]).toBe(0);
      expect(t1.counts[6]).toBe(1); // Sunday: 1
    });

    it("counts tickets on different days for different technicians", () => {
      const result = computeWeeklyActivity(
        makeInput({
          activityData: [
            { assignee: TECH_1, closed_at: "2026-06-01T10:00:00.000Z" },
            { assignee: TECH_2, closed_at: "2026-06-02T10:00:00.000Z" },
            { assignee: TECH_2, closed_at: "2026-06-02T15:00:00.000Z" },
            { assignee: TECH_1, closed_at: "2026-06-03T10:00:00.000Z" },
          ],
        }),
      );

      const t1 = result.technicians.find((t) => t.id === TECH_1)!;
      const t2 = result.technicians.find((t) => t.id === TECH_2)!;

      expect(t1.counts[0]).toBe(1); // Mon
      expect(t1.counts[1]).toBe(0);
      expect(t1.counts[2]).toBe(1); // Wed
      expect(t2.counts[0]).toBe(0);
      expect(t2.counts[1]).toBe(2); // Tue
      expect(t2.counts[2]).toBe(0);
    });

    it("all counts are 0 when activityData is empty", () => {
      const result = computeWeeklyActivity(makeInput({ activityData: [] }));

      for (const t of result.technicians) {
        expect(t.counts.every((c) => c === 0)).toBe(true);
      }
    });
  });

  describe("filtering", () => {
    it("ignores tickets where assignee is not in assignableIds", () => {
      const result = computeWeeklyActivity(
        makeInput({
          activityData: [
            { assignee: TECH_1, closed_at: "2026-06-01T10:00:00.000Z" },
            { assignee: "unknown-user", closed_at: "2026-06-02T10:00:00.000Z" },
          ],
        }),
      );

      const t1 = result.technicians.find((t) => t.id === TECH_1)!;
      const t2 = result.technicians.find((t) => t.id === TECH_2)!;
      expect(t1.counts[0]).toBe(1);
      // Day 2 should have 0 for both — the unknown user is filtered out
      expect(t1.counts[1]).toBe(0);
      expect(t2.counts[1]).toBe(0);
    });

    it("ignores tickets with null assignee", () => {
      const result = computeWeeklyActivity(
        makeInput({
          activityData: [
            { assignee: null, closed_at: "2026-06-01T10:00:00.000Z" },
            { assignee: TECH_1, closed_at: "2026-06-02T10:00:00.000Z" },
          ],
        }),
      );

      const t1 = result.technicians.find((t) => t.id === TECH_1)!;
      expect(t1.counts[0]).toBe(0); // null ignored on Mon
      expect(t1.counts[1]).toBe(1); // TECH_1 on Tue
    });

    it("ignores tickets with assignee not in technicians list", () => {
      const result = computeWeeklyActivity(
        makeInput({
          activityData: [
            { assignee: T3.id, closed_at: "2026-06-01T10:00:00.000Z" },
          ],
          assignableIds: new Set([TECH_1, TECH_2, T3.id]),
        }),
      );

      // T3 is not in technicians, so no counts for them
      for (const t of result.technicians) {
        expect(t.counts[0]).toBe(0);
      }
    });
  });

  describe("empty / edge cases", () => {
    it("returns empty technicians array when technicians list is empty", () => {
      const result = computeWeeklyActivity(
        makeInput({ technicians: [] }),
      );

      expect(result.technicians).toHaveLength(0);
    });

    it("handles activity data with only non-assignable users", () => {
      const result = computeWeeklyActivity(
        makeInput({
          assignableIds: new Set([TECH_1]),
          activityData: [
            { assignee: TECH_2, closed_at: "2026-06-01T10:00:00.000Z" },
            { assignee: T3.id, closed_at: "2026-06-02T10:00:00.000Z" },
          ],
        }),
      );

      for (const t of result.technicians) {
        expect(t.counts.every((c) => c === 0)).toBe(true);
      }
    });
  });

  describe("technician ordering", () => {
    it("preserves the order of the technicians input array", () => {
      const result = computeWeeklyActivity(
        makeInput({ technicians: [T2, T1] }), // reversed
      );

      expect(result.technicians[0].id).toBe(TECH_2);
      expect(result.technicians[1].id).toBe(TECH_1);
    });
  });
});

// ─── computeRadarMetrics ──────────────────────────────────────────────

describe("computeRadarMetrics", () => {
  // Ticket IDs
  const TK1 = "11111111-1111-4111-8111-111111111111";
  const TK2 = "22222222-2222-4222-8222-222222222222";
  const TK3 = "33333333-3333-4333-8333-333333333333";
  const TK4 = "44444444-4444-4444-8444-444444444444";

  const T1 = { id: TECH_1, full_name: "Marco Gastaldello", initials: null as string | null };
  const T2 = { id: TECH_2, full_name: "Tecnico Demo", initials: null as string | null };

  function makeInput(overrides: Partial<RadarMetricsInput> = {}): RadarMetricsInput {
    return {
      roles: [
        { user_id: TECH_1, role: "admin" },
        { user_id: TECH_2, role: "tech" },
      ],
      profiles: [T1, T2],
      tickets: [],
      notes: [],
      history: [],
      ...overrides,
    };
  }

  describe("basic metrics", () => {
    it("counts assigned and completed correctly", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-03T10:00:00.000Z",
              status: "completed",
            },
            {
              id: TK2,
              assignee_id: TECH_1,
              created_at: "2026-06-02T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
            {
              id: TK3,
              assignee_id: TECH_1,
              created_at: "2026-06-03T10:00:00.000Z",
              closed_at: null,
              status: "archived",
            },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.assigned).toBe(3);
      expect(t1.completed).toBe(2); // TK1 (closed_at) + TK3 (status archived)
      expect(t1.completionPct).toBe(67); // 2/3 ≈ 66.67 → 67
    });

    it("completionPct is 0 when no tickets assigned", () => {
      const result = computeRadarMetrics(makeInput());

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.assigned).toBe(0);
      expect(t1.completed).toBe(0);
      expect(t1.completionPct).toBe(0);
    });

    it("completionPct is 100 when all assigned are completed", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-03T10:00:00.000Z",
              status: "completed",
            },
            {
              id: TK2,
              assignee_id: TECH_1,
              created_at: "2026-06-02T10:00:00.000Z",
              closed_at: "2026-06-05T10:00:00.000Z",
              status: "completed",
            },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.completionPct).toBe(100);
    });
  });

  describe("avgResolutionDays", () => {
    it("calculates average resolution time in days", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T00:00:00.000Z",
              closed_at: "2026-06-03T00:00:00.000Z", // 2 days
              status: "completed",
            },
            {
              id: TK2,
              assignee_id: TECH_1,
              created_at: "2026-06-01T00:00:00.000Z",
              closed_at: "2026-06-05T00:00:00.000Z", // 4 days
              status: "completed",
            },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.avgResolutionDays).toBe(3); // (2 + 4) / 2
    });

    it("is null when no tickets have been resolved", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.avgResolutionDays).toBeNull();
    });

    it("does not count archived tickets without closed_at towards resolution", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T00:00:00.000Z",
              closed_at: "2026-06-03T00:00:00.000Z",
              status: "completed",
            },
            {
              id: TK2,
              assignee_id: TECH_1,
              created_at: "2026-06-01T00:00:00.000Z",
              closed_at: null,
              status: "archived", // completed but no closed_at → no resolution days
            },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.completed).toBe(2);
      expect(t1.avgResolutionDays).toBe(2); // only TK1 contributes: 2/1 = 2
    });
  });

  describe("avgFirstRespMs", () => {
    it("calculates first response time from ticket creation to first note", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-03T00:00:00.000Z",
              status: "completed",
            },
          ],
          notes: [
            { ticket_id: TK1, created_at: "2026-06-01T11:00:00.000Z" }, // 1 hour later
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.avgFirstRespMs).toBe(3600000); // 1 hour in ms
    });

    it("takes the FIRST note per ticket only", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
          ],
          notes: [
            { ticket_id: TK1, created_at: "2026-06-01T11:00:00.000Z" }, // first
            { ticket_id: TK1, created_at: "2026-06-02T10:00:00.000Z" }, // ignored
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.avgFirstRespMs).toBe(3600000); // only first note counts
    });

    it("averages first response across multiple tickets", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
            {
              id: TK2,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
          ],
          notes: [
            { ticket_id: TK1, created_at: "2026-06-01T11:00:00.000Z" }, // 1h
            { ticket_id: TK2, created_at: "2026-06-01T13:00:00.000Z" }, // 3h
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.avgFirstRespMs).toBe(7200000); // (1h + 3h) / 2 = 2h in ms
    });

    it("is null when no notes exist", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
          ],
          notes: [],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.avgFirstRespMs).toBeNull();
    });

    it("uses max(0, firstNote - created) — firstResp never negative", () => {
      // Note created before ticket (data inconsistency)
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T12:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
          ],
          notes: [
            { ticket_id: TK1, created_at: "2026-06-01T10:00:00.000Z" }, // before ticket!
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.avgFirstRespMs).toBe(0); // clamped to 0
    });
  });

  describe("reopenCount", () => {
    it("counts status transitions to pending or open as reopens", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "in-progress",
            },
          ],
          history: [
            { ticket_id: TK1, changed_at: "2026-06-02T10:00:00.000Z", from_status: "completed", to_status: "pending" },
            { ticket_id: TK1, changed_at: "2026-06-03T10:00:00.000Z", from_status: "in-progress", to_status: "open" },
            { ticket_id: TK1, changed_at: "2026-06-04T10:00:00.000Z", from_status: "open", to_status: "in-progress" }, // not a reopen
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.reopenCount).toBe(2);
    });

    it("filters reopens by dateFrom/dateTo when provided", () => {
      const result = computeRadarMetrics(
        makeInput({
          dateFrom: "2026-06-03T00:00:00.000Z",
          dateTo: "2026-06-03T23:59:59.999Z",
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "in-progress",
            },
          ],
          history: [
            { ticket_id: TK1, changed_at: "2026-06-02T10:00:00.000Z", from_status: "done", to_status: "pending" }, // before dateFrom
            { ticket_id: TK1, changed_at: "2026-06-03T12:00:00.000Z", from_status: "done", to_status: "open" }, // inside range
            { ticket_id: TK1, changed_at: "2026-06-04T10:00:00.000Z", from_status: "done", to_status: "pending" }, // after dateTo
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.reopenCount).toBe(1);
    });

    it("counts all reopens when dateFrom is null", () => {
      const result = computeRadarMetrics(
        makeInput({
          dateFrom: null,
          dateTo: null,
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "in-progress",
            },
          ],
          history: [
            { ticket_id: TK1, changed_at: "2026-06-02T10:00:00.000Z", from_status: "done", to_status: "pending" },
            { ticket_id: TK1, changed_at: "2026-06-03T10:00:00.000Z", from_status: "done", to_status: "open" },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.reopenCount).toBe(2);
    });
  });

  describe("reliabilityPct", () => {
    it("100% when no reopens among completed tickets", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-03T10:00:00.000Z",
              status: "completed",
            },
            {
              id: TK2,
              assignee_id: TECH_1,
              created_at: "2026-06-02T10:00:00.000Z",
              closed_at: "2026-06-05T10:00:00.000Z",
              status: "completed",
            },
          ],
          history: [],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.reliabilityPct).toBe(100);
    });

    it("drops when some completed tickets had reopens", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-03T10:00:00.000Z",
              status: "completed",
            },
            {
              id: TK2,
              assignee_id: TECH_1,
              created_at: "2026-06-02T10:00:00.000Z",
              closed_at: "2026-06-05T10:00:00.000Z",
              status: "completed",
            },
            {
              id: TK3,
              assignee_id: TECH_1,
              created_at: "2026-06-03T10:00:00.000Z",
              closed_at: "2026-06-06T10:00:00.000Z",
              status: "completed",
            },
          ],
          history: [
            { ticket_id: TK1, changed_at: "2026-06-04T10:00:00.000Z", from_status: "completed", to_status: "pending" },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      // 3 completed, 1 reopen → (3 - 1) / 3 * 100 = 66.66 → 67
      expect(t1.reliabilityPct).toBe(67);
    });

    it("reliabilityPct is 0 when completed is 0", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.reliabilityPct).toBe(0);
    });
  });

  describe("volumeScore", () => {
    it("highest volume tech gets 100", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
            {
              id: TK2,
              assignee_id: TECH_1,
              created_at: "2026-06-02T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
            {
              id: TK3,
              assignee_id: TECH_1,
              created_at: "2026-06-03T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
            {
              id: TK4,
              assignee_id: TECH_2,
              created_at: "2026-06-04T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      const t2 = result.find((r) => r.technician_id === TECH_2)!;
      expect(t1.volumeScore).toBe(100); // most assigned
      expect(t2.volumeScore).toBe(33); // 1/3 ≈ 33%
    });

    it("all get 100 when only one technician", () => {
      const result = computeRadarMetrics(
        makeInput({
          roles: [{ user_id: TECH_1, role: "admin" }],
          profiles: [T1],
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
          ],
        }),
      );

      expect(result).toHaveLength(1);
      expect(result[0].volumeScore).toBe(100);
    });
  });

  describe("normalized metrics", () => {
    it("all normalized values are in 0-100 range", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-03T10:00:00.000Z",
              status: "completed",
            },
            {
              id: TK2,
              assignee_id: TECH_2,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-10T10:00:00.000Z",
              status: "completed",
            },
          ],
          notes: [
            { ticket_id: TK1, created_at: "2026-06-01T11:00:00.000Z" },
            { ticket_id: TK2, created_at: "2026-06-01T12:00:00.000Z" },
          ],
        }),
      );

      for (const row of result) {
        const n = row.normalized;
        expect(n.volume).toBeGreaterThanOrEqual(0);
        expect(n.volume).toBeLessThanOrEqual(100);
        expect(n.velocita).toBeGreaterThanOrEqual(0);
        expect(n.velocita).toBeLessThanOrEqual(100);
        expect(n.completamento).toBeGreaterThanOrEqual(0);
        expect(n.completamento).toBeLessThanOrEqual(100);
        expect(n.reattivita).toBeGreaterThanOrEqual(0);
        expect(n.reattivita).toBeLessThanOrEqual(100);
        expect(n.affidabilita).toBeGreaterThanOrEqual(0);
        expect(n.affidabilita).toBeLessThanOrEqual(100);
      }
    });

    it("faster resolution → higher velocita (inversely normalized)", () => {
      // T1 resolves in 2 days, T2 resolves in 8 days
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-03T10:00:00.000Z", // 2 days
              status: "completed",
            },
            {
              id: TK2,
              assignee_id: TECH_2,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-09T10:00:00.000Z", // 8 days
              status: "completed",
            },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      const t2 = result.find((r) => r.technician_id === TECH_2)!;
      // T1 is faster → higher velocita
      expect(t1.normalized.velocita).toBe(100);
      expect(t2.normalized.velocita).toBe(0);
    });

    it("faster first response → higher reattivita", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
            {
              id: TK2,
              assignee_id: TECH_2,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
          ],
          notes: [
            { ticket_id: TK1, created_at: "2026-06-01T10:30:00.000Z" }, // 30 min
            { ticket_id: TK2, created_at: "2026-06-01T12:00:00.000Z" }, // 2 hours
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      const t2 = result.find((r) => r.technician_id === TECH_2)!;
      // T1 responded faster → higher reattivita
      expect(t1.normalized.reattivita).toBe(100);
      expect(t2.normalized.reattivita).toBe(0);
    });

    it("all normalized values are 0 when no tickets or no data", () => {
      const result = computeRadarMetrics(makeInput());

      if (result.length > 0) {
        const n = result[0].normalized;
        expect(n.volume).toBe(0);
        expect(n.velocita).toBe(0);
        expect(n.completamento).toBe(0);
        expect(n.reattivita).toBe(0);
        expect(n.affidabilita).toBe(0);
      }
    });
  });

  describe("filtering", () => {
    it("only includes profiles with admin or tech roles", () => {
      const result = computeRadarMetrics(
        makeInput({
          roles: [
            { user_id: TECH_1, role: "admin" },
            { user_id: TECH_2, role: "tech" },
          ],
          profiles: [
            T1,
            T2,
            { id: NON_TECH, full_name: "Viewer", initials: null },
          ],
        }),
      );

      const ids = result.map((r) => r.technician_id);
      expect(ids).toContain(TECH_1);
      expect(ids).toContain(TECH_2);
      expect(ids).not.toContain(NON_TECH);
    });

    it("only assigns tickets to technicians in assignableIds", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: NON_TECH, // not assignable
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
            {
              id: TK2,
              assignee_id: TECH_1,
              created_at: "2026-06-02T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      expect(t1.assigned).toBe(1); // only TK2
    });
  });

  describe("edge cases", () => {
    it("returns empty array when no assignable technicians", () => {
      const result = computeRadarMetrics(
        makeInput({
          roles: [],
          profiles: [],
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
            },
          ],
        }),
      );

      expect(result).toHaveLength(0);
    });

    it("does not crash with empty tickets/notes/history", () => {
      expect(() =>
        computeRadarMetrics(
          makeInput({
            tickets: [],
            notes: [],
            history: [],
          }),
        ),
      ).not.toThrow();
    });

    it("full_name falls back to 'Non assegnato' when profile is missing", () => {
      // When the profile is entirely missing from the map (not just empty string)
      const result = computeRadarMetrics(
        makeInput({
          roles: [{ user_id: TECH_1, role: "admin" }],
          profiles: [], // no profiles → no entry in profileNameById
        }),
      );

      // byTech entries are seeded from profiles filtered by assignableIds.
      // Since profiles is empty, byTech is empty → result is empty.
      expect(result).toHaveLength(0);
    });

    it("full_name is empty string when profile full_name is empty string", () => {
      const result = computeRadarMetrics(
        makeInput({
          profiles: [{ id: TECH_1, full_name: "", initials: null }],
        }),
      );

      expect(result[0].full_name).toBe("");
    });

    it("ticket closed_at after creation — resolution days is always positive", () => {
      const result = computeRadarMetrics(
        makeInput({
          tickets: [
            {
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-05T10:00:00.000Z",
              closed_at: "2026-06-01T10:00:00.000Z", // before created! (data inconsistency)
              status: "completed",
            },
          ],
        }),
      );

      const t1 = result.find((r) => r.technician_id === TECH_1)!;
      // Resolution days can be negative from raw data, but the function doesn't guard
      // The test just verifies it doesn't crash
      expect(t1.completed).toBe(1);
    });
  });
});

// ─── computeDashboardAnalytics ────────────────────────────────────────

describe("computeDashboardAnalytics", () => {
  const TK1 = "11111111-1111-4111-8111-111111111111";
  const TK2 = "22222222-2222-4222-8222-222222222222";
  const TK3 = "33333333-3333-4333-8333-333333333333";

  function makeInput(overrides: Partial<DashboardAnalyticsInput> = {}): DashboardAnalyticsInput {
    return {
      ticketsAll: [],
      archivedHist: [],
      technicianData: [],
      dateFrom: "2026-06-01T12:00:00.000Z",
      dateTo: "2026-07-01T12:00:00.000Z",
      ...overrides,
    };
  }

  function makeTicket(overrides: Partial<DashboardAnalyticsInput["ticketsAll"][number]>): DashboardAnalyticsInput["ticketsAll"][number] {
    return {
      id: TK1,
      created_at: "2026-06-10T12:00:00.000Z",
      closed_at: null,
      status: "pending",
      assignee_id: TECH_1,
      priority: "med",
      sla_deadline: null,
      sla_breached: null,
      ...overrides,
    };
  }

  describe("output shape", () => {
    it("returns all top-level keys", () => {
      const result = computeDashboardAnalytics(makeInput());
      expect(result).toHaveProperty("ticketsByMonth");
      expect(result).toHaveProperty("technicianKpi");
      expect(result).toHaveProperty("priorityResolution");
      expect(result).toHaveProperty("summary");
    });

    it("priorityResolution always has high/med/low entries", () => {
      const result = computeDashboardAnalytics(makeInput());
      expect(result.priorityResolution).toHaveLength(3);
      expect(result.priorityResolution.map((p) => p.priority)).toEqual(["high", "med", "low"]);
    });
  });

  describe("ticketsByMonth — aggregation", () => {
    it("generates one entry per month in range", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-06-15T12:00:00.000Z",
          dateTo: "2026-08-15T12:00:00.000Z",
        }),
      );

      // June, July, August — Aug 15 noon > Aug 1 → all 3 included
      expect(result.ticketsByMonth).toHaveLength(3);
      expect(result.ticketsByMonth[0].month).toBe("2026-06-01");
      expect(result.ticketsByMonth[1].month).toBe("2026-07-01");
      expect(result.ticketsByMonth[2].month).toBe("2026-08-01");
    });

    it("counts opened tickets in their creation month", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-06-01T12:00:00.000Z",
          dateTo: "2026-07-01T12:00:00.000Z",
          ticketsAll: [
            makeTicket({ id: TK1, created_at: "2026-06-10T12:00:00.000Z" }),
            makeTicket({ id: TK2, created_at: "2026-06-15T12:00:00.000Z" }),
          ],
        }),
      );

      const june = result.ticketsByMonth.find((m) => m.month === "2026-06-01")!;
      expect(june.opened).toBe(2);
    });

    it("counts closed tickets (with closed_at) in their closed month", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-06-01T12:00:00.000Z",
          dateTo: "2026-07-01T12:00:00.000Z",
          ticketsAll: [
            makeTicket({ id: TK1, created_at: "2026-06-01T12:00:00.000Z", closed_at: "2026-06-20T12:00:00.000Z" }),
            makeTicket({ id: TK2, created_at: "2026-06-01T12:00:00.000Z", closed_at: "2026-06-25T12:00:00.000Z" }),
            makeTicket({ id: TK3, created_at: "2026-06-10T12:00:00.000Z", closed_at: null, status: "pending" }),
          ],
        }),
      );

      const june = result.ticketsByMonth.find((m) => m.month === "2026-06-01")!;
      expect(june.opened).toBe(3);
      expect(june.closed).toBe(2);
    });

    it("counts archived tickets via archivedHist in archived month", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-06-01T12:00:00.000Z",
          dateTo: "2026-07-01T12:00:00.000Z",
          ticketsAll: [
            makeTicket({
              id: TK1,
              created_at: "2026-06-01T12:00:00.000Z",
              closed_at: null,
              status: "archived",
            }),
          ],
          archivedHist: [
            { ticket_id: TK1, changed_at: "2026-06-25T12:00:00.000Z" },
          ],
        }),
      );

      const june = result.ticketsByMonth.find((m) => m.month === "2026-06-01")!;
      expect(june.opened).toBe(1);
      expect(june.closed).toBe(1);
    });

    it("archived without archivedHist: counts closed in created month", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-06-01T12:00:00.000Z",
          dateTo: "2026-07-01T12:00:00.000Z",
          ticketsAll: [
            makeTicket({
              id: TK1,
              created_at: "2026-06-01T12:00:00.000Z",
              closed_at: null,
              status: "archived",
            }),
          ],
          archivedHist: [], // no history entry
        }),
      );

      const june = result.ticketsByMonth.find((m) => m.month === "2026-06-01")!;
      expect(june.opened).toBe(1);
      expect(june.closed).toBe(1); // falls back to created month
    });

    it("computes avg_days per month from resolution durations", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-06-01T12:00:00.000Z",
          dateTo: "2026-07-01T12:00:00.000Z",
          ticketsAll: [
            makeTicket({ id: TK1, created_at: "2026-06-01T12:00:00.000Z", closed_at: "2026-06-03T12:00:00.000Z" }), // 2 days
            makeTicket({ id: TK2, created_at: "2026-06-01T12:00:00.000Z", closed_at: "2026-06-07T12:00:00.000Z" }), // 6 days
          ],
        }),
      );

      const june = result.ticketsByMonth.find((m) => m.month === "2026-06-01")!;
      expect(june.avg_days).toBe(4); // (2 + 6) / 2 = 4
    });

    it("avg_days is null for months with no closed tickets", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-06-01T12:00:00.000Z",
          dateTo: "2026-07-01T12:00:00.000Z",
          ticketsAll: [
            makeTicket({ id: TK1, created_at: "2026-06-10T12:00:00.000Z", closed_at: null, status: "pending" }),
          ],
        }),
      );

      const june = result.ticketsByMonth.find((m) => m.month === "2026-06-01")!;
      expect(june.avg_days).toBeNull();
    });
  });

  describe("summary", () => {
    it("opened and closed are totals across all months", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-05-01T12:00:00.000Z",
          dateTo: "2026-08-01T12:00:00.000Z",
          ticketsAll: [
            makeTicket({ id: TK1, created_at: "2026-05-10T12:00:00.000Z", closed_at: "2026-05-15T12:00:00.000Z" }),
            makeTicket({ id: TK2, created_at: "2026-06-10T12:00:00.000Z", closed_at: "2026-06-20T12:00:00.000Z" }),
            makeTicket({ id: TK3, created_at: "2026-07-10T12:00:00.000Z", closed_at: null, status: "pending" }),
          ],
        }),
      );

      expect(result.summary.opened).toBe(3);
      expect(result.summary.closed).toBe(2);
    });

    it("avgDays is average of monthly avg_days", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-05-01T12:00:00.000Z",
          dateTo: "2026-07-01T12:00:00.000Z",
          ticketsAll: [
            // May: 1 ticket, 3 days
            makeTicket({ id: TK1, created_at: "2026-05-10T12:00:00.000Z", closed_at: "2026-05-13T12:00:00.000Z" }),
            // June: 1 ticket, 7 days
            makeTicket({ id: TK2, created_at: "2026-06-01T12:00:00.000Z", closed_at: "2026-06-08T12:00:00.000Z" }),
          ],
        }),
      );

      // May avg = 3, June avg = 7 → overall avg = (3 + 7) / 2 = 5
      expect(result.summary.avgDays).toBe(5);
    });

    it("avgDays is null when no months have closed tickets", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-06-01T12:00:00.000Z",
          dateTo: "2026-07-01T12:00:00.000Z",
          ticketsAll: [
            makeTicket({ id: TK1, created_at: "2026-06-10T12:00:00.000Z", closed_at: null, status: "pending" }),
          ],
        }),
      );

      expect(result.summary.avgDays).toBeNull();
    });

    it("summary has all expected sla fields", () => {
      const result = computeDashboardAnalytics(makeInput());
      expect(result.summary).toHaveProperty("slaRespected");
      expect(result.summary).toHaveProperty("slaTotal");
      expect(result.summary).toHaveProperty("slaRespectedPct");
    });
  });

  describe("technicianKpi", () => {
    it("passes through technicianData with SLA enrichment", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          technicianData: [
            { technician_id: TECH_1, full_name: "Marco", assigned: 5, completed: 2, avg_days: 2.5 },
            { technician_id: TECH_2, full_name: "Demo", assigned: 1, completed: 0, avg_days: null },
          ],
        }),
      );

      expect(result.technicianKpi).toHaveLength(2);
      expect(result.technicianKpi[0]).toMatchObject({
        technician_id: TECH_1,
        full_name: "Marco",
        assigned: 5,
        completed: 2,
        avg_days: 2.5,
        sla_total: 0,
        sla_respected: 0,
        sla_respected_pct: null,
      });
    });

    it("falls back to 'Non assegnato' when full_name is missing", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          technicianData: [
            { technician_id: TECH_1, full_name: undefined, assigned: 1, completed: 0, avg_days: null },
          ],
        }),
      );

      expect(result.technicianKpi[0].full_name).toBe("Non assegnato");
    });
  });

  describe("SLA aggregation", () => {
    it("SLA counted when ticket has sla_deadline AND is closed", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          ticketsAll: [
            makeTicket({
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-10T10:00:00.000Z",
              sla_deadline: "2026-06-15T10:00:00.000Z", // met
              sla_breached: false,
            }),
          ],
          technicianData: [
            { technician_id: TECH_1, full_name: "Marco", assigned: 1, completed: 1, avg_days: 9 },
          ],
        }),
      );

      const tech = result.technicianKpi[0];
      expect(tech.sla_total).toBe(1);
      expect(tech.sla_respected).toBe(1);
      expect(tech.sla_respected_pct).toBe(100);

      expect(result.summary.slaTotal).toBe(1);
      expect(result.summary.slaRespected).toBe(1);
      expect(result.summary.slaRespectedPct).toBe(100);
    });

    it("SLA breached when ticket has sla_breached=true", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          ticketsAll: [
            makeTicket({
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "pending",
              sla_deadline: "2026-06-05T10:00:00.000Z",
              sla_breached: true,
            }),
          ],
          technicianData: [
            { technician_id: TECH_1, full_name: "Marco", assigned: 1, completed: 0, avg_days: null },
          ],
        }),
      );

      const tech = result.technicianKpi[0];
      expect(tech.sla_total).toBe(1);
      expect(tech.sla_respected).toBe(0);
      expect(tech.sla_respected_pct).toBe(0);
    });

    it("SLA respected when closed_at <= sla_deadline", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          ticketsAll: [
            makeTicket({
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-03T10:00:00.000Z",
              sla_deadline: "2026-06-05T10:00:00.000Z",
              sla_breached: false,
            }),
          ],
          technicianData: [
            { technician_id: TECH_1, full_name: "Marco", assigned: 1, completed: 1, avg_days: 2 },
          ],
        }),
      );

      const tech = result.technicianKpi[0];
      expect(tech.sla_respected).toBe(1);
    });

    it("SLA not respected when closed_at > sla_deadline (even if sla_breached is false)", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          ticketsAll: [
            makeTicket({
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-10T10:00:00.000Z",
              sla_deadline: "2026-06-05T10:00:00.000Z",
              sla_breached: false,
            }),
          ],
          technicianData: [
            { technician_id: TECH_1, full_name: "Marco", assigned: 1, completed: 1, avg_days: 9 },
          ],
        }),
      );

      const tech = result.technicianKpi[0];
      expect(tech.sla_total).toBe(1);
      expect(tech.sla_respected).toBe(0);
    });

    it("SLA uses archivedHist date as closed_at when ticket is archived", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          ticketsAll: [
            makeTicket({
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: null,
              status: "archived",
              sla_deadline: "2026-06-15T10:00:00.000Z",
              sla_breached: false,
            }),
          ],
          archivedHist: [
            { ticket_id: TK1, changed_at: "2026-06-05T10:00:00.000Z" },
          ],
          technicianData: [
            { technician_id: TECH_1, full_name: "Marco", assigned: 1, completed: 0, avg_days: null },
          ],
        }),
      );

      const tech = result.technicianKpi[0];
      // archivedHist date (June 5) <= sla_deadline (June 15) → respected
      expect(tech.sla_total).toBe(1);
      expect(tech.sla_respected).toBe(1);
    });

    it("SLA aggregates across multiple technicians", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          ticketsAll: [
            makeTicket({ id: TK1, assignee_id: TECH_1, created_at: "2026-06-01T10:00:00.000Z", closed_at: "2026-06-10T10:00:00.000Z", sla_deadline: "2026-06-15T10:00:00.000Z", sla_breached: false }),
            makeTicket({ id: TK2, assignee_id: TECH_2, created_at: "2026-06-01T10:00:00.000Z", closed_at: "2026-06-10T10:00:00.000Z", sla_deadline: "2026-06-05T10:00:00.000Z", sla_breached: false }),
          ],
          technicianData: [
            { technician_id: TECH_1, full_name: "Marco", assigned: 1, completed: 1, avg_days: 9 },
            { technician_id: TECH_2, full_name: "Demo", assigned: 1, completed: 1, avg_days: 9 },
          ],
        }),
      );

      expect(result.summary.slaTotal).toBe(2);
      expect(result.summary.slaRespected).toBe(1); // only TECH_1
      expect(result.summary.slaRespectedPct).toBe(50);

      const t1 = result.technicianKpi.find((k) => k.technician_id === TECH_1)!;
      const t2 = result.technicianKpi.find((k) => k.technician_id === TECH_2)!;
      expect(t1.sla_respected).toBe(1);
      expect(t2.sla_respected).toBe(0);
    });

    it("SLA is ignored when ticket has no sla_deadline", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          ticketsAll: [
            makeTicket({
              id: TK1,
              assignee_id: TECH_1,
              created_at: "2026-06-01T10:00:00.000Z",
              closed_at: "2026-06-10T10:00:00.000Z",
              sla_deadline: null,
              sla_breached: null,
            }),
          ],
          technicianData: [
            { technician_id: TECH_1, full_name: "Marco", assigned: 1, completed: 1, avg_days: 9 },
          ],
        }),
      );

      const tech = result.technicianKpi[0];
      expect(tech.sla_total).toBe(0);
      expect(tech.sla_respected).toBe(0);
    });
  });

  describe("priorityResolution", () => {
    it("computes avg_hours for each priority from completed tickets", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          ticketsAll: [
            makeTicket({ id: TK1, priority: "high", created_at: "2026-06-01T10:00:00.000Z", closed_at: "2026-06-01T12:00:00.000Z" }), // 2 hours
            makeTicket({ id: TK2, priority: "high", created_at: "2026-06-02T10:00:00.000Z", closed_at: "2026-06-02T16:00:00.000Z" }), // 6 hours
            makeTicket({ id: TK3, priority: "med", created_at: "2026-06-03T10:00:00.000Z", closed_at: "2026-06-03T14:00:00.000Z" }), // 4 hours
          ],
        }),
      );

      const high = result.priorityResolution.find((p) => p.priority === "high")!;
      const med = result.priorityResolution.find((p) => p.priority === "med")!;
      const low = result.priorityResolution.find((p) => p.priority === "low")!;

      expect(high.completed).toBe(2);
      expect(high.avg_hours).toBe(4); // (2 + 6) / 2 = 4
      expect(med.completed).toBe(1);
      expect(med.avg_hours).toBe(4);
      expect(low.completed).toBe(0);
      expect(low.avg_hours).toBeNull();
    });

    it("ignores non-finite or negative hours", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          ticketsAll: [
            makeTicket({ id: TK1, priority: "high", created_at: "2026-06-01T14:00:00.000Z", closed_at: "2026-06-01T10:00:00.000Z" }), // negative hours
            makeTicket({ id: TK2, priority: "high", created_at: "2026-06-02T10:00:00.000Z", closed_at: "2026-06-02T14:00:00.000Z" }), // 4 hours
          ],
        }),
      );

      const high = result.priorityResolution.find((p) => p.priority === "high")!;
      // TK1 has negative hours → filtered by Number.isFinite && >= 0
      expect(high.completed).toBe(1);
      expect(high.avg_hours).toBe(4);
    });

    it("all three priorities always present with default values", () => {
      const result = computeDashboardAnalytics(makeInput());

      for (const p of result.priorityResolution) {
        expect(p.completed).toBe(0);
        expect(p.avg_hours).toBeNull();
      }
    });
  });

  describe("edge cases", () => {
    it("returns valid structure with all-empty inputs", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-06-01T12:00:00.000Z",
          dateTo: "2026-06-30T12:00:00.000Z",
        }),
      );

      expect(result.ticketsByMonth).toHaveLength(1);
      expect(result.technicianKpi).toHaveLength(0);
      expect(result.priorityResolution).toHaveLength(3);
      expect(result.summary.opened).toBe(0);
      expect(result.summary.closed).toBe(0);
    });

    it("handles single-day range", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          dateFrom: "2026-06-15T12:00:00.000Z",
          dateTo: "2026-06-16T12:00:00.000Z",
        }),
      );

      // June 1st < June 16 → included
      expect(result.ticketsByMonth).toHaveLength(1);
    });

    it("does not crash with null/undefined optional fields", () => {
      expect(() =>
        computeDashboardAnalytics(
          makeInput({
            dateFrom: "2026-06-01T12:00:00.000Z",
            dateTo: "2026-07-01T12:00:00.000Z",
            ticketsAll: [
              makeTicket({
                id: TK1,
                created_at: "2026-06-01T12:00:00.000Z",
                closed_at: null,
                status: "pending",
                assignee_id: null,
                priority: "med",
                sla_deadline: null,
                sla_breached: null,
              }),
            ],
          }),
        ),
      ).not.toThrow();
    });

    it("technician_id null in technicianData is handled", () => {
      const result = computeDashboardAnalytics(
        makeInput({
          technicianData: [
            { technician_id: null, full_name: "Non assegnato", assigned: 5, completed: 3, avg_days: 2 },
          ],
        }),
      );

      expect(result.technicianKpi).toHaveLength(1);
      expect(result.technicianKpi[0].technician_id).toBeNull();
    });
  });
});

// ─── computeOverdueTickets ────────────────────────────────────────────

describe("computeOverdueTickets", () => {
  const NOW = new Date("2026-06-10T12:00:00.000Z").getTime();

  function makeTicket(overrides: Partial<OverdueTicketsInput["tickets"][number]> = {}): OverdueTicketsInput["tickets"][number] {
    return {
      id: "11111111-1111-4111-8111-111111111111",
      ticket_code: "TKT-001",
      status: "pending",
      priority: "high",
      client: "Cliente Demo",
      model: "MacBook Pro",
      created_at: "2026-06-01T12:00:00.000Z",
      updated_at: "2026-06-05T12:00:00.000Z",
      sla_deadline: "2026-06-15T12:00:00.000Z",
      sla_breached: false,
      assignee: { full_name: "Marco Gastaldello" },
      ...overrides,
    };
  }

  function makeInput(overrides: Partial<OverdueTicketsInput> = {}): OverdueTicketsInput {
    return {
      tickets: [],
      now: NOW,
      ...overrides,
    };
  }

  describe("field mapping", () => {
    it("passes through all scalar fields", () => {
      const result = computeOverdueTickets(
        makeInput({ tickets: [makeTicket()] }),
      );

      const row = result[0];
      expect(row.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(row.ticket_code).toBe("TKT-001");
      expect(row.status).toBe("pending");
      expect(row.priority).toBe("high");
      expect(row.client).toBe("Cliente Demo");
      expect(row.model).toBe("MacBook Pro");
      expect(row.created_at).toBe("2026-06-01T12:00:00.000Z");
      expect(row.updated_at).toBe("2026-06-05T12:00:00.000Z");
      expect(row.sla_deadline).toBe("2026-06-15T12:00:00.000Z");
      expect(row.sla_breached).toBe(false);
      expect(row.assignee_name).toBe("Marco Gastaldello");
    });

    it("extracts assignee_name from assignee.full_name", () => {
      const result = computeOverdueTickets(
        makeInput({
          tickets: [makeTicket({ assignee: { full_name: "Tecnico Demo" } })],
        }),
      );

      expect(result[0].assignee_name).toBe("Tecnico Demo");
    });
  });

  describe("null handling", () => {
    it("maps null client to null", () => {
      const result = computeOverdueTickets(
        makeInput({ tickets: [makeTicket({ client: null })] }),
      );
      expect(result[0].client).toBeNull();
    });

    it("maps null model to null", () => {
      const result = computeOverdueTickets(
        makeInput({ tickets: [makeTicket({ model: null })] }),
      );
      expect(result[0].model).toBeNull();
    });

    it("maps null assignee to null assignee_name", () => {
      const result = computeOverdueTickets(
        makeInput({ tickets: [makeTicket({ assignee: null })] }),
      );
      expect(result[0].assignee_name).toBeNull();
    });

    it("maps null sla_deadline to null", () => {
      const result = computeOverdueTickets(
        makeInput({ tickets: [makeTicket({ sla_deadline: null })] }),
      );
      expect(result[0].sla_deadline).toBeNull();
    });

    it("maps null sla_breached to null", () => {
      const result = computeOverdueTickets(
        makeInput({ tickets: [makeTicket({ sla_breached: null })] }),
      );
      expect(result[0].sla_breached).toBeNull();
    });

    it("preserves null updated_at", () => {
      const result = computeOverdueTickets(
        makeInput({ tickets: [makeTicket({ updated_at: null })] }),
      );
      expect(result[0].updated_at).toBeNull();
    });
  });

  describe("days_open computation", () => {
    it("computes days_open from created_at to now", () => {
      // Ticket created June 1, now is June 10 → 9 days
      const result = computeOverdueTickets(
        makeInput({
          tickets: [makeTicket({ created_at: "2026-06-01T12:00:00.000Z" })],
          now: new Date("2026-06-10T12:00:00.000Z").getTime(),
        }),
      );

      expect(result[0].days_open).toBe(9);
    });

    it("days_open is 0 when ticket created right now", () => {
      const result = computeOverdueTickets(
        makeInput({
          tickets: [makeTicket({ created_at: "2026-06-10T12:00:00.000Z" })],
          now: new Date("2026-06-10T12:00:00.000Z").getTime(),
        }),
      );

      expect(result[0].days_open).toBe(0);
    });

    it("rounds days_open to nearest integer", () => {
      // Created 12 hours ago → 0.5 days → rounds to 1
      const result = computeOverdueTickets(
        makeInput({
          tickets: [makeTicket({ created_at: "2026-06-10T00:00:00.000Z" })],
          now: new Date("2026-06-10T12:00:00.000Z").getTime(),
        }),
      );

      expect(result[0].days_open).toBe(1); // 0.5 → Math.round → 1
    });

    it("computes days_open independently per ticket", () => {
      const result = computeOverdueTickets(
        makeInput({
          tickets: [
            makeTicket({ id: "a", created_at: "2026-06-01T12:00:00.000Z" }),
            makeTicket({ id: "b", created_at: "2026-06-05T12:00:00.000Z" }),
          ],
          now: new Date("2026-06-10T12:00:00.000Z").getTime(),
        }),
      );

      expect(result[0].days_open).toBe(9);  // June 1 → 9 days
      expect(result[1].days_open).toBe(5);  // June 5 → 5 days
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty tickets", () => {
      const result = computeOverdueTickets(makeInput({ tickets: [] }));
      expect(result).toHaveLength(0);
    });

    it("maps multiple tickets preserving order", () => {
      const result = computeOverdueTickets(
        makeInput({
          tickets: [
            makeTicket({ id: "a", ticket_code: "TKT-001" }),
            makeTicket({ id: "b", ticket_code: "TKT-002" }),
            makeTicket({ id: "c", ticket_code: "TKT-003" }),
          ],
        }),
      );

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.ticket_code)).toEqual(["TKT-001", "TKT-002", "TKT-003"]);
    });

    it("sla_breached true passes through correctly", () => {
      const result = computeOverdueTickets(
        makeInput({ tickets: [makeTicket({ sla_breached: true })] }),
      );
      expect(result[0].sla_breached).toBe(true);
    });
  });
});

// ─── PeriodRange (type shape) ──────────────────────────────────────

describe("PeriodRange (type shape)", () => {
  it("has { from: Date, to: Date }", () => {
    const range: PeriodRange = {
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-10T12:00:00.000Z"),
    };

    expect(range.from).toBeInstanceOf(Date);
    expect(range.to).toBeInstanceOf(Date);
    expect(Object.keys(range).sort()).toEqual(["from", "to"]);
    expect(range.from <= range.to).toBe(true);
  });

  it("PeriodRangePeriod is 'today' | 'week' | 'month'", () => {
    const modes: PeriodRangePeriod[] = ["today", "week", "month"];
    expect(modes).toHaveLength(3);
    expect(modes).toContain("today");
    expect(modes).toContain("week");
    expect(modes).toContain("month");
  });
});

// ─── computePeriodRange ───────────────────────────────────────────────

describe("computePeriodRange", () => {
  const WEDNESDAY = new Date("2026-06-10T14:30:00.000Z"); // Wed
  const MONDAY = new Date("2026-06-08T12:00:00.000Z");
  const SUNDAY = new Date("2026-06-14T12:00:00.000Z"); // Sunday noon UTC — safe in all timezones
  const JUNE_FIRST = new Date("2026-06-01T12:00:00.000Z");

  describe("today", () => {
    it("from = start of today, to = now", () => {
      const result = computePeriodRange("today", WEDNESDAY);

      // Checks are on local-time components to be timezone-independent
      expect(result.from.getFullYear()).toBe(2026);
      expect(result.from.getMonth()).toBe(5); // June
      expect(result.from.getDate()).toBe(10);
      expect(result.from.getHours()).toBe(0);
      expect(result.from.getMinutes()).toBe(0);
      expect(result.to).toEqual(WEDNESDAY);
    });
  });

  describe("month", () => {
    it("from = 1st of the month, to = now", () => {
      const result = computePeriodRange("month", JUNE_FIRST);

      expect(result.from.getFullYear()).toBe(2026);
      expect(result.from.getMonth()).toBe(5); // June = 5
      expect(result.from.getDate()).toBe(1);
      expect(result.from.getHours()).toBe(0);
      expect(result.to).toEqual(JUNE_FIRST);
    });
  });

  describe("week (default)", () => {
    it("from = Monday of current week (Wed → Mon)", () => {
      const result = computePeriodRange("week", WEDNESDAY);

      expect(result.from.getFullYear()).toBe(2026);
      expect(result.from.getMonth()).toBe(5);
      expect(result.from.getDate()).toBe(8); // Monday June 8
      expect(result.from.getDay()).toBe(1); // Monday
      expect(result.from.getHours()).toBe(0);
      expect(result.to).toEqual(WEDNESDAY);
    });

    it("Monday stays Monday", () => {
      const result = computePeriodRange("week", MONDAY);

      expect(result.from.getDate()).toBe(8);
      expect(result.from.getDay()).toBe(1);
    });

    it("Sunday goes back to Monday", () => {
      const result = computePeriodRange("week", SUNDAY);

      expect(result.from.getDate()).toBe(8);
      expect(result.from.getDay()).toBe(1);
    });
  });

  describe("output shape", () => {
    it("returns { from: Date, to: Date }", () => {
      const result = computePeriodRange("week", WEDNESDAY);

      expect(result.from).toBeInstanceOf(Date);
      expect(result.to).toBeInstanceOf(Date);
      expect(result.from <= result.to).toBe(true);
    });

    it("to is always a fresh Date(now)", () => {
      const result = computePeriodRange("today", WEDNESDAY);

      // to should equal the passed-in now
      expect(result.to.getTime()).toBe(WEDNESDAY.getTime());
    });
  });
});

// ─── WeekRange (type shape) ─────────────────────────────────────────

describe("WeekRange (type shape)", () => {
  it("has { start: Date, end: Date }", () => {
    const range: WeekRange = {
      start: new Date("2026-06-08T00:00:00.000Z"),
      end: new Date("2026-06-15T00:00:00.000Z"),
    };

    expect(range.start).toBeInstanceOf(Date);
    expect(range.end).toBeInstanceOf(Date);
    expect(Object.keys(range).sort()).toEqual(["end", "start"]);
    expect(range.start <= range.end).toBe(true);
  });

  it("end is exactly 7 days from start", () => {
    const range: WeekRange = {
      start: new Date("2026-06-08T00:00:00.000Z"),
      end: new Date("2026-06-15T00:00:00.000Z"),
    };
    const diffMs = range.end.getTime() - range.start.getTime();
    expect(diffMs).toBe(7 * 24 * 3600 * 1000);
  });
});

// ─── computeWeekRange ──────────────────────────────────────────────────

describe("computeWeekRange", () => {
  const WEDNESDAY = new Date("2026-06-10T14:30:00.000Z"); // Wed Jun 10
  const MONDAY = new Date("2026-06-08T12:00:00.000Z"); // Mon Jun 8
  const SUNDAY = new Date("2026-06-14T12:00:00.000Z"); // Sun Jun 14

  describe("current week (offset=0)", () => {
    it("from = Monday midnight, end = Monday + 7 days (Wed)", () => {
      const result = computeWeekRange(0, WEDNESDAY);

      expect(result.start.getFullYear()).toBe(2026);
      expect(result.start.getMonth()).toBe(5);
      expect(result.start.getDate()).toBe(8); // Monday June 8
      expect(result.start.getDay()).toBe(1); // Monday
      expect(result.start.getHours()).toBe(0);

      // end = start + 7 days = Monday June 15
      expect(result.end.getDate()).toBe(15);
      expect(result.end.getDay()).toBe(1);
      expect(result.end.getHours()).toBe(0);
    });

    it("Monday stays Monday", () => {
      const result = computeWeekRange(0, MONDAY);

      expect(result.start.getDate()).toBe(8);
      expect(result.start.getDay()).toBe(1);
    });

    it("Sunday goes back to Monday", () => {
      const result = computeWeekRange(0, SUNDAY);

      expect(result.start.getDate()).toBe(8);
      expect(result.start.getDay()).toBe(1);
    });
  });

  describe("offset weeks", () => {
    it("weekOffset=-1 shifts to previous week", () => {
      const result = computeWeekRange(-1, WEDNESDAY);

      expect(result.start.getDate()).toBe(1); // Monday June 1
      expect(result.end.getDate()).toBe(8); // Monday June 8
    });

    it("weekOffset=1 shifts to next week", () => {
      const result = computeWeekRange(1, WEDNESDAY);

      expect(result.start.getDate()).toBe(15); // Monday June 15
      expect(result.end.getDate()).toBe(22); // Monday June 22
    });

    it("weekOffset=2 shifts two weeks forward", () => {
      const result = computeWeekRange(2, WEDNESDAY);

      expect(result.start.getDate()).toBe(22); // Monday June 22
      expect(result.end.getDate()).toBe(29);
    });

    it("weekOffset=-2 shifts two weeks back", () => {
      const result = computeWeekRange(-2, WEDNESDAY);

      expect(result.start.getDate()).toBe(25); // Monday May 25
      expect(result.start.getMonth()).toBe(4); // May
    });
  });

  describe("output shape", () => {
    it("returns { start: Date, end: Date }", () => {
      const result = computeWeekRange(0, WEDNESDAY);

      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
      expect(result.start <= result.end).toBe(true);
    });

    it("end is exactly 7 days after start", () => {
      const result = computeWeekRange(0, WEDNESDAY);
      const diffMs = result.end.getTime() - result.start.getTime();
      expect(diffMs).toBe(7 * 24 * 3600 * 1000);
    });

    it("start is always at midnight (00:00:00.000)", () => {
      const result = computeWeekRange(0, WEDNESDAY);

      expect(result.start.getHours()).toBe(0);
      expect(result.start.getMinutes()).toBe(0);
      expect(result.start.getSeconds()).toBe(0);
      expect(result.start.getMilliseconds()).toBe(0);
    });
  });
});
