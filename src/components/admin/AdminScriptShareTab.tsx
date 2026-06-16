import { useServerFn } from "@tanstack/react-start";
import { Link2, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImpersonationReadOnlyBanner } from "@/components/admin/ImpersonationReadOnlyBanner";
import { TabsContent } from "@/components/ui/tabs";
import { copyToClipboard } from "@/lib/clipboard";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import {
  listAllScriptShareLinks,
  revokeScriptShareLink,
} from "@/lib/scripts-share";

interface ShareLinkRow {
  id: string;
  token: string;
  expires_at: string | null;
  is_revoked: boolean | null;
  created_at: string | null;
  created_by: string | null;
  creator_name: string | null;
  scripts: {
    id: string;
    name: string;
    category: string;
    language: string;
  };
}

interface AdminScriptShareTabProps {
  accessToken: string | undefined;
}

/**
 *
 */
export function AdminScriptShareTab({ accessToken }: AdminScriptShareTabProps) {
  const { t } = useTranslation("admin");
  const { isImpersonating, isAdmin } = useAuth();
  const readOnly = isImpersonating && !isAdmin;
  const listAll = useServerFn(listAllScriptShareLinks);
  const revokeLink = useServerFn(revokeScriptShareLink);
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function loadLinks() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await listAll({
        data: { accessToken },
      });
      setLinks(data as ShareLinkRow[]);
    } catch (error) {
      toast.error(errorMessage(error, "Errore caricamento link condivisi"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLinks();
     
  }, [accessToken]);

  async function handleRevoke(linkId: string) {
    if (!accessToken) return;
    setRevokingId(linkId);
    try {
      await revokeLink({
        data: { accessToken, linkId },
      });
      setLinks((prev) =>
        prev.map((l) => (l.id === linkId ? { ...l, is_revoked: true } : l)),
      );
      toast.success("Link revocato");
    } catch (error) {
      toast.error(errorMessage(error, "Errore revoca link"));
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopyToken(token: string) {
    const ok = await copyToClipboard(
      `${window.location.origin}/script?token=${token}`,
    );
    if (ok) {
      toast.success("Link copiato");
    } else {
      toast.error(t("share.copyError", "Select and copy the link manually"));
    }
  }

  function isExpired(expiresAt: string | null) {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  return (
    <TabsContent value="script-shares" className="space-y-4">
      <ImpersonationReadOnlyBanner />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="size-5" />
            Link script condivisi
          </h3>
          <p className="text-sm text-muted-foreground">
            Gestisci tutti i link di condivisione script generati dagli utenti.
          </p>
        </div>
        <button
          className="pc-btn pc-btn-ghost pc-btn-sm"
          onClick={loadLinks}
          disabled={loading}
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          Aggiorna
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-text3">
          Caricamento link...
        </div>
      ) : links.length === 0 ? (
        <div className="py-8 text-center text-sm text-text3">
          Nessun link di condivisione generato.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[12.5px]">
            <thead style={{ background: "var(--surface2)" }}>
              <tr>
                <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                  Script
                </th>
                <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                  Token
                </th>
                <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                  Stato
                </th>
                <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                  Creato da
                </th>
                <th className="px-3 py-2 text-left text-[10.5px] font-bold uppercase text-text3">
                  Creato il
                </th>
                <th className="px-3 py-2 text-right text-[10.5px] font-bold uppercase text-text3">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => {
                const expired = isExpired(link.expires_at);
                const revoked = link.is_revoked;
                return (
                  <tr
                    key={link.id}
                    className="border-t"
                    style={{
                      borderColor: "var(--border)",
                      opacity: revoked || expired ? 0.5 : 1,
                    }}
                  >
                    <td className="px-3 py-2">
                      <div className="font-semibold">{link.scripts?.name || "—"}</div>
                      <div className="text-[11px] text-text3 font-mono">
                        {link.scripts?.category} · {link.scripts?.language}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-[11px]">
                        {link.token.slice(0, 16)}...
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {revoked ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: "var(--surface2)", color: "var(--text3)" }}
                        >
                          <ShieldAlert className="size-2.5" />
                          Revocato
                        </span>
                      ) : expired ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: "rgba(239, 152, 39, .12)", color: "#92400e" }}
                        >
                          Scaduto
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: "rgba(22, 163, 74, .12)", color: "#15803d" }}
                        >
                          Attivo
                        </span>
                      )}
                      {link.expires_at && (
                        <div className="text-[10px] text-text3 mt-0.5">
                          Scade: {new Date(link.expires_at).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-text3">
                      {link.creator_name || "—"}
                    </td>
                    <td className="px-3 py-2 text-text3">
                      {link.created_at
                        ? new Date(link.created_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="pc-btn pc-btn-ghost pc-btn-xs"
                          onClick={() => handleCopyToken(link.token)}
                          title="Copia link"
                          disabled={readOnly}
                        >
                          <Link2 className="size-3" />
                        </button>
                        {!revoked && (
                          <button
                            className="pc-btn pc-btn-ghost pc-btn-xs"
                            disabled={readOnly || revokingId === link.id}
                            onClick={() => handleRevoke(link.id)}
                            style={{ color: revoked || expired ? "var(--text3)" : "var(--danger)" }}
                            title="Revoca"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div
        className="rounded-md border p-3 text-[12px]"
        style={{ borderColor: "var(--warn)", background: "rgba(239, 152, 39, .08)" }}
      >
        {t(
          "scriptShares.info",
          "La revoca di un link impedisce immediatamente l'accesso allo script condiviso. I link scaduti vengono automaticamente disabilitati dal sistema.",
        )}
      </div>
    </TabsContent>
  );
}
