import { CheckCircle2, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/pcready/Modal";
import { formatPortalExpiry } from "./formatPortalExpiry";

/**
 *
 */
export function PortalLinkModal({
  portalLink,
  copied,
  onClose,
  onCopy,
}: {
  portalLink: {
    contactName: string;
    clientName: string;
    loginUrl: string;
    expiresAt: string;
  } | null;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  const { t } = useTranslation("clients");
  return (
    <Modal
      open={!!portalLink}
      onClose={onClose}
      title={t("portal.modalTitle", "Link accesso portale")}
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={onClose}>
            {t("portal.close", "Chiudi")}
          </button>
          <button className="pc-btn pc-btn-primary" onClick={onCopy}>
            {copied ? (
              <>
                <CheckCircle2 className="size-3" /> {t("portal.copied", "Copiato")}
              </>
            ) : (
              <>
                <Copy className="size-3" /> {t("portal.copyLink", "Copia link")}
              </>
            )}
          </button>
        </>
      }
    >
      {portalLink && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="pc-label">{t("portal.contact", "Referente")}</div>
            <div className="text-[13px] font-semibold">{portalLink.contactName}</div>
            <div className="text-[12px] text-text3">{portalLink.clientName}</div>
          </div>
          <div>
            <div className="pc-label">{t("portal.link", "Link")}</div>
            <div
              className="break-all rounded-md border px-3 py-2 font-mono text-[12px]"
              style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
            >
              {portalLink.loginUrl}
            </div>
          </div>
          <div
            className="rounded-md border px-3 py-2 text-[12.5px] text-text2"
            style={{ borderColor: "var(--border)" }}
          >
            {t("portal.expiresOn", {
              defaultValue: "Scade il {{date}}",
              date: formatPortalExpiry(portalLink.expiresAt),
            })}
          </div>
          <div
            className="rounded-md border px-3 py-2 text-[12.5px]"
            style={{ borderColor: "var(--warn)", background: "rgba(239, 152, 39, .08)" }}
          >
            {t(
              "portal.warning",
              "Condividi questo link direttamente con il cliente. Chiunque lo riceva potra' accedere al portale come questo referente fino alla scadenza o alla revoca.",
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
