/**
 *
 */
export type DownloadExtension = "csv" | "pdf" | "text" | "zip" | string;
/**
 *
 */
export type CsvCell = unknown;

/**
 *
 */
export function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/**
 *
 */
export function buildDownloadFileName(
  baseName: string,
  extension: DownloadExtension,
  options: { dated?: boolean; date?: Date } = {},
) {
  const cleanBase = slugFilePart(baseName);
  const suffix = options.dated ? `-${dateStamp(options.date)}` : "";
  const ext = String(extension).replace(/^\./, "");
  return `${cleanBase}${suffix}.${ext}`;
}

/**
 *
 */
export function rowsToCsv(rows: CsvCell[][]) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

/**
 *
 */
export function csvCell(value: CsvCell) {
  const text =
    value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function slugFilePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
