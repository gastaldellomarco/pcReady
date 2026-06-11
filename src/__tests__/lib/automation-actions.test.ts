// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────

const mockState = vi.hoisted(() => ({
  ticketRow: null as Record<string, unknown> | null,
  ticketError: null as Error | null,
  deviceBefore: null as Record<string, unknown> | null,
  deviceAfter: null as Record<string, unknown> | null,
  deviceError: null as Error | null,
  notificationRow: null as Record<string, unknown> | null,
  notificationError: null as Error | null,
}));

function chainableSingle(result: unknown, error: Error | null = null) {
  return {
    maybeSingle: vi.fn(() => Promise.resolve({ data: result, error })),
    single: vi.fn(() => Promise.resolve({ data: result, error })),
  };
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "tickets") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() =>
                chainableSingle(mockState.ticketRow, mockState.ticketError),
              ),
            })),
          })),
        };
      }
      if (table === "devices") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() =>
              chainableSingle(mockState.deviceBefore, mockState.deviceError),
            ),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() =>
                chainableSingle(mockState.deviceAfter, mockState.deviceError),
              ),
            })),
          })),
        };
      }
      if (table === "notifications") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() =>
              chainableSingle(mockState.notificationRow, mockState.notificationError),
            ),
          })),
        };
      }
      return {};
    }),
  },
}));

vi.mock("@/lib/email-templates.server", () => ({
  sendEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/notifications.server", () => ({
  notifyDeviceStatusChangedForAdmins: vi.fn(() => Promise.resolve()),
}));

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

// ── Test Data ────────────────────────────────────────────────────────

const triggeredBy = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ticketId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const deviceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const missingId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function makeAction(overrides: Record<string, unknown> = {}) {
  return {
    type: "send_email",
    label: "Test Action",
    config: {},
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("automation-actions.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.ticketRow = null;
    mockState.ticketError = null;
    mockState.deviceBefore = null;
    mockState.deviceAfter = null;
    mockState.deviceError = null;
    mockState.notificationRow = null;
    mockState.notificationError = null;
    mockFetch.mockReset();
  });

  // ── executeAction: delay ──────────────────────────────────────────

  describe("executeAction — delay", () => {
    it("returns success with computed delay_ms", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "delay",
          label: "Aspetta 2 ore",
          config: { amount: 2, unit: "hours" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("success");
      expect(result.details).toMatchObject({ amount: 2, unit: "hours" });
      expect((result.details as any).delay_ms).toBe(2 * 3_600_000);
    });

    it("returns success for delay in days", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "delay",
          label: "Aspetta 1 giorno",
          config: { amount: 1, unit: "days" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("success");
      expect((result.details as any).delay_ms).toBe(86_400_000);
    });

    it("returns error for invalid delay config (negative amount)", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "delay",
          label: "Aspetta -1",
          config: { amount: -1, unit: "hours" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
      expect(result.error).toBeTruthy();
    });

    it("normalizes 'Aspetta' to delay", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "Aspetta",
          label: "Aspetta",
          config: { amount: 5, unit: "hours" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("success");
      expect((result.details as any).amount).toBe(5);
    });
  });

  // ── executeAction: force_error ─────────────────────────────────────

  describe("executeAction — force_error", () => {
    it("skips execution when config.force_error is set", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "send_email",
          label: "Email con errore",
          config: { force_error: true },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("simulato");
    });

    it("skips execution when action.force_error is set", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        {
          type: "send_email",
          label: "Email con errore",
          force_error: true,
        },
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("simulato");
    });
  });

  // ── executeAction: create_ticket ───────────────────────────────────

  describe("executeAction — not yet implemented types", () => {
    it("returns skipped for create_ticket (not implemented)", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({ type: "create_ticket", label: "Crea ticket" }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("skipped");
      expect(result.error).toContain("non ancora implementato");
    });

    it("returns skipped for unsupported action type", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({ type: "unknown_XYZ", label: "Azione sconosciuta" }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("skipped");
      expect(result.error).toContain("non supportato");
      expect((result.details as any).normalized_type).toBe("unknown_XYZ");
    });
  });

  // ── executeAction: update_ticket_status ────────────────────────────

  describe("executeAction — update_ticket_status", () => {
    it("returns success when ticket is updated", async () => {
      mockState.ticketRow = { id: ticketId, status: "in-progress" };
      const { executeAction } = await import("@/lib/automation-actions.server");

      const result = await executeAction(
        makeAction({
          type: "update_ticket_status",
          label: "Aggiorna stato ticket",
          config: { ticket_id: ticketId, status: "in-progress" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("success");
      expect(result.details).toMatchObject({ ticket_id: ticketId, status: "in-progress" });
    });

    it("returns error when ticket_id is missing", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "update_ticket_status",
          label: "Aggiorna stato ticket",
          config: { status: "in-progress" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("ticket_id mancante");
    });

    it("resolves ticket_id from trigger payload fallback", async () => {
      mockState.ticketRow = { id: ticketId, status: "testing" };
      const { executeAction } = await import("@/lib/automation-actions.server");

      const result = await executeAction(
        makeAction({
          type: "update_ticket_status",
          label: "Aggiorna stato ticket",
          config: { status: "testing" },
        }),
        0,
        triggeredBy,
        { ticket_id: ticketId },
      );

      expect(result.status).toBe("success");
      expect(result.details).toMatchObject({ ticket_id: ticketId });
    });

    it("normalizes 'update_status' to update_ticket_status", async () => {
      mockState.ticketRow = { id: ticketId, status: "ready" };
      const { executeAction } = await import("@/lib/automation-actions.server");

      const result = await executeAction(
        makeAction({
          type: "update_status",
          label: "Aggiorna stato",
          config: { ticket_id: ticketId, status: "ready" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("success");
    });

    it("returns error when Supabase returns error", async () => {
      mockState.ticketError = new Error("DB down");
      const { executeAction } = await import("@/lib/automation-actions.server");

      const result = await executeAction(
        makeAction({
          type: "update_ticket_status",
          label: "Aggiorna stato ticket",
          config: { ticket_id: ticketId, status: "in-progress" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
      expect(result.error).toBe("DB down");
    });
  });

  // ── executeAction: assign_ticket ────────────────────────────────────

  describe("executeAction — assign_ticket", () => {
    it("returns success when ticket is assigned", async () => {
      mockState.ticketRow = { id: ticketId, assignee_id: userId };
      const { executeAction } = await import("@/lib/automation-actions.server");

      const result = await executeAction(
        makeAction({
          type: "assign_ticket",
          label: "Assegna ticket",
          config: { ticket_id: ticketId, assignee_id: userId },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("success");
      expect(result.details).toMatchObject({ ticket_id: ticketId, assignee_id: userId });
    });

    it("normalizes 'assign_technician' to assign_ticket", async () => {
      mockState.ticketRow = { id: ticketId, assignee_id: userId };
      const { executeAction } = await import("@/lib/automation-actions.server");

      const result = await executeAction(
        makeAction({
          type: "assign_technician",
          label: "Assegna tecnico",
          config: { ticket_id: ticketId, assignee_id: userId },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("success");
    });

    it("returns error without assignee_id", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "assign_ticket",
          label: "Assegna ticket",
          config: { ticket_id: ticketId },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
    });

    it("returns error when Supabase returns error", async () => {
      mockState.ticketError = new Error("DB down");
      const { executeAction } = await import("@/lib/automation-actions.server");

      const result = await executeAction(
        makeAction({
          type: "assign_ticket",
          label: "Assegna ticket",
          config: { ticket_id: ticketId, assignee_id: userId },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
      expect(result.error).toBe("DB down");
    });
  });

  // ── executeAction: create_notification ─────────────────────────────

  describe("executeAction — create_notification", () => {
    it("returns success with notification created", async () => {
      mockState.notificationRow = {
        id: "notif-1",
        user_id: userId,
        type: "ticket_status_changed",
      };
      const { executeAction } = await import("@/lib/automation-actions.server");

      const result = await executeAction(
        makeAction({
          type: "create_notification",
          label: "Notifica utente",
          config: { user_id: userId, title: "Test notifica" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("success");
      expect(result.details).toMatchObject({ notification_id: "notif-1" });
    });

    it("resolves user_id from trigger payload assignee_id", async () => {
      mockState.notificationRow = {
        id: "notif-2",
        user_id: userId,
        type: "ticket_status_changed",
      };
      const { executeAction } = await import("@/lib/automation-actions.server");

      const result = await executeAction(
        makeAction({
          type: "create_notification",
          label: "Notifica",
          config: { title: "Test" },
        }),
        0,
        triggeredBy,
        { assignee_id: userId },
      );

      expect(result.status).toBe("success");
      expect(result.details).toMatchObject({ user_id: userId });
    });

    it("returns error when user_id is missing", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "create_notification",
          label: "Notifica",
          config: { title: "Test" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("user_id mancante");
    });

    it("returns error when title is missing", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "create_notification",
          label: "Notifica",
          config: { user_id: userId },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
    });
  });

  // ── executeAction: send_email ──────────────────────────────────────

  describe("executeAction — send_email", () => {
    it("returns success when email is sent", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "send_email",
          label: "Invia email",
          config: {
            to: "test@example.com",
            subject: "Oggetto test",
            body: "Corpo email",
          },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("success");
      expect(result.details).toMatchObject({ channel: "smtp", to: "test@example.com" });
    });

    it("returns error when recipient is missing", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "send_email",
          label: "Invia email",
          config: { subject: "Test", body: "Body" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("Destinatario");
    });

    it("returns error when subject is missing", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "send_email",
          label: "Invia email",
          config: { to: "test@example.com", body: "Body" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
    });

    it("resolves recipient from trigger payload", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "send_email",
          label: "Invia email",
          config: { subject: "Oggetto", body: "Corpo" },
        }),
        0,
        triggeredBy,
        { customer_email: "customer@example.com" },
      );

      expect(result.status).toBe("success");
      expect(result.details).toMatchObject({ to: "customer@example.com" });
    });
  });

  // ── executeAction: update_device_status ────────────────────────────

  describe("executeAction — update_device_status", () => {
    it("returns success when device status is updated", async () => {
      mockState.deviceBefore = {
        id: deviceId,
        model: "Test Device",
        serial: "SN-001",
        status: "available",
      };
      mockState.deviceAfter = {
        id: deviceId,
        model: "Test Device",
        serial: "SN-001",
        status: "maintenance",
      };
      const { executeAction } = await import("@/lib/automation-actions.server");

      const result = await executeAction(
        makeAction({
          type: "update_device_status",
          label: "Cambia stato dispositivo",
          config: { device_id: deviceId, status: "maintenance" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("success");
      expect(result.details).toMatchObject({ device_id: deviceId, status: "maintenance" });
    });

    it("returns error when device_id is missing", async () => {
      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "update_device_status",
          label: "Cambia stato dispositivo",
          config: { status: "maintenance" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("device_id mancante");
    });

    it("returns error when device not found", async () => {
      mockState.deviceBefore = null;
      const { executeAction } = await import("@/lib/automation-actions.server");

      const result = await executeAction(
        makeAction({
          type: "update_device_status",
          label: "Cambia stato dispositivo",
          config: { device_id: missingId, status: "maintenance" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("error");
      expect(result.error).toBe("Dispositivo non trovato");
    });
  });

  // ── webhookAction ──────────────────────────────────────────────────

  describe("webhookAction", () => {
    it("returns error for invalid URL config", async () => {
      const { webhookAction } = await import("@/lib/automation-actions.server");
      const result = await webhookAction(
        { url: "not-a-url" },
        {},
        "Webhook test",
      );

      expect(result.status).toBe("error");
    });

    it("returns error for empty config (missing url)", async () => {
      const { webhookAction } = await import("@/lib/automation-actions.server");
      const result = await webhookAction(
        {},
        {},
        "Webhook test",
      );

      expect(result.status).toBe("error");
    });

    it("returns error for non http/https protocol", async () => {
      const { webhookAction } = await import("@/lib/automation-actions.server");
      const result = await webhookAction(
        { url: "ftp://example.com/webhook" },
        {},
        "Webhook test",
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("Protocollo non consentito");
    });

    it("returns error when allowlist rejects the host", async () => {
      vi.stubEnv("ALLOWED_WEBHOOK_HOSTS", "trusted.com");
      const { webhookAction } = await import("@/lib/automation-actions.server");

      const result = await webhookAction(
        { url: "https://evil.com/hook" },
        {},
        "Webhook test",
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("allowlist");

      vi.stubEnv("ALLOWED_WEBHOOK_HOSTS", "");
    });

    it("returns error for invalid JSON payload", async () => {
      const { webhookAction } = await import("@/lib/automation-actions.server");
      const result = await webhookAction(
        { url: "https://example.com/hook", payload: "not {{json" },
        {},
        "Webhook test",
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("JSON");
    });

    it("returns success for valid webhook call", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"ok":true}'),
      });

      const { webhookAction } = await import("@/lib/automation-actions.server");
      const result = await webhookAction(
        { url: "https://example.com/hook" },
        {},
        "Webhook success",
      );

      expect(result.status).toBe("success");
      expect(result.details).toMatchObject({ status: 200 });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/hook",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns error when webhook responds with HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      const { webhookAction } = await import("@/lib/automation-actions.server");
      const result = await webhookAction(
        { url: "https://example.com/hook" },
        {},
        "Webhook fail",
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("HTTP 500");
    });

    it("replaces template variables in payload", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("ok"),
      });

      const { webhookAction } = await import("@/lib/automation-actions.server");
      await webhookAction(
        {
          url: "https://example.com/hook",
          payload: '{"trigger":"{{trigger}}","ticket":"{{ticket_id}}"}',
        },
        { ticket_id: "TKT-001", _automation_trigger: "manual_run" },
        "Webhook templated",
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.trigger).toBe("manual_run");
      expect(body.ticket).toBe("TKT-001");
    });

    it("uses triggerPayload as body when no custom payload string", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("ok"),
      });

      const { webhookAction } = await import("@/lib/automation-actions.server");
      await webhookAction(
        { url: "https://example.com/hook" },
        { foo: "bar", ticket_id: "TKT-002" },
        "Webhook passthrough",
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.foo).toBe("bar");
      expect(body.ticket_id).toBe("TKT-002");
    });
  });

  // ── isPrivateIP ────────────────────────────────────────────────────

  describe("isPrivateIP", () => {
    it("detects loopback", async () => {
      const { isPrivateIP } = await import("@/lib/automation-actions.server");
      expect(isPrivateIP("127.0.0.1")).toBe(true);
      expect(isPrivateIP("::1")).toBe(true);
    });

    it("detects private ranges", async () => {
      const { isPrivateIP } = await import("@/lib/automation-actions.server");
      expect(isPrivateIP("10.0.0.1")).toBe(true);
      expect(isPrivateIP("192.168.1.1")).toBe(true);
      expect(isPrivateIP("172.16.0.1")).toBe(true);
    });

    it("returns false for public IPs", async () => {
      const { isPrivateIP } = await import("@/lib/automation-actions.server");
      expect(isPrivateIP("8.8.8.8")).toBe(false);
      expect(isPrivateIP("1.1.1.1")).toBe(false);
    });

    it("returns false for invalid IP strings", async () => {
      const { isPrivateIP } = await import("@/lib/automation-actions.server");
      expect(isPrivateIP("not-an-ip")).toBe(false);
      expect(isPrivateIP("")).toBe(false);
    });
  });

  // ── action normalization in executeAction ──────────────────────────

  describe("executeAction — type normalization", () => {
    it("normalizes Webhook to send_webhook", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve("ok"),
      });

      const { executeAction } = await import("@/lib/automation-actions.server");
      const result = await executeAction(
        makeAction({
          type: "Webhook",
          label: "Webhook normale",
          config: { url: "https://example.com/hook" },
        }),
        0,
        triggeredBy,
        {},
      );

      expect(result.status).toBe("success");
    });
  });
});
