import { describe, expect, it } from "vitest";
import { deduplicateAuditRows, auditRowsToCsv } from "@/lib/audit-log";
import type { AuditCsvRow } from "@/lib/data/audit-log";

// ── helpers ─────────────────────────────────────────────────────────

function row(msg: string, iso: string) {
  return { message: msg, created_at: iso };
}

function csvRow(overrides: Partial<AuditCsvRow> = {}): AuditCsvRow {
  return {
    created_at: "2026-06-10T14:30:00.000Z",
    actor_name: "Marco Gastaldello",
    type: "user",
    message: "Ticket aggiornato",
    action_type: "ticket.update",
    entity_type: "ticket",
    entity_id: "abc-123",
    ticket_id: "tkt-456",
    severity: "info",
    ...overrides,
  };
}

// ── deduplicateAuditRows ────────────────────────────────────────────

describe("deduplicateAuditRows", () => {
  describe("basic deduplication", () => {
    it("returns empty array for empty input", () => {
      const result = deduplicateAuditRows([]);
      expect(result).toEqual([]);
    });

    it("keeps unique rows unchanged", () => {
      const rows = [
        row("msg-a", "2026-06-01T10:00:00.000Z"),
        row("msg-b", "2026-06-01T10:00:01.000Z"),
      ];

      expect(deduplicateAuditRows(rows)).toEqual(rows);
    });

    it("removes duplicates with same message AND same second", () => {
      const rows = [
        row("same message", "2026-06-01T10:00:00.123Z"),
        row("same message", "2026-06-01T10:00:00.456Z"), // same second → duplicate
        row("same message", "2026-06-01T10:00:01.000Z"), // different second → kept
      ];

      const result = deduplicateAuditRows(rows);

      expect(result).toHaveLength(2);
      expect(result[0].created_at).toBe("2026-06-01T10:00:00.123Z"); // first kept
      expect(result[1].created_at).toBe("2026-06-01T10:00:01.000Z"); // different second
    });

    it("keeps rows with same message but different seconds", () => {
      const rows = [
        row("msg", "2026-06-01T10:00:00.000Z"),
        row("msg", "2026-06-01T10:00:01.000Z"),
        row("msg", "2026-06-01T10:00:02.000Z"),
      ];

      expect(deduplicateAuditRows(rows)).toHaveLength(3);
    });

    it("keeps rows with same second but different messages", () => {
      const rows = [
        row("msg-a", "2026-06-01T10:00:00.000Z"),
        row("msg-b", "2026-06-01T10:00:00.500Z"),
        row("msg-c", "2026-06-01T10:00:00.999Z"),
      ];

      expect(deduplicateAuditRows(rows)).toHaveLength(3);
    });

    it("preserves the first occurrence order", () => {
      const rows = [
        row("msg-a", "2026-06-01T10:00:00.000Z"),
        row("msg-b", "2026-06-01T10:00:00.000Z"), // different msg, same second → kept
        row("msg-a", "2026-06-01T10:00:00.100Z"), // same msg+second as [0] → removed
        row("msg-b", "2026-06-01T10:00:00.200Z"), // same msg+second as [1] → removed
      ];

      const result = deduplicateAuditRows(rows);
      expect(result).toHaveLength(2);
      expect(result[0].message).toBe("msg-a");
      expect(result[1].message).toBe("msg-b");
    });
  });

  describe("generic type preservation", () => {
    it("preserves extra fields on rows", () => {
      const rows = [
        { message: "a", created_at: "2026-06-01T10:00:00.000Z", extra: 1 },
        { message: "b", created_at: "2026-06-01T10:00:01.000Z", extra: 2 },
      ];

      const result = deduplicateAuditRows(rows);
      // TypeScript: result should have `extra` property
      expect(result[0].extra).toBe(1);
      expect(result[1].extra).toBe(2);
    });
  });
});

// ── AuditCsvRow (type shape) ─────────────────────────────────────────

describe("AuditCsvRow (type shape)", () => {
  it("has all 9 fields with correct types", () => {
    const row: AuditCsvRow = {
      created_at: "2026-06-10T14:30:00.000Z",
      actor_name: "Marco Gastaldello",
      type: "user",
      message: "Ticket aggiornato",
      action_type: "ticket.update",
      entity_type: "ticket",
      entity_id: "abc-123",
      ticket_id: "tkt-456",
      severity: "info",
    };

    expect(Object.keys(row).sort()).toEqual([
      "action_type",
      "actor_name",
      "created_at",
      "entity_id",
      "entity_type",
      "message",
      "severity",
      "ticket_id",
      "type",
    ]);

    expect(typeof row.created_at).toBe("string");
    expect(typeof row.message).toBe("string");
    expect(typeof row.type).toBe("string");
    expect(typeof row.severity).toBe("string");
  });

  it("nullable fields accept null", () => {
    const row: AuditCsvRow = {
      created_at: "2026-06-10T14:30:00.000Z",
      actor_name: null,
      type: "sys",
      message: "Evento di sistema",
      action_type: null,
      entity_type: null,
      entity_id: null,
      ticket_id: null,
      severity: null,
    };

    expect(row.actor_name).toBeNull();
    expect(row.action_type).toBeNull();
    expect(row.entity_type).toBeNull();
    expect(row.entity_id).toBeNull();
    expect(row.ticket_id).toBeNull();
    expect(row.severity).toBeNull();
  });
});

// ── auditRowsToCsv ───────────────────────────────────────────────────

describe("auditRowsToCsv", () => {
  describe("empty input", () => {
    it("returns only the header for empty rows", () => {
      const result = auditRowsToCsv([]);

      expect(result).toBe(
        "Data,Ora,Utente,Tipo,Azione,Dettaglio,Entita,ID Entita,Ticket,Esito\n",
      );
    });
  });

  describe("single row", () => {
    it("generates a valid CSV line", () => {
      const result = auditRowsToCsv([csvRow()]);

      const lines = result.split("\n");
      expect(lines).toHaveLength(2); // header + 1 row
      expect(lines[0]).toBe(
        "Data,Ora,Utente,Tipo,Azione,Dettaglio,Entita,ID Entita,Ticket,Esito",
      );
    });

    it("contains correct field values", () => {
      const result = auditRowsToCsv([
        csvRow({
          created_at: "2026-06-10T14:30:00.000Z",
          actor_name: "Marco",
          type: "user",
          message: "Test message",
          action_type: "ticket.create",
          entity_type: "ticket",
          entity_id: "abc",
          ticket_id: "tkt-1",
          severity: "info",
        }),
      ]);

      // Should contain the Italian-formatted date/time and all fields
      expect(result).toContain("Marco");
      expect(result).toContain("Utente");
      expect(result).toContain("ticket.create");
      expect(result).toContain("abc");
      expect(result).toContain("tkt-1");
      expect(result).toContain("info");
    });
  });

  describe("multiple rows", () => {
    it("generates header + N rows", () => {
      const rows = [csvRow(), csvRow(), csvRow()];
      const result = auditRowsToCsv(rows);

      const lines = result.split("\n");
      expect(lines).toHaveLength(4); // header + 3 rows
    });
  });

  describe("field fallbacks", () => {
    it("falls back actor_name to 'Sistema'", () => {
      const result = auditRowsToCsv([csvRow({ actor_name: null })]);
      // The 3rd field (0-based index 2 in CSV) should be "Sistema"
      const fields = result.split("\n")[1].split(",");
      expect(fields[2]).toBe("Sistema");
    });

    it("falls back actor_name to 'Sistema' for empty string too", () => {
      const result = auditRowsToCsv([csvRow({ actor_name: "" })]);
      const fields = result.split("\n")[1].split(",");
      expect(fields[2]).toBe("Sistema");
    });

    it("maps type 'sys' → 'Sistema'", () => {
      const result = auditRowsToCsv([csvRow({ type: "sys" })]);
      const fields = result.split("\n")[1].split(",");
      expect(fields[3]).toBe("Sistema");
    });

    it("maps type 'auto' → 'Automatico'", () => {
      const result = auditRowsToCsv([csvRow({ type: "auto" })]);
      const fields = result.split("\n")[1].split(",");
      expect(fields[3]).toBe("Automatico");
    });

    it("maps type anything else → 'Utente'", () => {
      const result = auditRowsToCsv([csvRow({ type: "user" })]);
      const fields = result.split("\n")[1].split(",");
      expect(fields[3]).toBe("Utente");
    });

    it("falls back null action_type / entity_type / entity_id to empty string", () => {
      const result = auditRowsToCsv([
        csvRow({
          action_type: null,
          entity_type: null,
          entity_id: null,
          ticket_id: null,
        }),
      ]);

      const fields = result.split("\n")[1].split(",");
      expect(fields[4]).toBe(""); // action_type
      expect(fields[6]).toBe(""); // entity_type
      expect(fields[7]).toBe(""); // entity_id
      expect(fields[8]).toBe(""); // ticket
    });
  });

  describe("message escaping", () => {
    it("wraps message in double quotes", () => {
      const result = auditRowsToCsv([csvRow({ message: "hello" })]);
      const fields = result.split("\n")[1].split(",");
      expect(fields[5]).toBe('"hello"');
    });

    it("escapes double quotes inside message by doubling them", () => {
      const result = auditRowsToCsv([
        csvRow({ message: 'He said "hello"' }),
      ]);

      expect(result).toContain('"He said ""hello"""');
    });

    it("handles empty message", () => {
      const result = auditRowsToCsv([csvRow({ message: "" })]);
      const fields = result.split("\n")[1].split(",");
      expect(fields[5]).toBe('""');
    });
  });

  describe("severity fallback", () => {
    it("falls back null severity to 'info'", () => {
      const result = auditRowsToCsv([csvRow({ severity: null })]);
      const fields = result.split("\n")[1].split(",");
      expect(fields[9]).toBe("info");
    });
  });
});
