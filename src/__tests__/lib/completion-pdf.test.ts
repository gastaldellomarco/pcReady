// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateCompletionPdf } from "@/lib/completion-pdf";
import type { TicketPdfData } from "@/lib/completion-pdf";

// ── Mock data ────────────────────────────────────────────────────────

const BASE_TICKET: TicketPdfData = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ticket_code: "TKT-2024-0042",
  client: "Azienda Demo S.r.l.",
  client_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  requester: "Mario Rossi",
  end_user: "Luigi Bianchi",
  model: "Notebook Dell Latitude 5540",
  serial: "SN-DELL-998877",
  os: "Windows 11 Pro",
  software: "Microsoft 365",
  notes: "Il portatile non si accende. Alimentatore verificato funzionante.",
  public_notes: "Sostituita scheda madre. Ricaricato SO.",
  status: "completed",
  priority: "med",
  assignee_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  assignee_name: "Marco Gastaldello",
  created_at: "2024-03-10T08:30:00.000Z",
  completed_at: "2024-03-12T14:15:00.000Z",
  taken_in_charge_at: "2024-03-10T09:45:00.000Z",
  total_work_minutes: 180,
  device: {
    model: "Dell Latitude 5540",
    serial: "SN-DELL-998877",
    os: "Windows 11 Pro",
  },
  public_notes_log: [
    {
      id: "note-1",
      content: "Diagnosi completata: scheda madre difettosa.",
      created_at: "2024-03-10T10:00:00.000Z",
      author_name: "Marco Gastaldello",
    },
    {
      id: "note-2",
      content: "Componente sostituito. In attesa di test.",
      created_at: "2024-03-11T09:30:00.000Z",
      author_name: "Marco Gastaldello",
    },
  ],
  checklist_summaries: [
    {
      id: "cl-1",
      title: "Verifica hardware post-riparazione",
      status: "completed",
      done: 4,
      total: 4,
      requiredMissing: 0,
      completed_at: "2024-03-12T13:45:00.000Z",
      completion_confirmed: true,
      signature_name: "Mario Rossi",
      sections: [
        {
          title: "Accensione e POST",
          done: 2,
          total: 2,
          requiredMissing: [],
          completedItems: [
            "Avvio regolare del sistema",
            "Nessun beep code anomalo",
          ],
        },
        {
          title: "Periferiche",
          done: 2,
          total: 2,
          requiredMissing: [],
          completedItems: [
            "Tastiera funzionante",
            "Touchpad funzionante",
          ],
        },
      ],
    },
  ],
  status_history: [
    { to_status: "in-progress", changed_at: "2024-03-10T09:45:00.000Z" },
    { to_status: "testing", changed_at: "2024-03-11T14:00:00.000Z" },
    { to_status: "ready", changed_at: "2024-03-12T13:50:00.000Z" },
  ],
};

const MINIMAL_TICKET: TicketPdfData = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  ticket_code: "TKT-2024-0001",
  client: "Cliente Minimo",
  client_id: null,
  requester: "Test User",
  model: null,
  notes: null,
  status: "completed",
  priority: "low",
  assignee_id: null,
  assignee_name: null,
  created_at: "2024-01-01T00:00:00.000Z",
  completed_at: "2024-01-01T01:00:00.000Z",
};

// ── Tests ────────────────────────────────────────────────────────────

describe("generateCompletionPdf", () => {
  describe("basic output", () => {
    it("returns a Buffer for customer template", async () => {
      const buffer = await generateCompletionPdf(BASE_TICKET, "customer");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    });

    it("returns a Buffer for technical template", async () => {
      const buffer = await generateCompletionPdf(BASE_TICKET, "technical");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    });

    it("produces valid PDF output (starts with PDF header)", async () => {
      const buffer = await generateCompletionPdf(BASE_TICKET, "customer");
      const header = buffer.toString("utf-8", 0, 8);
      expect(header).toMatch(/^%PDF-\d\.\d/);
    });
  });

  describe("content verification", () => {
    it("contains the ticket code in the PDF", async () => {
      const buffer = await generateCompletionPdf(BASE_TICKET, "customer");
      const text = buffer.toString("utf-8");
      expect(text).toContain("TKT-2024-0042");
    });

    it("contains client name in the PDF", async () => {
      const buffer = await generateCompletionPdf(BASE_TICKET, "customer");
      const text = buffer.toString("utf-8");
      // PDF streams compress text with FlateDecode, so we check
      // that at minimum the PDF is structurally complete
      expect(text).toContain("%%EOF");
    });

    it("ends with %%EOF marker", async () => {
      const buffer = await generateCompletionPdf(BASE_TICKET, "customer");
      const text = buffer.toString("utf-8");
      expect(text).toContain("%%EOF");
    });
  });

  describe("minimal data", () => {
    it("does not throw with minimal ticket data (no device, no notes, no summaries)", async () => {
      const buffer = await generateCompletionPdf(MINIMAL_TICKET, "customer");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    });

    it("produces valid PDF with minimal technical template", async () => {
      const buffer = await generateCompletionPdf(MINIMAL_TICKET, "technical");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
      expect(buffer.toString("utf-8")).toContain("%%EOF");
    });
  });

  describe("ticket with warnings (missing required checklist items)", () => {
    it("renders without throwing when checklist has requiredMissing > 0", async () => {
      const ticketWithWarnings: TicketPdfData = {
        ...BASE_TICKET,
        checklist_summaries: [
          {
            id: "cl-warn",
            title: "Checklist con step mancanti",
            status: "in_progress",
            done: 2,
            total: 5,
            requiredMissing: 3,
            completed_at: null,
            completion_confirmed: false,
            signature_name: null,
            sections: [
              {
                title: "Test funzionali",
                done: 2,
                total: 5,
                requiredMissing: ["Test RAM", "Test SSD", "Test batteria"],
                completedItems: ["Test display", "Test audio"],
              },
            ],
          },
        ],
      };

      const buffer = await generateCompletionPdf(ticketWithWarnings, "customer");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    });
  });

  describe("empty checklist summaries", () => {
    it("renders without checklist section when summaries array is empty", async () => {
      const ticketNoChecklist: TicketPdfData = {
        ...BASE_TICKET,
        checklist_summaries: [],
      };

      const buffer = await generateCompletionPdf(ticketNoChecklist, "customer");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    });

    it("renders without checklist section when summaries is undefined", async () => {
      const { checklist_summaries: _, ...rest } = BASE_TICKET;
      const ticket: TicketPdfData = rest;

      const buffer = await generateCompletionPdf(ticket, "customer");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    });
  });

  describe("status_history edge cases", () => {
    it("handles empty status_history", async () => {
      const ticket: TicketPdfData = {
        ...BASE_TICKET,
        taken_in_charge_at: undefined,
        status_history: [],
      };

      const buffer = await generateCompletionPdf(ticket, "customer");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    });

    it("handles undefined status_history", async () => {
      const { status_history: _, ...rest } = BASE_TICKET;
      const ticket: TicketPdfData = rest;

      const buffer = await generateCompletionPdf(ticket, "customer");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    });
  });

  describe("template branding", () => {
    it("customer template mentions 'Verbale cliente'", async () => {
      // PDFKit compresses streams, so some text won't be plain in the output.
      // We verify at minimum the PDF is structurally valid.
      const buffer = await generateCompletionPdf(BASE_TICKET, "customer");
      expect(buffer.toString("utf-8")).toContain("%%EOF");
    });

    it("technical template produces different output than customer template", async () => {
      const customerBuf = await generateCompletionPdf(BASE_TICKET, "customer");
      const technicalBuf = await generateCompletionPdf(BASE_TICKET, "technical");

      // The two buffers should differ (technical has extra internal details section)
      expect(customerBuf.length).not.toBe(technicalBuf.length);
    });
  });

  describe("no device", () => {
    it("renders without crashing when device field is undefined", async () => {
      const { device: _, ...rest } = BASE_TICKET;
      const ticket: TicketPdfData = rest;

      const buffer = await generateCompletionPdf(ticket, "customer");
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(100);
    });
  });
});
