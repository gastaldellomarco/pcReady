// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { groupCardsByTechnician, groupCardsByClient, groupCardsByPriority, PRIORITY_ORDER, type SwimLaneCard, type SwimLaneGroupMode } from "@/components/kanban/SwimLaneView";
import type { TicketPriority, TicketStatus } from "@/lib/pcready";
import type { TechnicianOption } from "@/lib/technicians";

function makeCard(overrides: Partial<SwimLaneCard> = {}): SwimLaneCard {
  return {
    id: "c1",
    ticket_code: "T-001",
    client: "ACME",
    status: "pending" as TicketStatus,
    priority: "med" as TicketPriority,
    assignee_id: null,
    ...overrides,
  };
}

function makeTech(id: string, name: string): TechnicianOption {
  return { id, full_name: name, initials: name.split(" ").map(s => s[0]).join("") };
}

describe("groupCardsByTechnician", () => {
  it("pre-seeds technicians with empty arrays", () => {
    const techs = [makeTech("t1", "Marco"), makeTech("t2", "Anna")];
    const result = groupCardsByTechnician([], techs);
    expect(result.get("t1")).toEqual([]);
    expect(result.get("t2")).toEqual([]);
    expect(result.get(null)).toEqual([]);
  });

  it("groups cards by assignee_id", () => {
    const techs = [makeTech("t1", "Marco")];
    const cards = [
      makeCard({ id: "a", assignee_id: "t1" }),
      makeCard({ id: "b", assignee_id: "t1" }),
    ];
    const result = groupCardsByTechnician(cards, techs);
    expect(result.get("t1")).toHaveLength(2);
    expect(result.get(null)).toHaveLength(0);
  });

  it("puts unassigned cards in null bucket", () => {
    const techs = [makeTech("t1", "Marco")];
    const cards = [makeCard({ id: "a", assignee_id: null })];
    const result = groupCardsByTechnician(cards, techs);
    expect(result.get(null)).toHaveLength(1);
    expect(result.get("t1")).toHaveLength(0);
  });

  it("handles unknown assignee IDs", () => {
    const techs = [makeTech("t1", "Marco")];
    const cards = [makeCard({ id: "a", assignee_id: "t99" })];
    const result = groupCardsByTechnician(cards, techs);
    expect(result.get("t99")).toHaveLength(1);
  });
});

describe("groupCardsByClient", () => {
  it("groups cards by client name", () => {
    const cards = [
      makeCard({ id: "a", client: "ACME" }),
      makeCard({ id: "b", client: "ACME" }),
      makeCard({ id: "c", client: "Beta" }),
    ];
    const result = groupCardsByClient(cards);
    expect(result.get("ACME")).toHaveLength(2);
    expect(result.get("Beta")).toHaveLength(1);
  });

  it("uses 'Nessun cliente' for empty client", () => {
    const cards = [makeCard({ id: "a", client: "" })];
    const result = groupCardsByClient(cards);
    expect(result.get("Nessun cliente")).toHaveLength(1);
  });

  it("returns empty map for empty cards", () => {
    const result = groupCardsByClient([]);
    expect(result.size).toBe(0);
  });
});

describe("groupCardsByPriority", () => {
  it("pre-seeds all priorities with empty arrays", () => {
    const result = groupCardsByPriority([]);
    expect(result.get("high")).toEqual([]);
    expect(result.get("med")).toEqual([]);
    expect(result.get("low")).toEqual([]);
  });

  it("groups cards by priority", () => {
    const cards = [
      makeCard({ id: "a", priority: "high" }),
      makeCard({ id: "b", priority: "high" }),
      makeCard({ id: "c", priority: "low" }),
    ];
    const result = groupCardsByPriority(cards);
    expect(result.get("high")).toHaveLength(2);
    expect(result.get("med")).toHaveLength(0);
    expect(result.get("low")).toHaveLength(1);
  });
});

describe("PRIORITY_ORDER", () => {
  it("contains high, med, low in that order", () => {
    expect(PRIORITY_ORDER).toEqual(["high", "med", "low"]);
  });

  it("has exactly 3 elements", () => {
    expect(PRIORITY_ORDER).toHaveLength(3);
  });

  it("is immutable readonly order", () => {
    // verify order is canonical: high first, low last
    expect(PRIORITY_ORDER[0]).toBe("high");
    expect(PRIORITY_ORDER[2]).toBe("low");
  });
});

describe("SwimLaneGroupMode", () => {
  it("accepts the three valid modes", () => {
    const modes: SwimLaneGroupMode[] = ["technician", "client", "priority"];
    expect(modes).toHaveLength(3);
  });
});
