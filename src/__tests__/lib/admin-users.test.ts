import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      getUser: (...args: unknown[]) => authMocks.getUser(...args),
    },
    rpc: vi.fn(() => Promise.resolve({ data: true, error: null })),
  },
}));

describe("admin-users.server requireAdmin", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    authMocks.getUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: true, error: null } as never);
  });

  it("rejects invalid token", async () => {
    authMocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("bad") });
    const { requireAdmin } = await import("@/lib/admin-users.server");
    await expect(requireAdmin("token")).rejects.toSatisfy(
      (e: unknown) => e instanceof Response && e.status === 401,
    );
  });

  it("rejects when user lacks admin role", async () => {
    authMocks.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: false, error: null } as never);
    const { requireAdmin } = await import("@/lib/admin-users.server");
    await expect(requireAdmin("good-token")).rejects.toSatisfy(
      (e: unknown) => e instanceof Response && e.status === 403,
    );
  });

  it("returns user id for admin session", async () => {
    authMocks.getUser.mockResolvedValueOnce({
      data: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
      error: null,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    vi.mocked(supabaseAdmin.rpc).mockResolvedValueOnce({ data: true, error: null } as never);
    const { requireAdmin } = await import("@/lib/admin-users.server");
    await expect(requireAdmin("good-token")).resolves.toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });
});
