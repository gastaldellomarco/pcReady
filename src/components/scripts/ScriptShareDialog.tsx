import { Copy, Link2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Modal } from "@/components/pcready/Modal";
import { Field } from "@/components/ui/form-field";
import { useAuth } from "@/lib/auth-context";
import { copyToClipboard } from "@/lib/clipboard";
import { errorMessage } from "@/lib/errors";
import {
  createScriptShareLink,
  listScriptShareLinks,
  revokeScriptShareLink,
} from "@/lib/scripts-share";

interface ShareLink {
  id: string;
  token: string;
  expires_at: string | null;
  is_revoked: boolean;
  created_at: string;
}

interface ScriptShareDialogProps {
  scriptId: string;
  open: boolean;
  onClose: () => void;
}

/**
 *
 */
export function ScriptShareDialog({ scriptId, open, onClose }: ScriptShareDialogProps) {
  const { t } = useTranslation("scripts");
  const { session } = useAuth();
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState<string>("never");
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [generatedUrl, setGeneratedUrl] = useState("");

  const mountedRef = useRef(true);
  mountedRef.current = true; // always true during render, survives Strict Mode double-fire

  const loadLinks = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const data = await listScriptShareLinks({
        data: {
          accessToken: session.access_token,
          scriptId,
        },
      });
      if (mountedRef.current) {
        setLinks((data ?? []) as ShareLink[]);
      }
    } catch (err) {
      console.error("Failed to load script share links", err);
      toast.error(t("share.loadLinksError", "Errore caricamento link"));
    }
  }, [session?.access_token, scriptId]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (open && session?.access_token) {
      loadLinks();
    }
  }, [open, loadLinks]);

  async function generateLink() {
    if (!password.trim()) {
      toast.error(t("share.passwordRequired", "La password è obbligatoria"));
      return;
    }
    if (!session?.access_token) return;
    setBusy(true);
    try {
      const hoursMap: Record<string, number | null> = {
        "24h": 24,
        "7d": 168,
        "30d": 720,
        never: null,
      };
      const created = await createScriptShareLink({
        data: {
          accessToken: session.access_token,
          scriptId,
          password,
          expiresInHours: hoursMap[expiry],
        },
      });

      setGeneratedUrl(`${window.location.origin}/script?token=${(created as any).token}`);
      setPassword("");
      toast.success(t("share.linkCreated", "Link creato"));
      loadLinks();
    } catch (error) {
      toast.error(errorMessage(error, t("share.createError", "Errore creazione link")));
    } finally {
      setBusy(false);
    }
  }

  async function revokeLink(linkId: string) {
    if (!session?.access_token) return;
    try {
      await revokeScriptShareLink({
        data: {
          accessToken: session.access_token,
          linkId,
        },
      });
      toast.success(t("share.revoked", "Link revocato"));
      loadLinks();
    } catch (error) {
      toast.error(errorMessage(error, t("share.revokeError", "Errore revoca link")));
    }
  }

  async function copyUrl(url: string) {
    const ok = await copyToClipboard(url);
    if (ok) {
      toast.success(t("share.copied", "Link copiato"));
    } else {
      toast.error(t("share.copyError", "Seleziona e copia il link manualmente"));
    }
  }

  function formatExpiry(expiresAt: string | null) {
    if (!expiresAt) return t("share.never", "Mai");
    return new Date(expiresAt).toLocaleDateString();
  }

  function isExpired(expiresAt: string | null) {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("share.title", "Condividi script")}
      footer={
        <button className="pc-btn pc-btn-ghost" onClick={onClose}>
          {t("share.close", "Chiudi")}
        </button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-text2">
          {t("share.description", "Genera un link protetto da password per condividere questo script con un cliente.")}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("share.password", "Password *")}>
            <input
              className="pc-input"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("share.passwordPlaceholder", "Password per il cliente")}
            />
          </Field>
          <Field label={t("share.expiry", "Scadenza")}>
            <select className="pc-input" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              <option value="24h">{t("share.expiry24h", "24 ore")}</option>
              <option value="7d">{t("share.expiry7d", "7 giorni")}</option>
              <option value="30d">{t("share.expiry30d", "30 giorni")}</option>
              <option value="never">{t("share.expiryNever", "Mai")}</option>
            </select>
          </Field>
        </div>

        <button className="pc-btn pc-btn-primary" onClick={generateLink} disabled={busy || !password.trim()}>
          <Link2 className="size-3" />{" "}
          {busy ? t("share.generating", "Generazione...") : t("share.generate", "Genera link")}
        </button>

        {generatedUrl && (
          <div
            className="rounded-md border p-3 space-y-2"
            style={{ borderColor: "var(--accent)", background: "var(--surface2)" }}
          >
            <div className="text-xs font-bold text-accent">{t("share.linkReady", "Link pronto")}</div>
            <div className="break-all font-mono text-[12px]">{generatedUrl}</div>
            <button className="pc-btn pc-btn-primary pc-btn-sm" onClick={() => copyUrl(generatedUrl)}>
              <Copy className="size-3" /> {t("share.copyLink", "Copia link")}
            </button>
          </div>
        )}

        <div
          className="rounded-md border p-3 text-[12px]"
          style={{ borderColor: "var(--warn)", background: "rgba(239,152,39,.08)" }}
        >
          {t("share.warning", "Chiunque abbia il link e la password può scaricare questo script.")}
        </div>

        {links.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase text-text3">
              {t("share.existingLinks", "Link esistenti")}
            </div>
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-[12px]"
                style={{
                  borderColor: "var(--border)",
                  opacity: link.is_revoked || isExpired(link.expires_at) ? 0.5 : 1,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[11px]">{link.token.slice(0, 12)}...</div>
                  <div className="text-text3">
                    {link.is_revoked
                      ? t("share.revoked", "Revocato")
                      : isExpired(link.expires_at)
                        ? t("share.expired", "Scaduto")
                        : t("share.validUntil", "Valido fino al {{date}}", {
                            date: formatExpiry(link.expires_at),
                          })}
                  </div>
                </div>
                {!link.is_revoked && !isExpired(link.expires_at) && (
                  <button
                    className="pc-btn-icon"
                    onClick={() => revokeLink(link.id)}
                    style={{ color: "var(--danger)" }}
                    title={t("share.revoke", "Revoca")}
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
