import { supabase } from "@/integrations/supabase/client";
import type { Database, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { WARRANTY_TYPES, type WarrantyType } from "@/lib/warranty";

export type DeviceStatus = Database["public"]["Enums"]["device_status"];

export const DEVICE_STATUSES: DeviceStatus[] = ["available", "assigned", "maintenance", "retired"];
export const INVENTORY_CSV_HEADERS = [
  "serial",
  "brand",
  "model",
  "os",
  "status",
  "client_name",
  "notes",
  "purchase_date",
  "warranty_expiry_date",
  "warranty_type",
  "warranty_provider",
  "warranty_notes",
] as const;

export interface CsvRow {
  rowNumber: number;
  serial: string;
  brand?: string | null;
  model: string;
  os: string | null;
  status: DeviceStatus;
  client_name: string;
  notes: string | null;
  purchase_date?: string | null;
  warranty_expiry_date?: string | null;
  warranty_type?: WarrantyType | null;
  warranty_provider?: string | null;
  warranty_notes?: string | null;
}

export interface ClientLookup {
  id: string;
  name: string;
  company_name: string | null;
}

export interface PreviewRow extends CsvRow {
  action: "insert" | "update" | "skip";
  existingDeviceId: string | null;
  client_id: string | null;
  errors: string[];
}

export interface ImportResult {
  inserted: number;
  updated: number;
  errors: { rowNumber: number; serial: string; error: string }[];
}

export function csvTemplate() {
  return `${INVENTORY_CSV_HEADERS.join(",")}\nABC123,Dell,Dell Latitude 5540,Windows 11 Pro,available,Cliente Demo,Prima fornitura,2026-01-15,2029-01-15,standard,Dell Support,Contratto WTY-123`;
}

export function parseDevicesCsv(text: string): CsvRow[] {
  const records = parseCsv(text);
  if (records.length < 2) return [];

  const headers = records[0].map((h) => normalizeHeader(h));
  const index = new Map(headers.map((h, i) => [h, i]));

  return records.slice(1).flatMap((record, offset) => {
    if (record.every((value) => !value.trim())) return [];
    const read = (name: (typeof INVENTORY_CSV_HEADERS)[number]) =>
      record[index.get(name) ?? -1]?.trim() ?? "";
    const warrantyType = read("warranty_type") || null;
    return {
      rowNumber: offset + 2,
      serial: read("serial"),
      brand: read("brand") || null,
      model: read("model"),
      os: read("os") || null,
      status: (read("status") || "available") as DeviceStatus,
      client_name: read("client_name"),
      notes: read("notes") || null,
      purchase_date: read("purchase_date") || null,
      warranty_expiry_date: read("warranty_expiry_date") || null,
      warranty_type: warrantyType as WarrantyType | null,
      warranty_provider: read("warranty_provider") || null,
      warranty_notes: read("warranty_notes") || null,
    };
  });
}

export async function loadInventoryImportContext(rows: CsvRow[]) {
  const clientNames = uniqueValues(rows.map((row) => row.client_name));
  const serials = uniqueValues(rows.map((row) => row.serial));
  const [clients, devices] = await Promise.all([
    loadClientsByName(clientNames),
    loadDevicesBySerial(serials),
  ]);

  return {
    clients,
    devices,
  };
}

export function validateImportRows(
  rows: CsvRow[],
  clients: ClientLookup[],
  devices: { id: string; serial: string | null }[],
): PreviewRow[] {
  const clientsByName = new Map<string, ClientLookup>();
  for (const client of clients) {
    clientsByName.set(normalizeKey(client.name), client);
    if (client.company_name) clientsByName.set(normalizeKey(client.company_name), client);
  }

  const devicesBySerial = new Map(
    devices
      .filter((device) => device.serial?.trim())
      .map((device) => [normalizeKey(device.serial as string), device.id]),
  );
  const seenInFile = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];
    const serialKey = normalizeKey(row.serial);
    const client = clientsByName.get(normalizeKey(row.client_name)) ?? null;
    const existingDeviceId = devicesBySerial.get(serialKey) ?? null;

    if (!row.serial) errors.push("Seriale obbligatorio");
    if (!row.model) errors.push("Modello obbligatorio");
    if (!row.client_name) errors.push("Cliente obbligatorio");
    if (row.client_name && !client) errors.push("Cliente non trovato");
    if (!DEVICE_STATUSES.includes(row.status)) errors.push("Stato non valido");
    if (row.purchase_date && !isIsoDate(row.purchase_date))
      errors.push("Data acquisto non valida (YYYY-MM-DD)");
    if (row.warranty_expiry_date && !isIsoDate(row.warranty_expiry_date))
      errors.push("Scadenza garanzia non valida (YYYY-MM-DD)");
    if (row.warranty_type && !WARRANTY_TYPES.some((type) => type.value === row.warranty_type)) {
      errors.push("Tipo garanzia non valido");
    }
    if (serialKey && seenInFile.has(serialKey)) errors.push("Seriale duplicato nel CSV");
    if (serialKey) seenInFile.add(serialKey);

    return {
      ...row,
      action: errors.length ? "skip" : existingDeviceId ? "update" : "insert",
      existingDeviceId,
      client_id: client?.id ?? null,
      errors,
    };
  });
}

export async function importDevicesFromCsv(
  rows: PreviewRow[],
  userId: string | null,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const validRows = rows.filter((row) => row.action !== "skip" && row.client_id);
  const results: ImportResult = { inserted: 0, updated: 0, errors: [] };

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    try {
      if (row.existingDeviceId) {
        const update: TablesUpdate<"devices"> = {
          client_id: row.client_id!,
          brand: row.brand,
          model: row.model,
          os: row.os,
          status: row.status,
          notes: row.notes,
          purchase_date: row.purchase_date,
          warranty_expiry_date: row.warranty_expiry_date,
          warranty_type: row.warranty_type,
          warranty_provider: row.warranty_provider,
          warranty_notes: row.warranty_notes,
        };
        const { error } = await supabase
          .from("devices")
          .update(update)
          .eq("id", row.existingDeviceId);
        if (error) throw error;
        results.updated++;
      } else {
        const insert: TablesInsert<"devices"> = {
          client_id: row.client_id!,
          serial: row.serial,
          brand: row.brand,
          model: row.model,
          os: row.os,
          status: row.status,
          notes: row.notes,
          purchase_date: row.purchase_date,
          warranty_expiry_date: row.warranty_expiry_date,
          warranty_type: row.warranty_type,
          warranty_provider: row.warranty_provider,
          warranty_notes: row.warranty_notes,
          created_by: userId,
        };
        // Use bulk insert helper when importing many rows
        const { createDevice } = await import("@/lib/queries/inventory");
        await createDevice(insert as any);
        results.inserted++;
      }
    } catch (error) {
      results.errors.push({
        rowNumber: row.rowNumber,
        serial: row.serial,
        error: error instanceof Error ? error.message : "Errore import",
      });
    } finally {
      onProgress?.(i + 1, validRows.length);
    }
  }

  return results;
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function orValue(value: string) {
  return value.replace(/[,%]/g, "");
}

async function loadClientsByName(names: string[]) {
  const clientsById = new Map<string, ClientLookup>();
  for (const chunk of chunks(names.map(orValue).filter(Boolean), 25)) {
    const filters = chunk
      .flatMap((name) => [`name.ilike.${name}`, `company_name.ilike.${name}`])
      .join(",");
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, company_name")
      .or(filters)
      .order("name");
    if (error) throw error;
    for (const client of (data ?? []) as ClientLookup[]) {
      clientsById.set(client.id, client);
    }
  }
  return Array.from(clientsById.values());
}

async function loadDevicesBySerial(serials: string[]) {
  const devices: { id: string; serial: string | null }[] = [];
  for (const chunk of chunks(serials.map(orValue).filter(Boolean), 50)) {
    const filters = chunk.map((serial) => `serial.ilike.${serial}`).join(",");
    const { data, error } = await supabase.from("devices").select("id, serial").or(filters);
    if (error) throw error;
    devices.push(...((data ?? []) as { id: string; serial: string | null }[]));
  }
  return devices;
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows;
}
