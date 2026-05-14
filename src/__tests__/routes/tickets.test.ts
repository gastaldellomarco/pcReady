import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: (...args: unknown[]) => maybeSingle(...args),
    })),
  },
}));

describe("queries/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchTicketById returns null when no row is found", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const { fetchTicketById } = await import("@/lib/queries/tickets");
    await expect(fetchTicketById("missing-id")).resolves.toBeNull();
  });

  it("fetchTicketById returns ticket payload", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: { id: "t1", ticket_code: "PC-100", client: "Acme" },
      error: null,
    });
    const { fetchTicketById } = await import("@/lib/queries/tickets");
    const row = await fetchTicketById("t1");
    expect(row).toMatchObject({ id: "t1", ticket_code: "PC-100", client: "Acme" });
  });
});
