// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAdminOAuthLifecycle } from "@/hooks/useAdminOAuthLifecycle";
import type { OAuthClientLifecyclePayload } from "@/lib/oauth-consent";

// ── Mock @/lib/oauth-consent ───────────────────────────────────────────
const serverFnMocks = vi.hoisted(() => ({
  getOAuthClientLifecycle: vi.fn(),
}));

vi.mock("@/lib/oauth-consent", () => ({
  getOAuthClientLifecycle: serverFnMocks.getOAuthClientLifecycle,
}));

// ── Mock useServerFn (TanStack Start) ───────────────────────────────────
vi.mock("@tanstack/react-start", () => ({
  useServerFn: vi.fn((fn: unknown) => {
    if (fn === serverFnMocks.getOAuthClientLifecycle)
      return serverFnMocks.getOAuthClientLifecycle;
    return vi.fn();
  }),
}));

// ── Mock sonner ─────────────────────────────────────────────────────────
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

// ── Factory helpers ─────────────────────────────────────────────────────

function createLifecyclePayload(
  overrides: Partial<OAuthClientLifecyclePayload> = {},
): OAuthClientLifecyclePayload {
  return {
    consents: [],
    authorizationEvents: [],
    adminEvents: [],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("useAdminOAuthLifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("default state", () => {
    it("starts with all state at default values", () => {
      const { result } = renderHook(() =>
        useAdminOAuthLifecycle({ accessToken: undefined }),
      );

      expect(result.current.lifecycleOpenFor).toBeNull();
      expect(result.current.lifecycleData).toBeNull();
      expect(result.current.lifecycleLoading).toBe(false);
    });
  });

  describe("openLifecycle", () => {
    const payload = createLifecyclePayload({
      consents: [{ userId: "u1", userName: null, scopesGranted: ["pcready:read"], grantedAt: "2026-01-01", revokedAt: null, expiresAt: null }],
      adminEvents: [{ id: "ev1", message: "Created", actionType: "create", createdAt: "2026-01-01", actorId: null }],
    });

    it("fetches lifecycle data for a given client and sets state", async () => {
      serverFnMocks.getOAuthClientLifecycle.mockResolvedValue(payload);

      const { result } = renderHook(() =>
        useAdminOAuthLifecycle({ accessToken: "token-123" }),
      );

      await act(async () => {
        await result.current.openLifecycle("client-abc");
      });

      expect(result.current.lifecycleOpenFor).toBe("client-abc");
      expect(result.current.lifecycleData).toEqual(payload);
      expect(result.current.lifecycleLoading).toBe(false);
      expect(serverFnMocks.getOAuthClientLifecycle).toHaveBeenCalledWith({
        data: { accessToken: "token-123", clientId: "client-abc" },
      });
    });

    it("does nothing when accessToken is undefined", async () => {
      const { result } = renderHook(() =>
        useAdminOAuthLifecycle({ accessToken: undefined }),
      );

      await act(async () => {
        await result.current.openLifecycle("client-abc");
      });

      expect(result.current.lifecycleOpenFor).toBeNull();
      expect(serverFnMocks.getOAuthClientLifecycle).not.toHaveBeenCalled();
    });

    it("clears previous lifecycleData before fetching new data", async () => {
      const firstPayload = createLifecyclePayload({ adminEvents: [{ id: "old", message: "Old", actionType: null, createdAt: "2026-01-01", actorId: null }] });
      const secondPayload = createLifecyclePayload({ adminEvents: [{ id: "new", message: "New", actionType: null, createdAt: "2026-01-01", actorId: null }] });

      serverFnMocks.getOAuthClientLifecycle
        .mockResolvedValueOnce(firstPayload)
        .mockResolvedValueOnce(secondPayload);

      const { result } = renderHook(() =>
        useAdminOAuthLifecycle({ accessToken: "token-123" }),
      );

      // First call
      await act(async () => {
        await result.current.openLifecycle("client-1");
      });
      expect(result.current.lifecycleData).toEqual(firstPayload);

      // Second call — previous data should be cleared
      await act(async () => {
        await result.current.openLifecycle("client-2");
      });
      expect(result.current.lifecycleData).toEqual(secondPayload);
    });

    it("sets lifecycleLoading to true during fetch", async () => {
      serverFnMocks.getOAuthClientLifecycle.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(payload), 100)),
      );

      const { result } = renderHook(() =>
        useAdminOAuthLifecycle({ accessToken: "token-123" }),
      );

      act(() => {
        result.current.openLifecycle("client-abc");
      });

      expect(result.current.lifecycleLoading).toBe(true);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 200));
      });

      expect(result.current.lifecycleLoading).toBe(false);
    });

    it("shows toast error and resets lifecycleOpenFor on failure", async () => {
      serverFnMocks.getOAuthClientLifecycle.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() =>
        useAdminOAuthLifecycle({ accessToken: "token-123" }),
      );

      await act(async () => {
        await result.current.openLifecycle("client-abc");
      });

      expect(toastMock.error).toHaveBeenCalledWith("Network error");
      expect(result.current.lifecycleOpenFor).toBeNull();
      expect(result.current.lifecycleLoading).toBe(false);
    });

    it("handles non-Error rejection with fallback message", async () => {
      serverFnMocks.getOAuthClientLifecycle.mockRejectedValue(null);

      const { result } = renderHook(() =>
        useAdminOAuthLifecycle({ accessToken: "token-123" }),
      );

      await act(async () => {
        await result.current.openLifecycle("client-abc");
      });

      expect(toastMock.error).toHaveBeenCalledWith(
        "Impossibile caricare lo storico",
      );
    });
  });

  describe("closeLifecycle", () => {
    it("resets lifecycleOpenFor and lifecycleData to null", async () => {
      serverFnMocks.getOAuthClientLifecycle.mockResolvedValue(
        createLifecyclePayload(),
      );

      const { result } = renderHook(() =>
        useAdminOAuthLifecycle({ accessToken: "token-123" }),
      );

      await act(async () => {
        await result.current.openLifecycle("client-abc");
      });
      expect(result.current.lifecycleOpenFor).toBe("client-abc");
      expect(result.current.lifecycleData).not.toBeNull();

      act(() => {
        result.current.closeLifecycle();
      });

      expect(result.current.lifecycleOpenFor).toBeNull();
      expect(result.current.lifecycleData).toBeNull();
    });

    it("does not throw when nothing is open", () => {
      const { result } = renderHook(() =>
        useAdminOAuthLifecycle({ accessToken: undefined }),
      );

      act(() => {
        result.current.closeLifecycle();
      });

      expect(result.current.lifecycleOpenFor).toBeNull();
      expect(result.current.lifecycleData).toBeNull();
    });
  });
});
