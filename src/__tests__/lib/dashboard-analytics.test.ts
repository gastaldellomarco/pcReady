import { describe, expect, it } from "vitest";
import { computeTechnicianStats } from "@/lib/dashboard-analytics";

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

      const t1 = rows.find((r) => r.id === TECH_1);
      const t2 = rows.find((r) => r.id === TECH_2);
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

      const t1 = rows.find((r) => r.id === TECH_1);
      const t2 = rows.find((r) => r.id === TECH_2);
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

      const t1 = rows.find((r) => r.id === TECH_1);
      const t2 = rows.find((r) => r.id === TECH_2);
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

      const t1 = rows.find((r) => r.id === TECH_1);
      const t2 = rows.find((r) => r.id === TECH_2);
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
