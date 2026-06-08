import { createFileRoute } from "@tanstack/react-router";
import { Download, Lock, ShieldAlert } from "lucide-react";
import { useState } from "react";
import i18n from "@/i18n";
import { buildDownloadFileName, downloadText } from "@/lib/downloads";
import { validateScriptShareToken } from "@/lib/scripts-share.server";
import { LoadingSkeleton, RouteError } from "@/components/RouteHelpers";

const REASON_MAP: Record<string, string> = {
  token_invalid: "Link non valido.",
  token_revoked: "Questo link è stato revocato.",
  token_expired: "Questo link è scaduto.",
  wrong_password: "Password non corretta.",
  script_not_found: "Script non trovato.",
};

const LANG_EXT: Record<string, string> = {
  powershell: "ps1",
  bash: "sh",
  python: "py",
  cmd: "bat",
  sql: "sql",
  javascript: "js",
};

export const Route = createFileRoute("/_share/script")({
  head: () => ({
    meta: [
      { title: i18n.t("scripts:share.pageTitle", "Script condiviso — PCReady") },
    ],
  }),
  component: SharedScriptPage,
  errorComponent: (props) => <RouteError {...props} />,
  pendingComponent: () => <LoadingSkeleton />,
});

function SharedScriptPage() {
  const search = Route.useSearch() as { token?: string };
  const token = search.token ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [script, setScript] = useState<any>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setError("Inserisci la password");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await validateScriptShareToken({
        data: { token, password },
      }) as { ok: boolean; data?: any; reason?: string };

      if (!result.ok) {
        setError(REASON_MAP[result.reason ?? ""] ?? "Errore durante la verifica.");
        return;
      }

      setScript(result.data);
    } catch {
      setError("Errore durante la verifica.");
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    if (!script) return;
    const ext = LANG_EXT[script.language] || "txt";
    downloadText(script.content ?? "", buildDownloadFileName(script.name, ext));
  }

  if (script) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--surface)" }}>
        <div className="w-full max-w-2xl rounded-xl border p-6 space-y-4" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
          <div className="flex items-center gap-3">
            <div
              className="size-12 rounded-xl flex items-center justify-center"
              style={{ background: "var(--accent)" + "1A", color: "var(--accent)" }}
            >
              <Download className="size-6" />
            </div>
            <div>
              <h1
                className="text-xl font-bold"
                style={{ fontFamily: "var(--font-head)" }}
              >
                {script.name}
              </h1>
              <div className="flex items-center gap-2 text-xs text-text3 font-mono">
                <span>{script.category}</span>
                <span>·</span>
                <span>{script.language}</span>
              </div>
            </div>
          </div>
          {script.description && (
            <p className="text-sm text-text2">{script.description}</p>
          )}
          <pre
            className="text-[12px] font-mono p-4 rounded-lg overflow-x-auto whitespace-pre-wrap break-words leading-relaxed max-h-[55vh]"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            {script.content || "// Script vuoto"}
          </pre>
          <button className="pc-btn pc-btn-primary w-full" onClick={handleDownload}>
            <Download className="size-4" /> Scarica script ({LANG_EXT[script.language] || "txt"})
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-sm rounded-xl border p-6 space-y-4" style={{ borderColor: "var(--border)", background: "var(--surface2)" }}>
        <div className="text-center">
          <Lock className="size-10 mx-auto mb-2" style={{ color: "var(--accent)" }} />
          <h1
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-head)" }}
          >
            Script condiviso
          </h1>
          <p className="text-sm text-text2 mt-1">
            Inserisci la password per visualizzare e scaricare lo script.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="pc-input w-full text-center text-lg tracking-wider"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            disabled={busy}
            aria-label="Password"
          />
          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <ShieldAlert className="size-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <button className="pc-btn pc-btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Verifica..." : "Sblocca script"}
          </button>
        </form>
        {!token && (
          <p className="text-center text-sm text-destructive">
            Link non valido: token mancante.
          </p>
        )}
      </div>
    </div>
  );
}
