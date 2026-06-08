/**
 * Format portal link expiry date in Italian locale using native Date API.
 */
export function formatPortalExpiry(expiresAt: string): string {
  try {
    return new Date(expiresAt).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return expiresAt;
  }
}
