import { renderHook, act, waitFor } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useAdminOAuthClients } from "@/hooks/useAdminOAuthClients";
import type { OAuthClientInfo, OAuthClientCreated } from "@/lib/oauth-consent";

// ── Mock server functions (oauth-consent) ──────────────────────────────
const serverFnMocks = vi.hoisted(() => ({
  listOAuthClients: vi.fn(),
  createOAuthClient: vi.fn(),
  setOAuthClientStatus: vi.fn(),
  rotateOAuthClientSecret: vi.fn(),
}));

vi.mock("@/lib/oauth-consent", () => ({
  listOAuthClients: serverFnMocks.listOAuthClients,
  createOAuthClient: serverFnMocks.createOAuthClient,
  setOAuthClientStatus: serverFnMocks.setOAuthClientStatus,
  rotateOAuthClientSecret: serverFnMocks.rotateOAuthClientSecret,
}));

// ── Mock useAdminOAuthLifecycle ────────────────────────────────────────
const lifecycleOpenLifecycle = vi.fn();
const lifecycleCloseLifecycle = vi.fn();

vi.mock("@/hooks/useAdminOAuthLifecycle", () => ({
  useAdminOAuthLifecycle: () => ({
    lifecycleOpenFor: null as string | null,
    lifecycleData: null,
    lifecycleLoading: false,
    openLifecycle: lifecycleOpenLifecycle,
    closeLifecycle: lifecycleCloseLifecycle,
  }),
}));

// ── Mock TanStack Start ────────────────────────────────────────────────
vi.mock("@tanstack/react-start", () => ({
  useServerFn: vi.fn((fn: unknown) => {
    if (fn === serverFnMocks.listOAuthClients) return serverFnMocks.listOAuthClients;
    if (fn === serverFnMocks.createOAuthClient) return serverFnMocks.createOAuthClient;
    if (fn === serverFnMocks.setOAuthClientStatus) return serverFnMocks.setOAuthClientStatus;
    if (fn === serverFnMocks.rotateOAuthClientSecret) return serverFnMocks.rotateOAuthClientSecret;
    return vi.fn();
  }),
}));

// ── Mock sonner ────────────────────────────────────────────────────────
const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMock }));

// ── Mock clipboard ─────────────────────────────────────────────────────
const clipboardWriteText = vi.fn();
const clipboardMock = { writeText: clipboardWriteText };

vi.stubGlobal("navigator", {
  ...globalThis.navigator,
  clipboard: clipboardMock,
});

// ── Factory helpers ────────────────────────────────────────────────────

function createClientInfo(overrides: Partial<OAuthClientInfo> = {}): OAuthClientInfo {
  return {
    clientId: "client-1",
    name: "My App",
    description: "A test client",
    scopesAllowed: ["pcready:read"],
    redirectUris: ["https://example.com/callback"],
    status: "active",
    lastUsedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function createClientCreated(
  overrides: Partial<OAuthClientCreated & { exampleRedirectUri: string }> = {},
): OAuthClientCreated & { exampleRedirectUri: string } {
  return {
    clientId: "client-new",
    clientSecret: "secret_new_abc",
    name: "New Client",
    description: "New description",
    scopesAllowed: ["pcready:read"],
    redirectUris: ["https://new.example.com/callback"],
    status: "active",
    lastUsedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    exampleRedirectUri: "https://new.example.com/callback",
    ...overrides,
  };
}

// ── Common args ────────────────────────────────────────────────────────
const adminAuth = { accessToken: "token-123", isAdmin: true };
const noAuth = { accessToken: undefined, isAdmin: false };
const userAuth = { accessToken: "token-123", isAdmin: false };

// ── Tests ──────────────────────────────────────────────────────────────

describe("useAdminOAuthClients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clipboardWriteText.mockReset();
    serverFnMocks.listOAuthClients.mockResolvedValue([createClientInfo()]);
    lifecycleOpenLifecycle.mockResolvedValue(undefined);
  });

  // ── Default state ────────────────────────────────────────────────────

  describe("default state", () => {
    it("starts with empty clients, loading true, and busy flags false", () => {
      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      expect(result.current.clients).toEqual([]);
      expect(result.current.loadingClients).toBe(true);
      expect(result.current.createClientBusy).toBe(false);
      expect(result.current.oauthCreated).toBeNull();
      expect(result.current.rotatedSecret).toBeNull();
      expect(result.current.actionBusyId).toBeNull();
      expect(typeof result.current.setOauthCreated).toBe("function");
      expect(typeof result.current.setRotatedSecret).toBe("function");
    });

    it("has a form with default values", () => {
      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      expect(result.current.oauthForm.getValues("name")).toBe("");
      expect(result.current.oauthForm.getValues("description")).toBeNull();
      expect(result.current.oauthForm.getValues("redirectUrisRaw")).toBe("");
      expect(result.current.oauthForm.getValues("scopesAllowed")).toEqual([]);
    });
  });

  // ── loadClients ─────────────────────────────────────────────────────

  describe("loadClients", () => {
    it("auto-loads clients on mount when admin", async () => {
      const clients = [
        createClientInfo({ clientId: "A", name: "App A" }),
        createClientInfo({ clientId: "B", name: "App B" }),
      ];
      serverFnMocks.listOAuthClients.mockResolvedValue(clients);

      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingClients).toBe(false);
      });

      expect(result.current.clients).toEqual(clients);
      expect(serverFnMocks.listOAuthClients).toHaveBeenCalledWith({
        data: { accessToken: "token-123" },
      });
    });

    it("skips auto-load when accessToken is undefined", async () => {
      renderHook(() => useAdminOAuthClients(noAuth));

      await new Promise((r) => setTimeout(r, 50));
      expect(serverFnMocks.listOAuthClients).not.toHaveBeenCalled();
    });

    it("skips auto-load when isAdmin is false", async () => {
      renderHook(() => useAdminOAuthClients(userAuth));

      await new Promise((r) => setTimeout(r, 50));
      expect(serverFnMocks.listOAuthClients).not.toHaveBeenCalled();
    });

    it("shows error toast on load failure", async () => {
      serverFnMocks.listOAuthClients.mockRejectedValue(new Error("Load failed"));

      renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(toastMock.error).toHaveBeenCalledWith("Load failed");
      });
    });

    it("manual loadClients refetches the list", async () => {
      const v1 = [createClientInfo({ clientId: "1", name: "V1" })];
      const v2 = [createClientInfo({ clientId: "2", name: "V2" })];
      serverFnMocks.listOAuthClients.mockResolvedValueOnce(v1).mockResolvedValueOnce(v2);

      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingClients).toBe(false);
      });
      expect(result.current.clients).toEqual(v1);

      await act(async () => {
        await result.current.loadClients();
      });

      expect(result.current.clients).toEqual(v2);
    });
  });

  // ── createNewClient ──────────────────────────────────────────────────

  describe("createNewClient", () => {
    const created = createClientCreated();

    beforeEach(() => {
      serverFnMocks.createOAuthClient.mockResolvedValue(created);
    });

    it("creates a client and shows success toast", async () => {
      const clientsBefore = [createClientInfo()];
      serverFnMocks.listOAuthClients.mockResolvedValue(clientsBefore);
      serverFnMocks.createOAuthClient.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(created), 50)),
      );

      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingClients).toBe(false);
      });

      // Fill form with valid data
      await act(async () => {
        result.current.oauthForm.setValue("name", "New App");
        result.current.oauthForm.setValue("redirectUrisRaw", "https://app.com/callback");
        result.current.oauthForm.setValue("scopesAllowed", ["pcready:read"]);
      });

      // Trigger submit without awaiting to check mid-flight busy state
      const v2 = [createClientInfo({ clientId: "2" })];
      serverFnMocks.listOAuthClients.mockResolvedValue(v2);

      act(() => {
        result.current.createNewClient();
      });

      await waitFor(() => {
        expect(result.current.createClientBusy).toBe(true);
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 100));
      });

      expect(serverFnMocks.createOAuthClient).toHaveBeenCalledWith({
        data: {
          accessToken: "token-123",
          name: "New App",
          description: undefined,
          redirectUris: ["https://app.com/callback"],
          scopesAllowed: ["pcready:read"],
        },
      });
      expect(toastMock.success).toHaveBeenCalledWith("Client OAuth creato");
      expect(result.current.oauthCreated).toMatchObject({
        clientId: created.clientId,
        clientSecret: created.clientSecret,
        exampleRedirectUri: "https://app.com/callback",
      });
      // createClientBusy should be cleared after operation
      expect(result.current.createClientBusy).toBe(false);
      // Form should be reset
      expect(result.current.oauthForm.getValues("name")).toBe("");
      expect(result.current.oauthForm.getValues("redirectUrisRaw")).toBe("");
      expect(result.current.oauthForm.getValues("scopesAllowed")).toEqual([]);
      // Clients should be reloaded
      expect(result.current.clients).toEqual(v2);
    });

    it("guards when accessToken is undefined", async () => {
      const { result } = renderHook(() => useAdminOAuthClients(noAuth));

      await act(async () => {
        result.current.oauthForm.setValue("name", "Test");
      });
      await act(async () => {
        await result.current.createNewClient();
      });

      expect(serverFnMocks.createOAuthClient).not.toHaveBeenCalled();
    });

    it("shows error toast on creation failure", async () => {
      serverFnMocks.createOAuthClient.mockRejectedValue(new Error("Creation failed"));
      serverFnMocks.listOAuthClients.mockResolvedValue([createClientInfo()]);

      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingClients).toBe(false);
      });

      await act(async () => {
        result.current.oauthForm.setValue("name", "Test");
        result.current.oauthForm.setValue("redirectUrisRaw", "https://test.com/cb");
      });
      await act(async () => {
        await result.current.createNewClient();
      });

      expect(toastMock.error).toHaveBeenCalledWith("Creation failed");
      expect(result.current.createClientBusy).toBe(false);
    });
  });

  // ── copyOAuthField ──────────────────────────────────────────────────

  describe("copyOAuthField", () => {
    it("copies text to clipboard and shows success toast", async () => {
      clipboardWriteText.mockResolvedValue(undefined);
      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await act(async () => {
        await result.current.copyOAuthField("Client ID", "my-client-id-123");
      });

      expect(clipboardWriteText).toHaveBeenCalledWith("my-client-id-123");
      expect(toastMock.success).toHaveBeenCalledWith("Client ID copiato negli appunti");
    });

    it("shows error toast when clipboard fails", async () => {
      clipboardWriteText.mockRejectedValue(new Error("Denied"));
      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await act(async () => {
        await result.current.copyOAuthField("Secret", "abc123");
      });

      expect(toastMock.error).toHaveBeenCalledWith(
        "Impossibile copiare. Seleziona il testo manualmente.",
      );
    });
  });

  // ── updateClientStatus ──────────────────────────────────────────────

  describe("updateClientStatus", () => {
    it("sets client status to active and shows success toast", async () => {
      serverFnMocks.setOAuthClientStatus.mockResolvedValue({ ok: true, status: "active" });
      const clients = [createClientInfo({ clientId: "abc", status: "disabled" })];
      serverFnMocks.listOAuthClients.mockResolvedValueOnce(clients);

      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingClients).toBe(false);
      });

      const reloaded = [createClientInfo({ clientId: "abc", status: "active" })];
      serverFnMocks.listOAuthClients.mockResolvedValue(reloaded);

      await act(async () => {
        await result.current.updateClientStatus("abc", "active");
      });

      expect(serverFnMocks.setOAuthClientStatus).toHaveBeenCalledWith({
        data: { accessToken: "token-123", clientId: "abc", nextStatus: "active" },
      });
      expect(toastMock.success).toHaveBeenCalledWith("Client riattivato");
      expect(result.current.actionBusyId).toBeNull();
    });

    it("sets client status to revoked and shows specific toast", async () => {
      serverFnMocks.setOAuthClientStatus.mockResolvedValue({ ok: true, status: "revoked" });
      serverFnMocks.listOAuthClients.mockResolvedValueOnce([createClientInfo()]);

      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingClients).toBe(false);
      });
      serverFnMocks.listOAuthClients.mockResolvedValue([createClientInfo({ status: "revoked" })]);

      await act(async () => {
        await result.current.updateClientStatus("abc", "revoked");
      });

      expect(toastMock.success).toHaveBeenCalledWith("Client revocato");
    });

    it("sets client status to disabled and shows specific toast", async () => {
      serverFnMocks.setOAuthClientStatus.mockResolvedValue({ ok: true, status: "disabled" });
      serverFnMocks.listOAuthClients.mockResolvedValueOnce([createClientInfo()]);

      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingClients).toBe(false);
      });
      serverFnMocks.listOAuthClients.mockResolvedValue([createClientInfo({ status: "disabled" })]);

      await act(async () => {
        await result.current.updateClientStatus("abc", "disabled");
      });

      expect(toastMock.success).toHaveBeenCalledWith("Client disattivato");
    });

    it("guards when accessToken is undefined", async () => {
      const { result } = renderHook(() => useAdminOAuthClients(noAuth));

      await act(async () => {
        await result.current.updateClientStatus("abc", "active");
      });

      expect(serverFnMocks.setOAuthClientStatus).not.toHaveBeenCalled();
    });

    it("shows error toast on status update failure", async () => {
      serverFnMocks.setOAuthClientStatus.mockRejectedValue(new Error("Status error"));
      serverFnMocks.listOAuthClients.mockResolvedValueOnce([createClientInfo()]);

      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingClients).toBe(false);
      });

      await act(async () => {
        await result.current.updateClientStatus("abc", "active");
      });

      expect(toastMock.error).toHaveBeenCalledWith("Status error");
      expect(result.current.actionBusyId).toBeNull();
    });
  });

  // ── rotateClientSecret ──────────────────────────────────────────────

  describe("rotateClientSecret", () => {
    const existingClient = createClientInfo({
      clientId: "abc",
      name: "My OAuth App",
      redirectUris: ["https://my.app/cb"],
    });

    it("rotates secret and stores result with exampleRedirectUri", async () => {
      serverFnMocks.rotateOAuthClientSecret.mockResolvedValue({
        clientId: "abc",
        clientSecret: "new-secret-xyz",
      });
      serverFnMocks.listOAuthClients.mockResolvedValueOnce([existingClient]);

      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingClients).toBe(false);
      });
      serverFnMocks.listOAuthClients.mockResolvedValue([existingClient]);

      await act(async () => {
        await result.current.rotateClientSecret("abc", "https://my.app/cb");
      });

      expect(serverFnMocks.rotateOAuthClientSecret).toHaveBeenCalledWith({
        data: { accessToken: "token-123", clientId: "abc" },
      });
      expect(toastMock.success).toHaveBeenCalledWith("Secret ruotato: copia il nuovo valore ora.");
      expect(result.current.rotatedSecret).toMatchObject({
        clientId: "abc",
        clientSecret: "new-secret-xyz",
        name: "My OAuth App",
        exampleRedirectUri: "https://my.app/cb",
      });
      expect(result.current.actionBusyId).toBeNull();
    });

    it("uses first redirectUri as exampleRedirectUri fallback", async () => {
      serverFnMocks.rotateOAuthClientSecret.mockResolvedValue({
        clientId: "abc",
        clientSecret: "new-secret-xyz",
      });
      serverFnMocks.listOAuthClients.mockResolvedValueOnce([existingClient]);

      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingClients).toBe(false);
      });
      serverFnMocks.listOAuthClients.mockResolvedValue([existingClient]);

      await act(async () => {
        await result.current.rotateClientSecret("abc", "");
      });

      expect(result.current.rotatedSecret?.exampleRedirectUri).toBe("https://my.app/cb");
    });

    it("guards when accessToken is undefined", async () => {
      const { result } = renderHook(() => useAdminOAuthClients(noAuth));

      await act(async () => {
        await result.current.rotateClientSecret("abc", "https://cb");
      });

      expect(serverFnMocks.rotateOAuthClientSecret).not.toHaveBeenCalled();
    });

    it("shows error toast on rotation failure", async () => {
      serverFnMocks.rotateOAuthClientSecret.mockRejectedValue(new Error("Rotation failed"));
      serverFnMocks.listOAuthClients.mockResolvedValueOnce([existingClient]);

      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      await waitFor(() => {
        expect(result.current.loadingClients).toBe(false);
      });

      await act(async () => {
        await result.current.rotateClientSecret("abc", "https://cb");
      });

      expect(toastMock.error).toHaveBeenCalledWith("Rotation failed");
      expect(result.current.actionBusyId).toBeNull();
    });
  });

  // ── lifecycle exposure ───────────────────────────────────────────────

  describe("lifecycle", () => {
    it("exposes the lifecycle object from useAdminOAuthLifecycle", () => {
      const { result } = renderHook(() => useAdminOAuthClients(adminAuth));

      expect(result.current.lifecycle).toBeDefined();
      expect(result.current.lifecycle.lifecycleOpenFor).toBeNull();
      expect(result.current.lifecycle.lifecycleData).toBeNull();
      expect(result.current.lifecycle.lifecycleLoading).toBe(false);
      expect(typeof result.current.lifecycle.openLifecycle).toBe("function");
      expect(typeof result.current.lifecycle.closeLifecycle).toBe("function");
    });
  });
});
