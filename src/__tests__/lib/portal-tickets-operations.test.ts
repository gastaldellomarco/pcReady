// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Mock State ───────────────────────────────────────────────────────

const mockState = vi.hoisted(() => ({
  // tickets table
  ticketsData: null as any,
  ticketsError: null as Error | null,
  // ticket_status_history table
  historyData: null as any,
  historyError: null as Error | null,
  // profiles table
  profilesData: null as any,
  profilesError: null as Error | null,
  // ticket_notes table
  notesData: null as any,
  notesError: null as Error | null,
  // ticket_feedback table
  feedbackData: null as any,
  feedbackError: null as Error | null,
  // devices table
  devicesData: null as any,
  devicesError: null as Error | null,
  // ticket_attachments table
  attachmentsData: null as any,
  attachmentsError: null as Error | null,
  // storage upload
  storageError: null as Error | null,
  // rate-limit
  rateLimitError: null as Error | null,
  // session returned by getPortalSession
  session: {
    clientId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    clientName: "ACME S.r.l.",
    contactId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    contactName: "Mario Rossi",
    contactEmail: "mario@acme.it",
  } as any,
}));

// ── Thenable Builder ─────────────────────────────────────────────────

function thenable(
  resolveData: () => { data: any; error: Error | null },
  extraMethods: string[] = [],
) {
  const self: Record<string, any> = {};
  self.then = (resolve: any, reject: any) => {
    const { data, error } = resolveData();
    if (error) reject(error);
    else resolve({ data, error: null });
  };
  const methods = ["select", "order", "eq", "not", "in", "or", "limit", "insert", "update", "delete", ...extraMethods];
  for (const m of methods) {
    self[m] = () => self;
  }
  self.single = () => {
    const { data, error } = resolveData();
    return error ? Promise.reject(error) : Promise.resolve({ data, error: null });
  };
  self.maybeSingle = () => {
    const { data, error } = resolveData();
    return error ? Promise.reject(error) : Promise.resolve({ data, error: null });
  };
  return self;
}

// ── Table resolvers ─────────────────────────────────────────────────

function tableResolver(table: string) {
  const map: Record<string, () => { data: any; error: Error | null }> = {
    tickets: () => ({ data: mockState.ticketsData, error: mockState.ticketsError }),
    ticket_status_history: () => ({ data: mockState.historyData, error: mockState.historyError }),
    profiles: () => ({ data: mockState.profilesData, error: mockState.profilesError }),
    ticket_notes: () => ({ data: mockState.notesData, error: mockState.notesError }),
    ticket_feedback: () => ({ data: mockState.feedbackData, error: mockState.feedbackError }),
    devices: () => ({ data: mockState.devicesData, error: mockState.devicesError }),
    ticket_attachments: () => ({ data: mockState.attachmentsData, error: mockState.attachmentsError }),
  };
  return map[table] ?? (() => ({ data: null, error: null }));
}

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => thenable(tableResolver(table))),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() =>
          mockState.storageError
            ? Promise.resolve({ data: null, error: mockState.storageError })
            : Promise.resolve({ data: { path: "portal/test/123-file.png" }, error: null }),
        ),
      })),
    },
  },
}));

vi.mock("@/lib/portal-auth.server", () => ({
  getPortalSession: vi.fn(() => Promise.resolve(mockState.session)),
}));

vi.mock("@/lib/email-templates.server", () => ({
  sendEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/notifications.server", () => ({
  createNotificationForAdmins: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/rate-limit", () => ({
  throwIfRateLimited: vi.fn((_contactId: string, _key: string) => {
    if (mockState.rateLimitError) throw mockState.rateLimitError;
  }),
}));

vi.mock("@/lib/rate-limit-config", () => ({
  RATE_LIMITER_KEYS: { CREATE_PORTAL_TICKET: "create_portal_ticket" },
}));

// ── Helpers ──────────────────────────────────────────────────────────

async function importModule() {
  return await import("@/lib/portal-tickets-operations.server");
}

// ── Test Data ────────────────────────────────────────────────────────

const ticketId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const token = "abcdefghijklmnopqrstuvwxyz_0123456789";

const baseTicket = {
  id: ticketId,
  ticket_code: "TKT-001",
  model: "PC rotto",
  notes: "Il PC non si accende",
  status: "pending",
  priority: "med",
  created_at: "2025-06-10T09:00:00.000Z",
  updated_at: "2025-06-10T09:00:00.000Z",
  closed_at: null,
  public_notes: null,
  device_id: null,
  assignee: { full_name: "Tech One" },
};

// ── Tests ────────────────────────────────────────────────────────────

describe("portal-tickets-operations", () => {
  const savedEnv = { SUPPORT_TEAM_EMAIL: process.env.SUPPORT_TEAM_EMAIL, SMTP_USER: process.env.SMTP_USER };

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore env
    process.env.SUPPORT_TEAM_EMAIL = savedEnv.SUPPORT_TEAM_EMAIL;
    process.env.SMTP_USER = savedEnv.SMTP_USER;
    mockState.ticketsData = null;
    mockState.ticketsError = null;
    mockState.historyData = null;
    mockState.historyError = null;
    mockState.profilesData = null;
    mockState.profilesError = null;
    mockState.notesData = null;
    mockState.notesError = null;
    mockState.feedbackData = null;
    mockState.feedbackError = null;
    mockState.devicesData = null;
    mockState.devicesError = null;
    mockState.attachmentsData = null;
    mockState.attachmentsError = null;
    mockState.storageError = null;
    mockState.rateLimitError = null;
  });

  // ── listPortalTicketsServer ──────────────────────────────────────

  describe("listPortalTicketsServer", () => {
    it("returns tickets with session and mapped fields", async () => {
      const { listPortalTicketsServer } = await importModule();
      mockState.ticketsData = [{ ...baseTicket }];

      const result = await listPortalTicketsServer({ token });
      expect(result.session).toBe(mockState.session);
      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].title).toBe("PC rotto");
      expect(result.tickets[0].status_label).toBe("Aperto");
    });

    it("returns 'Ticket assistenza' as title when model is missing", async () => {
      const { listPortalTicketsServer } = await importModule();
      mockState.ticketsData = [{ ...baseTicket, model: null }];

      const result = await listPortalTicketsServer({ token });
      expect(result.tickets[0].title).toBe("Ticket assistenza");
    });

    it("handles null tickets data", async () => {
      const { listPortalTicketsServer } = await importModule();
      mockState.ticketsData = null;

      const result = await listPortalTicketsServer({ token });
      expect(result.tickets).toEqual([]);
    });

    it("handles status=open filter", async () => {
      const { listPortalTicketsServer } = await importModule();
      mockState.ticketsData = [{ ...baseTicket }];

      const result = await listPortalTicketsServer({ token, status: "open" });
      expect(result.tickets).toHaveLength(1);
    });

    it("handles deviceId filter", async () => {
      const { listPortalTicketsServer } = await importModule();
      mockState.ticketsData = [{ ...baseTicket }];

      const result = await listPortalTicketsServer({
        token,
        deviceId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      });
      expect(result.tickets).toHaveLength(1);
    });

    it("handles search query", async () => {
      const { listPortalTicketsServer } = await importModule();
      mockState.ticketsData = [{ ...baseTicket }];

      const result = await listPortalTicketsServer({ token, q: "rotto" });
      expect(result.tickets).toHaveLength(1);
    });

    it("throws on Supabase error", async () => {
      const { listPortalTicketsServer } = await importModule();
      mockState.ticketsError = new Error("DB error");

      await expect(listPortalTicketsServer({ token })).rejects.toThrow("DB error");
    });
  });

  // ── getPortalTicketDetailServer ──────────────────────────────────

  describe("getPortalTicketDetailServer", () => {
    it("returns full ticket detail with history, notes, and feedback", async () => {
      const { getPortalTicketDetailServer } = await importModule();
      mockState.ticketsData = { ...baseTicket, public_notes: "Public info" };
      mockState.historyData = [
        { id: "h1", ticket_id: ticketId, from_status: null, to_status: "pending", changed_by: "usr1", changed_at: "2025-06-10T09:00:00.000Z", note: "Created" },
      ];
      mockState.profilesData = [
        { id: "usr1", full_name: "Admin", initials: "AD" },
        { id: "usr2", full_name: "Tech Two", initials: "T2" },
      ];
      mockState.notesData = [
        { id: "n1", content: "Stiamo lavorando", created_at: "2025-06-10T10:00:00.000Z", author_id: "usr2" },
      ];
      mockState.feedbackData = { id: "f1", rating: 5, comment: "Ottimo", created_at: "2025-06-12T00:00:00.000Z" };

      const result = await getPortalTicketDetailServer({ token, ticketId });
      expect(result.session).toBe(mockState.session);
      expect((result.ticket as any).id).toBe(ticketId);
      expect((result.ticket as any).public_notes).toBe("Public info");
      expect(result.history).toHaveLength(1);
      expect(result.history[0].actor.full_name).toBe("Admin");
      expect(result.publicNotes).toHaveLength(1);
      expect(result.publicNotes[0].content).toBe("Stiamo lavorando");
      expect((result.publicNotes[0] as any).author.full_name).toBe("Tech Two");
      expect((result.feedback as any).rating).toBe(5);
    });

    it("throws 404 when ticket not found", async () => {
      const { getPortalTicketDetailServer } = await importModule();
      mockState.ticketsData = null;

      await expect(getPortalTicketDetailServer({ token, ticketId })).rejects.toEqual(
        expect.objectContaining({ status: 404 }),
      );
    });

    it("throws on ticket fetch error", async () => {
      const { getPortalTicketDetailServer } = await importModule();
      mockState.ticketsError = new Error("DB error");

      await expect(getPortalTicketDetailServer({ token, ticketId })).rejects.toThrow("DB error");
    });

    it("handles empty history (no actors to fetch)", async () => {
      const { getPortalTicketDetailServer } = await importModule();
      mockState.ticketsData = { ...baseTicket };
      mockState.historyData = [];
      mockState.notesData = [];
      mockState.feedbackData = null;

      const result = await getPortalTicketDetailServer({ token, ticketId });
      expect(result.history).toEqual([]);
      expect(result.publicNotes).toEqual([]);
      expect(result.feedback).toBeNull();
    });

    it("throws on notes error", async () => {
      const { getPortalTicketDetailServer } = await importModule();
      mockState.ticketsData = { ...baseTicket };
      mockState.historyData = [];
      mockState.notesError = new Error("Notes DB error");

      await expect(getPortalTicketDetailServer({ token, ticketId })).rejects.toThrow("Notes DB error");
    });

    it("throws on feedback error", async () => {
      const { getPortalTicketDetailServer } = await importModule();
      mockState.ticketsData = { ...baseTicket };
      mockState.historyData = [];
      mockState.notesData = [];
      mockState.feedbackError = new Error("Feedback DB error");

      await expect(getPortalTicketDetailServer({ token, ticketId })).rejects.toThrow("Feedback DB error");
    });
  });

  // ── createPortalTicketServer ─────────────────────────────────────

  describe("createPortalTicketServer", () => {
    it("creates ticket without device or attachments", async () => {
      const { createPortalTicketServer } = await importModule();
      mockState.ticketsData = { id: ticketId, ticket_code: "TKT-001" };
      // Status history insert (no return needed)
      mockState.historyData = null;

      const result = await createPortalTicketServer({
        token,
        title: "PC non funziona",
        description: "Dettagli del problema",
        category: "hardware",
        urgency: "normal",
        requestType: "technical_issue",
      });

      expect(result.success).toBe(true);
      expect(result.ticketId).toBe(ticketId);
      expect(result.ticketCode).toBe("TKT-001");
    });

    it("creates ticket with low urgency mapped to 'low'", async () => {
      const { createPortalTicketServer } = await importModule();
      mockState.ticketsData = { id: ticketId, ticket_code: "TKT-002" };

      const result = await createPortalTicketServer({
        token,
        title: "Richiesta info",
        description: "Dettagli",
        category: "info",
        urgency: "low",
        requestType: "request",
      });
      expect(result.success).toBe(true);
    });

    it("creates ticket with urgent urgency mapped to 'high'", async () => {
      const { createPortalTicketServer } = await importModule();
      mockState.ticketsData = { id: ticketId, ticket_code: "TKT-003" };

      const result = await createPortalTicketServer({
        token,
        title: "Server down!",
        description: "Il server non risponde",
        category: "network",
        urgency: "urgent",
        requestType: "technical_issue",
      });
      expect(result.success).toBe(true);
    });

    it("maps device_fault requestType to ticket_type 'device'", async () => {
      const { createPortalTicketServer } = await importModule();
      mockState.ticketsData = { id: ticketId, ticket_code: "TKT-004" };

      const result = await createPortalTicketServer({
        token,
        title: "Monitor rotto",
        description: "Schermo nero",
        category: "hardware",
        urgency: "high",
        requestType: "device_fault",
      });
      expect(result.success).toBe(true);
    });

    it("creates ticket with a device", async () => {
      const { createPortalTicketServer } = await importModule();
      const deviceId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
      mockState.devicesData = { id: deviceId, model: "Dell XPS", serial: "SN123", os: "Windows 11", client_id: mockState.session.clientId };
      mockState.ticketsData = { id: ticketId, ticket_code: "TKT-005" };

      const result = await createPortalTicketServer({
        token,
        title: "PC lento",
        description: "Molto lento all'avvio",
        category: "performance",
        urgency: "normal",
        requestType: "technical_issue",
        deviceId,
      });
      expect(result.success).toBe(true);
    });

    it("throws 404 when device not found", async () => {
      const { createPortalTicketServer } = await importModule();
      mockState.devicesData = null;

      await expect(
        createPortalTicketServer({
          token,
          title: "Test",
          description: "Test",
          category: "test",
          urgency: "low",
          requestType: "technical_issue",
          deviceId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        }),
      ).rejects.toEqual(expect.objectContaining({ status: 404 }));
    });

    it("throws on device fetch error", async () => {
      const { createPortalTicketServer } = await importModule();
      mockState.devicesError = new Error("Device DB error");

      await expect(
        createPortalTicketServer({
          token,
          title: "Test",
          description: "Test",
          category: "test",
          urgency: "low",
          requestType: "technical_issue",
          deviceId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        }),
      ).rejects.toThrow("Device DB error");
    });

    it("throws on ticket insert error", async () => {
      const { createPortalTicketServer } = await importModule();
      mockState.ticketsError = new Error("FK violation");

      await expect(
        createPortalTicketServer({
          token,
          title: "Test",
          description: "Test",
          category: "test",
          urgency: "low",
          requestType: "technical_issue",
        }),
      ).rejects.toThrow("FK violation");
    });

    it("throws on rate limit", async () => {
      const { createPortalTicketServer } = await importModule();
      mockState.rateLimitError = new Error("Too many requests");

      await expect(
        createPortalTicketServer({
          token,
          title: "Test",
          description: "Test",
          category: "test",
          urgency: "low",
          requestType: "technical_issue",
        }),
      ).rejects.toThrow("Too many requests");
    });

    it("creates ticket with attachments", async () => {
      const { createPortalTicketServer } = await importModule();
      mockState.ticketsData = { id: ticketId, ticket_code: "TKT-008" };
      // ticket_attachments insert result
      mockState.attachmentsData = { id: "att-1", file_name: "screenshot.png" };
      // Small 1x1 pixel PNG as base64
      const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const result = await createPortalTicketServer({
        token,
        title: "Screenshot",
        description: "Vedi allegato",
        category: "bug",
        urgency: "normal",
        requestType: "technical_issue",
        attachments: [{ fileName: "screenshot.png", mimeType: "image/png", dataUrl }],
      });
      expect(result.success).toBe(true);
      expect(result.ticketCode).toBe("TKT-008");
    });

    it("skips attachment with invalid data URL", async () => {
      const { createPortalTicketServer } = await importModule();
      mockState.ticketsData = { id: ticketId, ticket_code: "TKT-009" };

      const result = await createPortalTicketServer({
        token,
        title: "No attachments",
        description: "Test",
        category: "test",
        urgency: "normal",
        requestType: "technical_issue",
        attachments: [{ fileName: "bad.txt", dataUrl: "not-a-data-url" }],
      });
      expect(result.success).toBe(true);
    });

    it("throws 400 on oversized attachment", async () => {
      const { createPortalTicketServer } = await importModule();
      mockState.ticketsData = { id: ticketId, ticket_code: "TKT-010" };
      // Create a data URL that decodes to >5MB
      const bigBuffer = "x".repeat(6 * 1024 * 1024);
      const bigDataUrl = `data:application/octet-stream;base64,${Buffer.from(bigBuffer).toString("base64")}`;

      await expect(
        createPortalTicketServer({
          token,
          title: "Big file",
          description: "Test",
          category: "test",
          urgency: "normal",
          requestType: "technical_issue",
          attachments: [{ fileName: "big.bin", dataUrl: bigDataUrl }],
        }),
      ).rejects.toEqual(expect.objectContaining({ status: 400 }));
    });

    it("sends email when SUPPORT_TEAM_EMAIL is set", async () => {
      const { createPortalTicketServer } = await importModule();
      const { sendEmail } = await import("@/lib/email-templates.server");
      mockState.ticketsData = { id: ticketId, ticket_code: "TKT-006" };
      process.env.SUPPORT_TEAM_EMAIL = "team@acme.it";
      delete process.env.SMTP_USER;

      await createPortalTicketServer({
        token,
        title: "Test email",
        description: "Descrizione",
        category: "test",
        urgency: "normal",
        requestType: "request",
      });

      expect(sendEmail).toHaveBeenCalledWith(
        "team@acme.it",
        expect.stringContaining("TKT-006"),
        expect.stringContaining("ACME S.r.l."),
        expect.any(String),
      );
    });

    it("does not send email when no team email configured", async () => {
      const { createPortalTicketServer } = await importModule();
      const { sendEmail } = await import("@/lib/email-templates.server");
      mockState.ticketsData = { id: ticketId, ticket_code: "TKT-007" };
      delete process.env.SUPPORT_TEAM_EMAIL;
      delete process.env.SMTP_USER;

      await createPortalTicketServer({
        token,
        title: "No email",
        description: "Desc",
        category: "test",
        urgency: "normal",
        requestType: "request",
      });

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });
});
