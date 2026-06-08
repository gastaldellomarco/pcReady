import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  versions: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
    },
    from(table: string) {
      expect(table).toBe("entity_versions");
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: db.versions.length
            ? [
                {
                  version_number: Math.max(...db.versions.map((row) => Number(row.version_number))),
                },
              ]
            : [],
          error: null,
        }),
        insert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          db.versions.push(payload);
          return Promise.resolve({ error: null });
        }),
      };
    },
  },
}));

describe("versioning", () => {
  beforeEach(() => {
    db.versions = [];
    vi.resetModules();
  });

  it("creates a version snapshot with the next version number", async () => {
    const { createVersionSnapshot } = await import("@/lib/versioning");

    await expect(
      createVersionSnapshot({
        entityType: "tickets",
        entityId: "ticket-1",
        operation: "create",
        snapshot: { status: "pending" },
        userId: "user-1",
      }),
    ).resolves.toBe(1);

    expect(db.versions[0]).toMatchObject({
      entity_type: "tickets",
      entity_id: "ticket-1",
      version_number: 1,
      operation: "create",
    });
  });

  it("computes changed fields between versions", async () => {
    const { computeChangedFields } = await import("@/lib/versioning");

    expect(computeChangedFields({ status: "pending" }, { status: "ready", model: "M1" })).toEqual({
      status: { from: "pending", to: "ready" },
      model: { from: undefined, to: "M1" },
    });
  });

  it("marks all keys as added when previous is null", async () => {
    const { computeChangedFields } = await import("@/lib/versioning");

    // null previous means all current keys are new
    expect(computeChangedFields(null, { a: 1, b: 2 })).toEqual({
      a: { from: undefined, to: 1 },
      b: { from: undefined, to: 2 },
    });
  });

  it("returns empty object when values are identical", async () => {
    const { computeChangedFields } = await import("@/lib/versioning");

    expect(computeChangedFields({ a: 1, b: "x" }, { a: 1, b: "x" })).toEqual({});
  });

  it("detects removed keys", async () => {
    const { computeChangedFields } = await import("@/lib/versioning");

    expect(computeChangedFields({ a: 1, b: 2 }, { a: 1 })).toEqual({
      b: { from: 2, to: undefined },
    });
  });

  it("detects nested object changes via deep comparison", async () => {
    const { computeChangedFields } = await import("@/lib/versioning");

    expect(
      computeChangedFields(
        { config: { debug: true, timeout: 30 } },
        { config: { debug: true, timeout: 60 } },
      ),
    ).toEqual({
      config: { from: { debug: true, timeout: 30 }, to: { debug: true, timeout: 60 } },
    });
  });

  it("treats structurally equal objects as unchanged", async () => {
    const { computeChangedFields } = await import("@/lib/versioning");

    // JSON.stringify-equivalent but different references
    expect(
      computeChangedFields({ items: [1, 2, 3] }, { items: [1, 2, 3] }),
    ).toEqual({});
  });

  it("handles empty objects on both sides", async () => {
    const { computeChangedFields } = await import("@/lib/versioning");

    expect(computeChangedFields({}, {})).toEqual({});
  });

  it("detects all keys as added when previous is empty", async () => {
    const { computeChangedFields } = await import("@/lib/versioning");

    expect(computeChangedFields({}, { name: "test", lang: "bash" })).toEqual({
      name: { from: undefined, to: "test" },
      lang: { from: undefined, to: "bash" },
    });
  });
});
