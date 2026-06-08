import { createLazyFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { errorMessage } from "@/lib/errors";
import { logMfaAuditEvent, verifyBackupCode } from "@/lib/mfa";
import {
  clearChallengeStarted,
  markBackupVerified,
  rememberChallengeStarted,
} from "@/lib/mfa-client";

export const Route = createLazyFileRoute("/auth/2fa-challenge")({
  component: TwoFactorChallengePage,
});

function TwoFactorChallengePage() {
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const checkBackupCode = useServerFn(verifyBackupCode);
  const logMfaEvent = useServerFn(logMfaAuditEvent);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const totpInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const accessToken = session?.access_token;
  const maskedEmail = useMemo(() => user?.email ?? "account", [user?.email]);

  const createChallenge = useCallback(async () => {
    try {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const factor = (factorsData?.totp ?? []).find((item) => item.status === "verified");
      if (!factor) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setFactorId(factor.id);
      const { data, error } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (error) throw error;
      setChallengeId(data.id);
    } catch (error) {
      toast.error(errorMessage(error, "Impossibile avviare la verifica 2FA"));
    }
  }, [navigate]);

  const verifyTotp = useCallback(
    async (value = code) => {
      if (!accessToken || !factorId || !challengeId || value.length !== 6) return;
      setBusy(true);
      try {
        const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: value });
        if (error) throw error;
        await logMfaEvent({
          data: {
            accessToken,
            actionType: "mfa_login_totp",
            message: "Login completato con 2FA TOTP",
          },
        });
        clearChallengeStarted();
        toast.success("Verifica completata");
        navigate({ to: "/dashboard", replace: true });
      } catch (error) {
        await logMfaEvent({
          data: {
            accessToken,
            actionType: "mfa_verify_failed",
            message: "Verifica 2FA TOTP fallita",
            severity: "warning",
          },
        }).catch(() => {});
        setCode("");
        toast.error(errorMessage(error, "Codice non valido"));
        await createChallenge();
      } finally {
        setBusy(false);
      }
    },
    [accessToken, challengeId, code, createChallenge, factorId, logMfaEvent, navigate],
  );

  useEffect(() => {
    if (!accessToken) return;
    rememberChallengeStarted();
    void createChallenge();
  }, [accessToken, createChallenge]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          void supabase.auth.signOut();
          toast.error("Sessione 2FA scaduta. Effettua nuovamente il login.");
          navigate({ to: "/auth", replace: true });
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [navigate]);

  useEffect(() => {
    if (!useBackup && code.length === 6 && !busy) void verifyTotp(code);
  }, [busy, code, useBackup, verifyTotp]);

  // Focus the appropriate input when toggling between TOTP and backup modes
  useEffect(() => {
    if (useBackup) backupInputRef.current?.focus();
    else totpInputRef.current?.focus();
  }, [useBackup]);

  if (!loading && !session) return <Navigate to="/auth" replace />;

  async function verifyBackup() {
    if (!accessToken || !user || backupCode.replace(/\s+/g, "").length < 8) return;
    setBusy(true);
    try {
      await checkBackupCode({ data: { accessToken, code: backupCode } });
      markBackupVerified(user.id);
      clearChallengeStarted();
      toast.success("Accesso completato con codice di backup");
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(errorMessage(error, "Codice di backup non valido"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "var(--bg2)" }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <ShieldCheck className="mx-auto size-10 text-emerald-600" />
          <CardTitle>Verifica in due passaggi</CardTitle>
          <CardDescription>
            Inserisci il codice per {maskedEmail}. Tempo residuo:{" "}
            {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!useBackup ? (
            <>
              <Input
                inputMode="numeric"
                ref={totpInputRef}
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="text-center text-2xl tracking-[0.5em] font-mono"
                disabled={busy}
              />
              <Button
                className="w-full"
                onClick={() => verifyTotp()}
                disabled={busy || code.length !== 6}
              >
                {busy ? "Verifica..." : "Verifica"}
              </Button>
              <button
                className="w-full text-sm text-primary underline"
                onClick={() => setUseBackup(true)}
              >
                Usa codice di backup
              </button>
            </>
          ) : (
            <>
              <Input
                ref={backupInputRef}
                value={backupCode}
                onChange={(event) => setBackupCode(event.target.value.toUpperCase())}
                placeholder="ABCD-1234-EF"
                className="text-center font-mono"
                disabled={busy}
              />
              <Button
                className="w-full"
                onClick={verifyBackup}
                disabled={busy || backupCode.length < 8}
              >
                {busy ? "Verifica..." : "Usa codice di backup"}
              </Button>
              <button
                className="w-full text-sm text-primary underline"
                onClick={() => setUseBackup(false)}
              >
                Usa codice dall&apos;app
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
