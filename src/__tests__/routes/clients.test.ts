import { beforeEach, describe, expect, it, vi } from "vitest";

const rangeResult = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "client_contacts") {
        return {
          select: vi.fn(() => ({
            ilike: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        };
      }
      const builder = {
        select: vi.fn(function (this: typeof builder) {
          return this;
        }),
        order: vi.fn(function (this: typeof builder) {
          return this;
        }),
        or: vi.fn(function (this: typeof builder) {
          return this;
        }),
        range: vi.fn(() => rangeResult()),
      };
      return builder;
    }),
  },
}));

describe("queries/clients fetchClientsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rangeResult.mockResolvedValue({
      data: [{ id: "c1", name: "Acme", company_name: null }],
      count: 1,
      error: null,
    });
  });

  it("returns paginated rows and count", async () => {
    const { fetchClientsList } = await import("@/lib/queries/clients");
    const out = await fetchClientsList({ page: 0, pageSize: 50 });
    expect(out.count).toBe(1);
    expect(out.data).toHaveLength(1);
    expect(out.data[0]).toMatchObject({ id: "c1", name: "Acme" });
  });
});
