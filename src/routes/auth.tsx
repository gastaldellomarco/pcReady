import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { initTheme } from "@/lib/theme";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Accedi — PCReady" },
      { name: "description", content: "Accedi a PCReady per gestire la preparazione dei tuoi PC." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { initTheme(); }, []);

  if (!loading && session) return <Navigate to="/dashboard" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
        if (error) throw error;
        toast.success("Bentornato!");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password: pwd,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account creato! Accedi ora.");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err.message || "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "var(--bg2)" }}>
      <div className="w-full max-w-md pc-anim-in">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ background: "var(--text)" }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="var(--background)" strokeWidth={1.8} className="w-5 h-5">
              <rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" /><path d="M9 11.5h5M11.5 9v5" />
            </svg>
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-head)" }}>PCReady</div>
            <div className="text-[10px] text-text3" style={{ fontFamily: "var(--font-mono)" }}>v3.0 · Cloud</div>
          </div>
        </div>

        <div className="pc-card overflow-hidden">
          <div className="pc-card-hd">
            <span className="pc-card-title">{mode === "login" ? "Accedi" : "Crea account"}</span>
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-xs font-semibold text-accent hover:underline"
            >
              {mode === "login" ? "Registrati" : "Hai già un account?"}
            </button>
          </div>
          <form onSubmit={submit} className="pc-card-body flex flex-col gap-3">
            {mode === "signup" && (
              <div>
                <label className="pc-label">Nome completo</label>
                <input className="pc-input" value={name} onChange={e => setName(e.target.value)} placeholder="Mario Rossi" />
              </div>
            )}
            <div>
              <label className="pc-label">Email</label>
              <input className="pc-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@azienda.it" />
            </div>
            <div>
              <label className="pc-label">Password</label>
              <input className="pc-input" type="password" required minLength={6} value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••" />
            </div>
            <button type="submit" disabled={busy} className="pc-btn pc-btn-primary justify-center mt-1">
              {busy ? "Attendere…" : mode === "login" ? "Accedi" : "Crea account"}
            </button>
            <p className="text-[11px] text-text3 text-center mt-2">
              Il primo utente registrato ottiene il ruolo <strong>Amministratore</strong>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
