import { describe, expect, it } from "vitest";
import { computeTechnicianOverview, normalizeInitials } from "@/lib/user-profile";
import type {
  TechnicianOverviewInput,
  TechnicianOverviewTicket,
  TechnicianOverviewIntervention,
} from "@/lib/data/technician-overview";

// ── helpers ─────────────────────────────────────────────────────────

const SINCE = new Date("2026-01-01T00:00:00.000Z"); // Jan 1, 2026 (midnight UTC)

function makeInput(
  overrides: Partial<TechnicianOverviewInput> = {},
): TechnicianOverviewInput {
  return {
    closedTickets: [],
    interventions: [],
    since: SINCE,
    ...overrides,
  };
}

function ticket(
  overrides: Partial<TechnicianOverviewTicket> = {},
): TechnicianOverviewTicket {
  return {
    created_at: "2026-01-10T10:00:00.000Z",
    closed_at: "2026-01-12T10:00:00.000Z",
    ...overrides,
  };
}

function intervention(
  overrides: Partial<TechnicianOverviewIntervention> = {},
): TechnicianOverviewIntervention {
  return {
    started_at: "2026-01-15T10:00:00.000Z",
    duration_minutes: 120, // 2 hours
    ...overrides,
  };
}

// ── TechnicianOverviewInput (type shape) ─────────────────────────────

describe("TechnicianOverviewInput (type shape)", () => {
  it("has closedTickets, interventions, and since", () => {
    const input: TechnicianOverviewInput = {
      closedTickets: [
        { created_at: "2026-01-10T10:00:00.000Z", closed_at: "2026-01-12T10:00:00.000Z" },
      ],
      interventions: [
        { started_at: "2026-01-15T10:00:00.000Z", duration_minutes: 120 },
      ],
      since: new Date("2026-01-01T00:00:00.000Z"),
    };

    expect(Object.keys(input).sort()).toEqual([
      "closedTickets",
      "interventions",
      "since",
    ]);
    expect(Array.isArray(input.closedTickets)).toBe(true);
    expect(Array.isArray(input.interventions)).toBe(true);
    expect(input.since).toBeInstanceOf(Date);
  });

  it("closedTicket shape: { created_at: string, closed_at: string | null }", () => {
    const input: TechnicianOverviewInput = {
      closedTickets: [
        { created_at: "2026-01-10T10:00:00.000Z", closed_at: "2026-01-12T10:00:00.000Z" },
        { created_at: "2026-02-01T10:00:00.000Z", closed_at: null },
      ],
      interventions: [],
      since: new Date("2026-01-01T00:00:00.000Z"),
    };

    expect(input.closedTickets[0].closed_at).toBe("2026-01-12T10:00:00.000Z");
    expect(input.closedTickets[1].closed_at).toBeNull();
    expect(typeof input.closedTickets[0].created_at).toBe("string");
  });

  it("intervention shape: { started_at: string, duration_minutes: number }", () => {
    const input: TechnicianOverviewInput = {
      closedTickets: [],
      interventions: [
        { started_at: "2026-01-15T10:00:00.000Z", duration_minutes: 120 },
        { started_at: "2026-03-01T09:00:00.000Z", duration_minutes: 45 },
      ],
      since: new Date("2026-01-01T00:00:00.000Z"),
    };

    expect(typeof input.interventions[0].started_at).toBe("string");
    expect(typeof input.interventions[0].duration_minutes).toBe("number");
    expect(input.interventions[0].duration_minutes).toBe(120);
    expect(input.interventions[1].duration_minutes).toBe(45);
  });

  it("since is a Date", () => {
    const input: TechnicianOverviewInput = {
      closedTickets: [],
      interventions: [],
      since: new Date("2026-06-01T00:00:00.000Z"),
    };

    expect(input.since).toBeInstanceOf(Date);
    expect(input.since.getFullYear()).toBe(2026);
    expect(input.since.getMonth()).toBe(5); // June
  });
});

// ── computeTechnicianOverview ───────────────────────────────────────

describe("computeTechnicianOverview", () => {
  describe("output shape", () => {
    it("returns stats, monthlyActivity, and badges", () => {
      const result = computeTechnicianOverview(makeInput());

      expect(result).toHaveProperty("stats");
      expect(result).toHaveProperty("monthlyActivity");
      expect(result).toHaveProperty("badges");
    });

    it("monthlyActivity has exactly 6 months", () => {
      const result = computeTechnicianOverview(makeInput());
      expect(result.monthlyActivity).toHaveLength(6);
    });

    it("badges has exactly 3 entries", () => {
      const result = computeTechnicianOverview(makeInput());
      expect(result.badges).toHaveLength(3);
      expect(result.badges.map((b) => b.key)).toEqual([
        "closer",
        "fast-resolver",
        "time-tracker",
      ]);
    });
  });

  describe("stats", () => {
    it("closedTickets = length of input closedTickets", () => {
      const result = computeTechnicianOverview(
        makeInput({
          closedTickets: [ticket(), ticket(), ticket()],
        }),
      );

      expect(result.stats.closedTickets).toBe(3);
    });

    it("closedTickets = 0 when empty", () => {
      const result = computeTechnicianOverview(makeInput());
      expect(result.stats.closedTickets).toBe(0);
    });

    it("averageResolutionHours is null when no closed tickets", () => {
      const result = computeTechnicianOverview(makeInput());
      expect(result.stats.averageResolutionHours).toBeNull();
    });

    it("averageResolutionHours computes correctly for a single ticket", () => {
      // Jan 10 to Jan 12 = 2 days = 48 hours
      const result = computeTechnicianOverview(
        makeInput({
          closedTickets: [
            ticket({
              created_at: "2026-01-10T10:00:00.000Z",
              closed_at: "2026-01-12T10:00:00.000Z",
            }),
          ],
        }),
      );

      expect(result.stats.averageResolutionHours).toBe(48);
    });

    it("averageResolutionHours averages across multiple tickets", () => {
      // Ticket 1: 24h, Ticket 2: 72h → avg = 48
      const result = computeTechnicianOverview(
        makeInput({
          closedTickets: [
            ticket({
              created_at: "2026-01-10T10:00:00.000Z",
              closed_at: "2026-01-11T10:00:00.000Z", // 24h
            }),
            ticket({
              created_at: "2026-01-10T10:00:00.000Z",
              closed_at: "2026-01-13T10:00:00.000Z", // 72h
            }),
          ],
        }),
      );

      expect(result.stats.averageResolutionHours).toBe(48);
    });

    it("averageResolutionHours rounds to 1 decimal", () => {
      // Jan 10 10:00 to Jan 10 15:30 = 5.5 hours
      const result = computeTechnicianOverview(
        makeInput({
          closedTickets: [
            ticket({
              created_at: "2026-01-10T10:00:00.000Z",
              closed_at: "2026-01-10T15:30:00.000Z",
            }),
          ],
        }),
      );

      expect(result.stats.averageResolutionHours).toBe(5.5);
    });

    it("averageResolutionHours uses created_at when closed_at is null", () => {
      // closed_at null → uses created_at as fallback → 0 hours
      const result = computeTechnicianOverview(
        makeInput({
          closedTickets: [
            ticket({ closed_at: null }),
          ],
        }),
      );

      expect(result.stats.averageResolutionHours).toBe(0);
    });

    it("clamps negative resolution to 0 via Math.max(0, ...)", () => {
      // closed_at before created_at (data inconsistency) → clamped to 0
      const result = computeTechnicianOverview(
        makeInput({
          closedTickets: [
            ticket({
              created_at: "2026-01-10T10:00:00.000Z",
              closed_at: "2026-01-09T10:00:00.000Z",
            }),
          ],
        }),
      );

      expect(result.stats.averageResolutionHours).toBe(0);
    });

    it("workedHours sums intervention durations correctly", () => {
      const result = computeTechnicianOverview(
        makeInput({
          interventions: [
            intervention({ duration_minutes: 120 }), // 2h
            intervention({ duration_minutes: 90 }), // 1.5h
            intervention({ duration_minutes: 30 }), // 0.5h
          ],
        }),
      );

      expect(result.stats.workedHours).toBe(4); // 2 + 1.5 + 0.5 = 4
    });

    it("workedHours = 0 when no interventions", () => {
      const result = computeTechnicianOverview(makeInput());
      expect(result.stats.workedHours).toBe(0);
    });

    it("workedHours rounds to 1 decimal", () => {
      const result = computeTechnicianOverview(
        makeInput({
          interventions: [
            intervention({ duration_minutes: 50 }), // 0.833... hours
          ],
        }),
      );

      expect(result.stats.workedHours).toBe(0.8);
    });
  });

  describe("monthly activity", () => {
    it("months span 6 months from since", () => {
      // SINCE = Jan 1, 2026
      const result = computeTechnicianOverview(
        makeInput({ since: new Date("2026-06-01T00:00:00.000Z") }),
      );

      expect(result.monthlyActivity).toHaveLength(6);
      // Months: Jun, Jul, Aug, Sep, Oct, Nov
      // The exact month labels depend on locale, so we check structure
      for (const m of result.monthlyActivity) {
        expect(m).toHaveProperty("month");
        expect(m).toHaveProperty("closedTickets");
        expect(m).toHaveProperty("workedHours");
      }
    });

    it("buckets closed tickets into the correct month", () => {
      const result = computeTechnicianOverview(
        makeInput({
          since: new Date("2026-01-01T00:00:00.000Z"),
          closedTickets: [
            ticket({
              created_at: "2026-01-10T10:00:00.000Z",
              closed_at: "2026-01-15T10:00:00.000Z",
            }),
            ticket({
              created_at: "2026-02-01T10:00:00.000Z",
              closed_at: "2026-02-10T10:00:00.000Z",
            }),
            ticket({
              created_at: "2026-02-15T10:00:00.000Z",
              closed_at: "2026-02-20T10:00:00.000Z",
            }),
          ],
        }),
      );

      // Month index 0 = January, index 1 = February
      expect(result.monthlyActivity[0].closedTickets).toBe(1);
      expect(result.monthlyActivity[1].closedTickets).toBe(2);
      // Other months remain 0
      for (let i = 2; i < 6; i++) {
        expect(result.monthlyActivity[i].closedTickets).toBe(0);
      }
    });

    it("uses closed_at for month bucketing, falls back to created_at", () => {
      // Ticket closed in March but created in Jan → buckets into March
      const result = computeTechnicianOverview(
        makeInput({
          since: new Date("2026-01-01T00:00:00.000Z"),
          closedTickets: [
            ticket({
              created_at: "2026-01-10T10:00:00.000Z",
              closed_at: "2026-03-15T10:00:00.000Z",
            }),
          ],
        }),
      );

      expect(result.monthlyActivity[0].closedTickets).toBe(0); // Jan: 0
      expect(result.monthlyActivity[2].closedTickets).toBe(1); // Mar: 1
    });

    it("falls back to created_at when closed_at is null", () => {
      const result = computeTechnicianOverview(
        makeInput({
          since: new Date("2026-01-01T00:00:00.000Z"),
          closedTickets: [
            ticket({
              created_at: "2026-02-10T10:00:00.000Z",
              closed_at: null,
            }),
          ],
        }),
      );

      expect(result.monthlyActivity[1].closedTickets).toBe(1); // Feb
    });

    it("buckets interventions into the correct month by started_at", () => {
      const result = computeTechnicianOverview(
        makeInput({
          since: new Date("2026-01-01T00:00:00.000Z"),
          interventions: [
            intervention({
              started_at: "2026-01-10T10:00:00.000Z",
              duration_minutes: 180, // 3h
            }),
            intervention({
              started_at: "2026-03-15T10:00:00.000Z",
              duration_minutes: 300, // 5h
            }),
          ],
        }),
      );

      // 3h rounded to 1 decimal = 3.0
      expect(result.monthlyActivity[0].workedHours).toBe(3);
      expect(result.monthlyActivity[2].workedHours).toBe(5);
    });

    it("monthly workedHours rounds to 1 decimal", () => {
      const result = computeTechnicianOverview(
        makeInput({
          since: new Date("2026-01-01T00:00:00.000Z"),
          interventions: [
            intervention({
              started_at: "2026-01-10T10:00:00.000Z",
              duration_minutes: 50, // 0.8333... hours
            }),
          ],
        }),
      );

      expect(result.monthlyActivity[0].workedHours).toBe(0.8);
    });

    it("tickets outside the 6-month window are not counted", () => {
      // SINCE = Jan 2026 → window = Jan–Jun 2026
      // A ticket closed in Dec 2025 is before the window
      const result = computeTechnicianOverview(
        makeInput({
          since: new Date("2026-01-01T00:00:00.000Z"),
          closedTickets: [
            ticket({
              created_at: "2025-12-01T10:00:00.000Z",
              closed_at: "2025-12-15T10:00:00.000Z",
            }),
          ],
        }),
      );

      // Dec 2025 is not in the 6-month window → all months should be 0
      for (const m of result.monthlyActivity) {
        expect(m.closedTickets).toBe(0);
      }
    });

    it("all months start at 0 when no data", () => {
      const result = computeTechnicianOverview(makeInput());

      for (const m of result.monthlyActivity) {
        expect(m.closedTickets).toBe(0);
        expect(m.workedHours).toBe(0);
      }
    });
  });

  describe("badges", () => {
    describe("closer badge", () => {
      it("achieved when closedTickets >= 10", () => {
        const tickets = Array.from({ length: 10 }, (_, i) =>
          ticket({
            created_at: `2026-01-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
            closed_at: `2026-01-${String(i + 2).padStart(2, "0")}T10:00:00.000Z`,
          }),
        );

        const result = computeTechnicianOverview(
          makeInput({ closedTickets: tickets }),
        );

        const closer = result.badges.find((b) => b.key === "closer")!;
        expect(closer.achieved).toBe(true);
      });

      it("not achieved when closedTickets < 10", () => {
        const tickets = Array.from({ length: 9 }, (_, i) =>
          ticket({ created_at: `2026-01-0${i + 1}T10:00:00.000Z` }),
        );

        const result = computeTechnicianOverview(
          makeInput({ closedTickets: tickets }),
        );

        const closer = result.badges.find((b) => b.key === "closer")!;
        expect(closer.achieved).toBe(false);
      });

      it("not achieved with 0 tickets", () => {
        const result = computeTechnicianOverview(makeInput());
        expect(result.badges[0].achieved).toBe(false);
      });
    });

    describe("fast-resolver badge", () => {
      it("achieved when averageResolutionHours <= 48", () => {
        const result = computeTechnicianOverview(
          makeInput({
            closedTickets: [
              ticket({
                created_at: "2026-01-10T10:00:00.000Z",
                closed_at: "2026-01-12T10:00:00.000Z", // 48h
              }),
            ],
          }),
        );

        const badge = result.badges.find((b) => b.key === "fast-resolver")!;
        expect(badge.achieved).toBe(true);
      });

      it("not achieved when averageResolutionHours > 48", () => {
        const result = computeTechnicianOverview(
          makeInput({
            closedTickets: [
              ticket({
                created_at: "2026-01-10T10:00:00.000Z",
                closed_at: "2026-01-13T10:00:00.000Z", // 72h
              }),
            ],
          }),
        );

        const badge = result.badges.find((b) => b.key === "fast-resolver")!;
        expect(badge.achieved).toBe(false);
      });

      it("not achieved when averageResolutionHours is null (no tickets)", () => {
        const result = computeTechnicianOverview(makeInput());

        const badge = result.badges.find((b) => b.key === "fast-resolver")!;
        expect(badge.achieved).toBe(false);
      });
    });

    describe("time-tracker badge", () => {
      it("achieved when workedHours >= 20", () => {
        const result = computeTechnicianOverview(
          makeInput({
            interventions: [
              intervention({ duration_minutes: 1200 }), // 20h
            ],
          }),
        );

        const badge = result.badges.find((b) => b.key === "time-tracker")!;
        expect(badge.achieved).toBe(true);
      });

      it("not achieved when workedHours < 20", () => {
        const result = computeTechnicianOverview(
          makeInput({
            interventions: [
              intervention({ duration_minutes: 1140 }), // 19h
            ],
          }),
        );

        const badge = result.badges.find((b) => b.key === "time-tracker")!;
        expect(badge.achieved).toBe(false);
      });

      it("not achieved with 0 interventions", () => {
        const result = computeTechnicianOverview(makeInput());
        expect(result.badges[2].achieved).toBe(false);
      });
    });

    describe("badge metadata", () => {
      it("all badges have label, description, and key", () => {
        const result = computeTechnicianOverview(makeInput());

        for (const badge of result.badges) {
          expect(badge.key).toBeTruthy();
          expect(badge.label).toBeTruthy();
          expect(badge.description).toBeTruthy();
          expect(typeof badge.achieved).toBe("boolean");
        }
      });
    });
  });

  describe("edge cases", () => {
    it("handles empty input gracefully", () => {
      const result = computeTechnicianOverview(makeInput());

      expect(result.stats.closedTickets).toBe(0);
      expect(result.stats.averageResolutionHours).toBeNull();
      expect(result.stats.workedHours).toBe(0);
      expect(result.monthlyActivity).toHaveLength(6);
      expect(result.badges.every((b) => !b.achieved)).toBe(true);
    });

    it("handles tickets with null closed_at across all computations", () => {
      const result = computeTechnicianOverview(
        makeInput({
          since: new Date("2026-01-01T00:00:00.000Z"),
          closedTickets: [
            ticket({ created_at: "2026-01-10T10:00:00.000Z", closed_at: null }),
          ],
        }),
      );

      // Uses created_at as fallback for avg and month bucketing
      expect(result.stats.averageResolutionHours).toBe(0);
      expect(result.stats.closedTickets).toBe(1);
      expect(result.monthlyActivity[0].closedTickets).toBe(1);
    });

    it("handles intervention with 0 duration_minutes", () => {
      const result = computeTechnicianOverview(
        makeInput({
          interventions: [
            intervention({ duration_minutes: 0 }),
          ],
        }),
      );

      expect(result.stats.workedHours).toBe(0);
      for (const m of result.monthlyActivity) {
        expect(m.workedHours).toBe(0);
      }
    });
  });
});

// ── normalizeInitials ──────────────────────────────────────────────

describe("normalizeInitials", () => {
  it("extracts first letter of each word (max 2)", () => {
    expect(normalizeInitials("Marco Gastaldello")).toBe("MG");
    expect(normalizeInitials("Tecnico Demo")).toBe("TD");
  });

  it("handles single-word names — returns single initial", () => {
    expect(normalizeInitials("Marco")).toBe("M");
  });

  it("handles names with 3+ words — takes first 2 only", () => {
    expect(normalizeInitials("Marco Antonio Gastaldello")).toBe("MA");
  });

  it("always returns uppercase", () => {
    expect(normalizeInitials("marco gastaldello")).toBe("MG");
  });

  it("trims and collapses extra whitespace", () => {
    expect(normalizeInitials("  Marco   Gastaldello  ")).toBe("MG");
  });

  it("falls back to first 2 chars only when result is empty (whitespace)", () => {
    // The || fallback fires only when the piped result is falsy (empty string)
    expect(normalizeInitials("  ")).toBe("  ");
  });

  it("handles empty string gracefully", () => {
    expect(normalizeInitials("")).toBe("");
  });

  it("handles single character", () => {
    expect(normalizeInitials("A")).toBe("A");
  });
});
