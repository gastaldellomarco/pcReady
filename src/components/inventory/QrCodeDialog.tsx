import { Download, Printer } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Modal } from "@/components/pcready/Modal";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { deviceUrl, labelHtml } from "@/lib/inventory-labels";

/**
 *
 */
export interface QrDevice {
  id: string;
  serial: string | null;
  model: string;
}

interface Props {
  device: QrDevice | null;
  onClose: () => void;
}

/**
 *
 */
export function QrCodeDialog({ device, onClose }: Props) {
  const { t } = useTranslation("inventory");
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let active = true;
    setDataUrl("");
    if (!device) return;

    QRCode.toDataURL(deviceUrl(device.id), { width: 256, margin: 2 })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : t("qrCode.qrError", "Errore generazione QR"),
        ),
      );

    return () => {
      active = false;
    };
  }, [device, t]);

  if (!device) return null;

  function downloadPng() {
    if (!dataUrl || !device) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `pcready-${safeName(device.serial || device.id)}.png`;
    link.click();
  }

  function printLabel() {
    if (!dataUrl || !device) return;
    const win = window.open("", "_blank", "width=520,height=420");
    if (!win)
      return toast.error(
        t("qrCode.popupBlocked", "Popup bloccato: consenti l'apertura per stampare l'etichetta"),
      );

    win.document.write(labelHtml([{ device, dataUrl }]));
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={t("qrCode.title", "QR dispositivo")}
      footer={
        <>
          <button className="pc-btn pc-btn-ghost" onClick={downloadPng} disabled={!dataUrl}>
            <Download className="size-3" /> {t("qrCode.downloadPng", "Scarica PNG")}
          </button>
          <button className="pc-btn pc-btn-primary" onClick={printLabel} disabled={!dataUrl}>
            <Printer className="size-3" /> {t("qrCode.printLabel", "Stampa etichetta")}
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-[280px] w-[280px] flex items-center justify-center rounded-md border"
          style={{ borderColor: "var(--border)", background: "#fff" }}
        >
          {dataUrl ? (
            <OptimizedImage
              src={dataUrl}
              alt={`QR ${device.serial || device.id}`}
              width={256}
              height={256}
              className="h-64 w-64"
            />
          ) : (
            <span className="text-sm text-text3">{t("qrCode.generating", "Generazione...")}</span>
          )}
        </div>
        <div className="text-center">
          <div className="font-mono text-[13px] font-semibold">{device.serial || "-"}</div>
          <div className="text-[13px] text-text2">{device.model}</div>
        </div>
      </div>
    </Modal>
  );
}

function safeName(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
}
