// ─── Tipi di file consentiti e validazione header ─────────────────
// Usato sia da server/attachmentUtils.server.ts (upload server-side)
// che da queries/ticketAttachments.ts (upload client-side).

export const ALLOWED_FILE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
};

/**
 * Estrae l'estensione (incluso punto) dal nome file, lowercase.
 * Restituisce stringa vuota se non trovata.
 */
export function getFileExtension(name: string) {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

/**
 * Verifica se i byte sembrano testo semplice (ASCII/UTF-8 stampabile, senza null byte).
 */
export function isLikelyPlainText(bytes: Uint8Array) {
  if (bytes.includes(0)) return false;
  return Array.from(bytes).every((byte) => {
    return byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 128;
  });
}

/**
 * Rileva il MIME type dai magic byte dell'header del file.
 * Riconosce PNG, JPEG, GIF, WebP, PDF. Rileva anche SVG/HTML
 * tramite ispezione testuale e restituisce "text/html".
 * Restituisce null se il formato non è riconosciuto.
 */
export function detectMimeTypeFromHeader(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf";
  }
  // Basic SVG/HTML detection via textual header
  const headerStr = new TextDecoder().decode(bytes.slice(0, 256)).toLowerCase();
  if (
    headerStr.includes("<svg") ||
    headerStr.includes("<!doctype html") ||
    headerStr.includes("<html")
  ) {
    // Do NOT treat SVG/HTML as allowed image types here
    return "text/html";
  }
  return null;
}
