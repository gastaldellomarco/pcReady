import { supabase } from "@/integrations/supabase/client";

const BACKUP_VERIFIED_PREFIX = "pcready_mfa_backup_verified_until:";
const CHALLENGE_STARTED_KEY = "pcready_mfa_challenge_started_at";

export type MfaClientStatus = {
  enabled: boolean;
  aal2: boolean;
  needsChallenge: boolean;
  backupVerified: boolean;
};

export function backupVerificationKey(userId: string) {
  return `${BACKUP_VERIFIED_PREFIX}${userId}`;
}

export function markBackupVerified(userId: string, ttlMinutes = 12 * 60) {
  localStorage.setItem(
    backupVerificationKey(userId),
    String(Date.now() + ttlMinutes * 60 * 1000),
  );
}

export function clearBackupVerified(userId?: string | null) {
  if (userId) localStorage.removeItem(backupVerificationKey(userId));
}

export function hasFreshBackupVerification(userId?: string | null) {
  if (!userId) return false;
  const raw = localStorage.getItem(backupVerificationKey(userId));
  const expiresAt = raw ? Number(raw) : 0;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    localStorage.removeItem(backupVerificationKey(userId));
    return false;
  }
  return true;
}

export function rememberChallengeStarted() {
  localStorage.setItem(CHALLENGE_STARTED_KEY, String(Date.now()));
}

export function clearChallengeStarted() {
  localStorage.removeItem(CHALLENGE_STARTED_KEY);
}

export function challengeExpired(timeoutMs = 5 * 60 * 1000) {
  const startedAt = Number(localStorage.getItem(CHALLENGE_STARTED_KEY) || 0);
  return !startedAt || Date.now() - startedAt > timeoutMs;
}

export async function getMfaClientStatus(userId?: string | null): Promise<MfaClientStatus> {
  const [{ data: factorsData, error: factorsError }, { data: aalData, error: aalError }] =
    await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

  if (factorsError) throw factorsError;
  if (aalError) throw aalError;

  const enabled = (factorsData?.totp ?? []).some((factor) => factor.status === "verified");
  const aal2 = aalData.currentLevel === "aal2";
  const backupVerified = hasFreshBackupVerification(userId);

  return {
    enabled,
    aal2,
    backupVerified,
    needsChallenge: enabled && !aal2 && !backupVerified,
  };
}
