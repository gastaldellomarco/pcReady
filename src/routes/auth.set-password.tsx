import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";
import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { initTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/set-password")({
  head: () => ({
    meta: [
      { title: "Imposta password - PCReady" },
      {
        name: "description",
        content: "Completa l'invito impostando la password del tuo account PCReady.",
      },
    ],
  }),
  component: SetPasswordPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: "var(--bg2)" }}
    >
      <div className="w-full max-w-md">
        <LoadingSkeleton />
      </div>
    </div>
  ),
});

function SetPasswordPage() {
  const { session, profile, loading, profileLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    initTheme();
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(() => {
      if (active) setSessionReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && !profileLoading && session && profile?.password_set) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, navigate, profile?.password_set, profileLoading, session]);

  async function handleSetPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user) {
      toast.error("Sessione invito non valida o scaduta");
      return;
    }
    if (password !== confirm) {
      toast.error("Le password non coincidono");
      return;
    }
    if (password.length < 8) {
      toast.error("La password deve essere di almeno 8 caratteri");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { ...session.user.user_metadata, password_set: true },
      });
      if (error) throw error;

      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert(
          { id: session.user.id, password_set: true, updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );
      if (profileError) throw profileError;

      await refreshProfile();
      toast.success("Password impostata con successo");
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(errorMessage(error, "Errore impostazione password"));
    } finally {
      setBusy(false);
    }
  }

  const waitingForSession = loading || profileLoading || !sessionReady;
  const missingSession = sessionReady && !loading && !session;

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "var(--bg2)" }}
    >
      <Card className="w-full max-w-md pc-anim-in">
        <CardHeader className="text-center">
          <div
            className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-[10px]"
            style={{ background: "var(--text)" }}
          >
            <KeyRound className="h-5 w-5" style={{ color: "var(--background)" }} />
          </div>
          <CardTitle>Benvenuto in PCReady</CardTitle>
          <CardDescription>
            Imposta una password per completare la registrazione e accedere all'app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {waitingForSession ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-text3">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifica invito...
            </div>
          ) : missingSession ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-text3">
                Il link di invito non e' valido o e' scaduto. Richiedi un nuovo invito
                all'amministratore.
              </p>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => navigate({ to: "/auth" })}
              >
                Torna al login
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSetPassword}>
              <div className="space-y-2">
                <Label htmlFor="password">Nuova password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimo 8 caratteri"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Conferma password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  minLength={8}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Ripeti la password"
                  autoComplete="new-password"
                />
              </div>
              <Button className="w-full" type="submit" disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {busy ? "Salvataggio..." : "Imposta password e accedi"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
