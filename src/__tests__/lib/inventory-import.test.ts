import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  chunks,
  csvTemplate,
  DEVICE_STATUSES,
  importDevicesFromCsv,
  isIsoDate,
  normalizeHeader,
  normalizeKey,
  orValue,
  parseCsv,
  parseDevicesCsv,
  uniqueValues,
  validateImportRows,
  type ClientLookup,
  type PreviewRow,
} from "@/lib/inventory-import";

const createDeviceMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: "new-device-id", serial: "SN-NEW" }),
);

vi.mock("@/lib/queries/inventory", () => ({
  createDevice: (...args: unknown[]) => createDeviceMock(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

describe("inventory-import", () => {
  beforeEach(() => {
    createDeviceMock.mockClear();
  });

  it("csvTemplate includes headers and sample row", () => {
    const t = csvTemplate();
    expect(t).toContain(
      "asset_tag,serial,brand,model,category,device_type,os,status,client_name,notes,purchase_date,warranty_expiry_date,warranty_type,warranty_provider,warranty_notes",
    );
    expect(t).toContain("DellSN123");
  });

  it("parseDevicesCsv maps rows and skips empty lines", () => {
    const csv = `serial,model,os,status,client_name,notes
SN1,Model A,Windows 11 Pro,available,Acme Srl,Note 1
,,,,,
`;
    const rows = parseDevicesCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      serial: "SN1",
      model: "Model A",
      os: "Windows 11 Pro",
      status: "available",
      client_name: "Acme Srl",
      notes: "Note 1",
    });
  });

  it("parseDevicesCsv handles quoted serial with comma", () => {
    const csv = `serial,model,os,status,client_name,notes
"SN,ONE",ThinkPad,,available,Acme,
`;
    const rows = parseDevicesCsv(csv);
    expect(rows[0]?.serial).toBe("SN,ONE");
  });

  it("parseDevicesCsv defaults status to available when empty", () => {
    const csv = `serial,model,os,status,client_name,notes
SN2,Model B,,,Beta Spa,
`;
    const rows = parseDevicesCsv(csv);
    expect(rows[0]?.status).toBe("available");
  });

  it("parseDevicesCsv returns empty for header-only file", () => {
    expect(parseDevicesCsv("serial,model,os,status,client_name,notes")).toEqual([]);
  });

  it("validateImportRows flags errors and sets action", () => {
    const clients: ClientLookup[] = [{ id: "c1", name: "Acme Srl", company_name: null }];
    const devices: { id: string; serial: string | null }[] = [{ id: "d1", serial: "EXIST" }];

    const rows = [
      {
        rowNumber: 2,
        serial: "",
        model: "X",
        os: null,
        status: "bogus" as unknown as (typeof DEVICE_STATUSES)[number],
        client_name: "Unknown",
        notes: null,
      },
      {
        rowNumber: 3,
        serial: "NEW1",
        model: "Y",
        os: null,
        status: "available",
        client_name: "Acme Srl",
        notes: null,
      },
      {
        rowNumber: 4,
        serial: "EXIST",
        model: "Z",
        os: null,
        status: "maintenance",
        client_name: "Acme Srl",
        notes: null,
      },
    ];

    const preview = validateImportRows(rows as any, clients, devices);
    expect(preview[0]?.errors.length).toBeGreaterThan(0);
    expect(preview[0]?.action).toBe("skip");
    expect(preview[1]?.errors).toEqual([]);
    expect(preview[1]?.action).toBe("insert");
    expect(preview[1]?.client_id).toBe("c1");
    expect(preview[2]?.action).toBe("update");
    expect(preview[2]?.existingDeviceId).toBe("d1");
  });

  it("validateImportRows detects duplicate serials in file", () => {
    const clients: ClientLookup[] = [{ id: "c1", name: "A", company_name: null }];
    const rows = [
      {
        rowNumber: 2,
        serial: "DUP",
        model: "M",
        os: null,
        status: "available" as const,
        client_name: "A",
        notes: null,
      },
      {
        rowNumber: 3,
        serial: "DUP",
        model: "M2",
        os: null,
        status: "available" as const,
        client_name: "A",
        notes: null,
      },
    ];
    const preview = validateImportRows(rows, clients, []);
    expect(preview[1]?.errors.some((e) => /duplicato/i.test(e))).toBe(true);
    expect(preview[1]?.action).toBe("skip");
  });

  it("importDevicesFromCsv runs update and insert paths", async () => {
    const rows: PreviewRow[] = [
      {
        rowNumber: 2,
        serial: "OLD",
        model: "M1",
        os: null,
        status: "available",
        client_name: "A",
        notes: null,
        action: "update",
        existingDeviceId: "dev-1",
        client_id: "c1",
        errors: [],
      },
      {
        rowNumber: 3,
        serial: "NEW99",
        model: "M2",
        os: null,
        status: "maintenance",
        client_name: "A",
        notes: null,
        action: "insert",
        existingDeviceId: null,
        client_id: "c1",
        errors: [],
      },
    ];
    const result = await importDevicesFromCsv(rows, "user-1");
    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(1);
    expect(createDeviceMock).toHaveBeenCalledTimes(1);
  });
});

// ── Pure helper functions ────────────────────────────────────────────────

describe("isIsoDate", () => {
  it("accepts valid ISO date YYYY-MM-DD", () => {
    expect(isIsoDate("2026-01-15")).toBe(true);
    expect(isIsoDate("2024-12-31")).toBe(true);
  });
  it("rejects invalid format", () => {
    expect(isIsoDate("15/01/2026")).toBe(false);
    expect(isIsoDate("2026-1-5")).toBe(false);
  });
  it("rejects non-date strings", () => {
    expect(isIsoDate("abc")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
  it("rejects out-of-range dates", () => {
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-02-30")).toBe(false);
  });
});

describe("normalizeHeader", () => {
  it("lowercases and replaces spaces with underscores", () => {
    expect(normalizeHeader("Asset Tag")).toBe("asset_tag");
    expect(normalizeHeader("  SERIAL  ")).toBe("serial");
  });
});

describe("normalizeKey", () => {
  it("trims and lowercases", () => {
    expect(normalizeKey(" ACME Srl ")).toBe("acme srl");
  });
  it("returns empty for null/undefined", () => {
    expect(normalizeKey(null)).toBe("");
    expect(normalizeKey(undefined)).toBe("");
  });
});

describe("uniqueValues", () => {
  it("returns unique trimmed non-empty values", () => {
    expect(uniqueValues(["A", "B", "A", "  C  "])).toEqual(["A", "B", "C"]);
  });
  it("filters out empty and null", () => {
    expect(uniqueValues(["A", "", null, undefined])).toEqual(["A"]);
  });
  it("returns empty for all empty", () => {
    expect(uniqueValues(["", ""])).toEqual([]);
  });
});

describe("orValue", () => {
  it("removes commas and percent signs", () => {
    expect(orValue("Acme, Inc.")).toBe("Acme Inc.");
    expect(orValue("50% off")).toBe("50 off");
    expect(orValue("test,%both")).toBe("testboth");
  });
  it("returns unchanged if no special chars", () => {
    expect(orValue("hello")).toBe("hello");
  });
});

describe("chunks", () => {
  it("splits array into chunks of specified size", () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("returns single chunk for size >= array length", () => {
    expect(chunks([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });
  it("returns empty for empty array", () => {
    expect(chunks([], 5)).toEqual([]);
  });
});

describe("parseCsv", () => {
  it("parses simple CSV", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("handles quoted fields with commas", () => {
    expect(parseCsv('"Hello, World",value')).toEqual([["Hello, World", "value"]]);
  });
  it("handles escaped double quotes", () => {
    expect(parseCsv('"He said ""hi""",value')).toEqual([['He said "hi"', "value"]]);
  });
  it("handles Windows CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("handles trailing newline", () => {
    const result = parseCsv("a,b\n");
    expect(result).toEqual([["a", "b"], [""]]);
  });
});
