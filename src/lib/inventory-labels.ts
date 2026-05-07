import QRCode from "qrcode";
import { toast } from "sonner";
import type { QrDevice } from "@/components/inventory/QrCodeDialog";

export async function buildLabelItems(devices: QrDevice[]) {
  return Promise.all(
    devices.map(async (device) => ({
      device,
      dataUrl: await QRCode.toDataURL(deviceUrl(device.id), { width: 180, margin: 1 }),
    })),
  );
}

export function printLabelBatch(items: { device: QrDevice; dataUrl: string }[]) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    toast.error("Popup bloccato: consenti l'apertura per stampare le etichette");
    return;
  }
  win.document.write(labelHtml(items));
  win.document.close();
  win.focus();
  win.print();
}

export function deviceUrl(deviceId: string) {
  return `${window.location.origin}/inventory?device=${deviceId}`;
}

export function labelHtml(items: { device: QrDevice; dataUrl: string }[]) {
  const labels = items
    .map(
      ({ device, dataUrl }) => `
        <section class="label">
          <img src="${dataUrl}" alt="QR" />
          <div class="meta">
            <strong>${escapeHtml(device.serial || "-")}</strong>
            <span>${escapeHtml(device.model)}</span>
          </div>
        </section>
      `,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <title>Etichette PCReady</title>
  <style>
    @page { size: A4; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #111827; }
    main { display: grid; grid-template-columns: repeat(5, 38mm); gap: 3mm 2mm; align-items: start; }
    .label { width: 38mm; height: 21mm; display: grid; grid-template-columns: 17mm 1fr; gap: 1.5mm; align-items: center; overflow: hidden; break-inside: avoid; padding: 1.2mm; border: 0.2mm solid #d1d5db; }
    img { width: 16mm; height: 16mm; display: block; }
    .meta { min-width: 0; display: flex; flex-direction: column; gap: 0.8mm; line-height: 1.05; }
    strong { font-size: 7pt; font-family: Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    span { font-size: 6pt; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  </style>
</head>
<body><main>${labels}</main></body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
