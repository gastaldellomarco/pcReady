import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_DEVICE_CATEGORY,
  DEFAULT_DEVICE_TYPE,
  DEVICE_TYPES_BY_CATEGORY,
  isDeviceCategory,
  type DeviceCategory,
} from "@/lib/device-taxonomy";
import { WARRANTY_TYPES, type WarrantyType } from "@/lib/warranty";
import type { Database, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/**
 *
 */
export type DeviceStatus = Database["public"]["Enums"]["device_status"];

export const DEVICE_STATUSES: DeviceStatus[] = ["available", "assigned", "maintenance", "retired"];
export const INVENTORY_CSV_HEADERS = [
  "asset_tag",
  "serial",
  "brand",
  "model",
  "category",
  "device_type",
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

/**
 *
 */
export interface CsvRow {
  rowNumber: number;
  asset_tag?: string | null;
  serial: string | null;
  brand?: string | null;
  model: string;
  category?: DeviceCategory;
  device_type?: string;
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

/**
 *
 */
export interface ClientLookup {
  id: string;
  name: string;
  company_name: string | null;
}

/**
 *
 */
export interface PreviewRow extends CsvRow {
  action: "insert" | "update" | "skip";
  existingDeviceId: string | null;
  client_id: string | null;
  errors: string[];
}

/**
 *
 */
export interface ImportResult {
  inserted: number;
  updated: number;
  errors: { rowNumber: number; serial: string; error: string }[];
}

/**
 *
 */
export function csvTemplate() {
  return `${INVENTORY_CSV_HEADERS.join(",")}\n,DellSN123,Dell,Dell Latitude 5540,endpoint,Laptop,Windows 11 Pro,available,Cliente Demo,Prima fornitura,2026-01-15,2029-01-15,standard,Dell Support,Contratto WTY-123`;
}

/**
 *
 */
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
    const rawCategory = read("category");
    const category = isDeviceCategory(rawCategory) ? rawCategory : DEFAULT_DEVICE_CATEGORY;
    return {
      rowNumber: offset + 2,
      asset_tag: read("asset_tag") || null,
      serial: read("serial"),
      brand: read("brand") || null,
      model: read("model"),
      category,
      device_type: read("device_type") || DEFAULT_DEVICE_TYPE,
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

/**
 *
 */
export async function loadInventoryImportContext(rows: CsvRow[]) {
  const clientNames = uniqueValues(rows.map((row) => row.client_name));
  const serials = uniqueValues(rows.map((row) => row.serial));
  const assetTags = uniqueValues(rows.map((row) => row.asset_tag ?? ""));
  const [clients, devices] = await Promise.all([
    loadClientsByName(clientNames),
    loadDevicesBySerialOrAssetTag(serials, assetTags),
  ]);

  return {
    clients,
    devices,
  };
}

/**
 *
 */
export function validateImportRows(
  rows: CsvRow[],
  clients: ClientLookup[],
  devices: { id: string; asset_tag?: string | null; serial: string | null }[],
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
  const devicesByAssetTag = new Map(
    devices
      .filter((device) => device.asset_tag?.trim())
      .map((device) => [normalizeKey(device.asset_tag as string), device.id]),
  );
  const seenInFile = new Set<string>();

  return rows.map((row) => {
    const errors: string[] = [];
    const serialKey = normalizeKey(row.serial);
    const assetTagKey = normalizeKey(row.asset_tag);
    const client = clientsByName.get(normalizeKey(row.client_name)) ?? null;
    const existingDeviceId =
      devicesByAssetTag.get(assetTagKey) ?? devicesBySerial.get(serialKey) ?? null;
    const category = isDeviceCategory(row.category) ? row.category : DEFAULT_DEVICE_CATEGORY;
    const deviceType = row.device_type || DEFAULT_DEVICE_TYPE;

    if (!row.model) errors.push("Modello obbligatorio");
    if (row.category && !isDeviceCategory(row.category)) errors.push("Categoria non valida");
    if (!DEVICE_TYPES_BY_CATEGORY[category]?.includes(deviceType)) {
      errors.push("Tipo dispositivo non valido per la categoria");
    }
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
    const dedupeKey = assetTagKey ? `asset:${assetTagKey}` : serialKey ? `serial:${serialKey}` : "";
    if (dedupeKey && seenInFile.has(dedupeKey)) errors.push("Identificativo duplicato nel CSV");
    if (dedupeKey) seenInFile.add(dedupeKey);

    return {
      ...row,
      category,
      device_type: deviceType,
      action: errors.length ? "skip" : existingDeviceId ? "update" : "insert",
      existingDeviceId,
      client_id: client?.id ?? null,
      errors,
    };
  });
}

/**
 *
 */
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
          category: row.category ?? DEFAULT_DEVICE_CATEGORY,
          device_type: row.device_type ?? DEFAULT_DEVICE_TYPE,
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
        if (row.asset_tag) update.asset_tag = row.asset_tag;
        const { error } = await supabase
          .from("devices")
          .update(update)
          .eq("id", row.existingDeviceId);
        if (error) throw error;
        results.updated++;
      } else {
        const insert: TablesInsert<"devices"> = {
          client_id: row.client_id!,
          asset_tag: row.asset_tag ?? "",
          serial: row.serial,
          category: row.category ?? DEFAULT_DEVICE_CATEGORY,
          device_type: row.device_type ?? DEFAULT_DEVICE_TYPE,
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
        serial: row.asset_tag || row.serial || "",
        error: error instanceof Error ? error.message : "Errore import",
      });
    } finally {
      onProgress?.(i + 1, validRows.length);
    }
  }

  return results;
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

export function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function uniqueValues(values: (string | null | undefined)[]) {
  return Array.from(new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)));
}

export function orValue(value: string) {
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

async function loadDevicesBySerialOrAssetTag(serials: string[], assetTags: string[]) {
  const devices: { id: string; asset_tag: string | null; serial: string | null }[] = [];
  for (const chunk of chunks(serials.map(orValue).filter(Boolean), 50)) {
    const filters = chunk.map((serial) => `serial.ilike.${serial}`).join(",");
    const { data, error } = await supabase
      .from("devices")
      .select("id, asset_tag, serial")
      .or(filters);
    if (error) throw error;
    devices.push(
      ...((data ?? []) as { id: string; asset_tag: string | null; serial: string | null }[]),
    );
  }
  for (const chunk of chunks(assetTags.map(orValue).filter(Boolean), 50)) {
    const filters = chunk.map((assetTag) => `asset_tag.ilike.${assetTag}`).join(",");
    const { data, error } = await supabase
      .from("devices")
      .select("id, asset_tag, serial")
      .or(filters);
    if (error) throw error;
    devices.push(
      ...((data ?? []) as { id: string; asset_tag: string | null; serial: string | null }[]),
    );
  }
  return devices;
}

export function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export function parseCsv(text: string): string[][] {
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
