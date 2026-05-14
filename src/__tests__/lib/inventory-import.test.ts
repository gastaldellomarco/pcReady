import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  csvTemplate,
  DEVICE_STATUSES,
  importDevicesFromCsv,
  parseDevicesCsv,
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
    expect(t).toContain("serial,model,os,status,client_name,notes");
    expect(t).toContain("ABC123");
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
    const clients: ClientLookup[] = [
      { id: "c1", name: "Acme Srl", company_name: null },
    ];
    const devices: { id: string; serial: string | null }[] = [
      { id: "d1", serial: "EXIST" },
    ];

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
