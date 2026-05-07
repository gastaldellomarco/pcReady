import { supabase } from "@/integrations/supabase/client";
import type { Database, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type DeviceStatus = Database["public"]["Enums"]["device_status"];

export const DEVICE_STATUSES: DeviceStatus[] = ["available", "assigned", "maintenance", "retired"];
export const INVENTORY_CSV_HEADERS = [
  "serial",
  "model",
  "os",
  "status",
  "client_name",
  "notes",
] as const;

export interface CsvRow {
  rowNumber: number;
  serial: string;
  model: string;
  os: string | null;
  status: DeviceStatus;
  client_name: string;
  notes: string | null;
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
  return `${INVENTORY_CSV_HEADERS.join(",")}\nABC123,Dell Latitude 5540,Windows 11 Pro,available,Cliente Demo,Prima fornitura`;
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
    return {
      rowNumber: offset + 2,
      serial: read("serial"),
      model: read("model"),
      os: read("os") || null,
      status: (read("status") || "available") as DeviceStatus,
      client_name: read("client_name"),
      notes: read("notes") || null,
    };
  });
}

export async function loadInventoryImportContext() {
  const [{ data: clients, error: clientsError }, { data: devices, error: devicesError }] =
    await Promise.all([
      supabase.from("clients").select("id, name, company_name").order("name"),
      supabase.from("devices").select("id, serial"),
    ]);

  if (clientsError) throw clientsError;
  if (devicesError) throw devicesError;

  return {
    clients: (clients ?? []) as ClientLookup[],
    devices: (devices ?? []) as { id: string; serial: string | null }[],
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
          model: row.model,
          os: row.os,
          status: row.status,
          notes: row.notes,
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
          model: row.model,
          os: row.os,
          status: row.status,
          notes: row.notes,
          created_by: userId,
        };
        const { error } = await supabase.from("devices").insert(insert);
        if (error) throw error;
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

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
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
