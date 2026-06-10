import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Hashes a portal password using PBKDF2-SHA256.
 * Returns a formatted string: pbkdf2_sha256$120000$<salt>$<hash>
 */
export function hashPortalPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 120_000, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

/**
 * Verifies a plaintext password against a stored PBKDF2 hash.
 * Returns false if the stored hash is null/undefined or malformed.
 */
export function verifyPortalPassword(
  password: string,
  stored: string | null | undefined,
): boolean {
  if (!stored) return false;
  const [algo, iterationsRaw, salt, hash] = stored.split("$");
  if (algo !== "pbkdf2_sha256" || !iterationsRaw || !salt || !hash) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations)) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, "sha256");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
