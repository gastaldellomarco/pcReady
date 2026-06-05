import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/pcready/Modal";
import type { IScannerControls } from "@zxing/browser";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  targetLabel?: string;
  mode?: "inventory" | "barcode-1d";
}

export const SUPPORTED_1D_BARCODE_FORMATS = [
  "Code 128",
  "Code 39",
  "Code 93",
  "Codabar",
  "ITF",
  "EAN-13",
  "EAN-8",
  "UPC-A",
  "UPC-E",
] as const;

/**
 *
 */
export function BarcodeScanner({
  open,
  onClose,
  onDetected,
  targetLabel = "seriale o asset tag",
  mode = "inventory",
}: Props) {
  const { t } = useTranslation("inventory");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");

  // reset transient state when closing
  function resetState() {
    setError(null);
    setManualCode("");
  }

  useEffect(() => {
    if (!open || !videoRef.current) return;

    let active = true;
    setError(null);
    window.setTimeout(() => inputRef.current?.focus(), 80);

    if (!canUseCamera()) {
      setError(cameraUnavailableMessage());
      return () => {
        active = false;
      };
    }

    import("@zxing/browser")
      .then(({ BrowserMultiFormatOneDReader, BrowserMultiFormatReader }) => {
        if (!active || !videoRef.current) return null;
        const reader =
          mode === "barcode-1d"
            ? new BrowserMultiFormatOneDReader()
            : new BrowserMultiFormatReader();
        return reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (!active || !result) return;
          const value = result.getText().trim();
          if (!value) return;
          active = false;
          controlsRef.current?.stop();
          onDetected(value);
        });
      })
      .then((controls) => {
        if (controls) controlsRef.current = controls;
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : t("barcodeScanner.cameraError", "Impossibile avviare la fotocamera"),
        );
      });

    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [mode, open, onDetected]);

  function submitManualCode() {
    const value = manualCode.trim();
    if (!value) return;
    setManualCode("");
    onDetected(value);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        mode === "barcode-1d"
          ? t("barcodeScanner.title1d", "Leggi barcode 1D")
          : t("barcodeScanner.title", "Scansiona codice inventario")
      }
      size="lg"
    >
      <div className="flex flex-col gap-3">
        {mode === "barcode-1d" ? (
          <div
            className="rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
          >
            <div className="font-semibold">Destinazione: {targetLabel}</div>
            <div className="mt-1 text-xs text-text3">
              Funzione diversa dal QR code inventario: legge codici lineari 1D per compilare seriali
              e asset tag.
            </div>
          </div>
        ) : null}
        <div
          className="aspect-video overflow-hidden rounded-md border"
          style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
        >
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        </div>
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : mode === "barcode-1d" ? (
          <div className="text-xs text-text3">
            Inquadra un barcode 1D. Formati supportati: {SUPPORTED_1D_BARCODE_FORMATS.join(", ")}.
          </div>
        ) : (
          <div className="text-xs text-text3">
            Inquadra un QR inventario o un codice compatibile per cercare il dispositivo.
          </div>
        )}
        <div className="text-xs text-text3">
          Scanner USB/Bluetooth keyboard-wedge: punta il lettore su questo campo, poi scansiona.
          Invio conferma automaticamente il valore letto.
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="pc-input font-mono"
            placeholder={
              mode === "barcode-1d"
                ? "Seriale o asset tag da barcode"
                : "Seriale, asset tag o contenuto QR"
            }
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitManualCode();
            }}
          />
          <button className="pc-btn pc-btn-primary" onClick={submitManualCode}>
            {mode === "barcode-1d" ? "Applica" : "Cerca"}
          </button>
        </div>
        <div className="flex justify-end">
          <button className="pc-btn pc-btn-ghost" onClick={handleClose}>
            Chiudi
          </button>
        </div>
      </div>
    </Modal>
  );
}

function canUseCamera() {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof window !== "undefined" &&
    window.isSecureContext
  );
}

function cameraUnavailableMessage() {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "La fotocamera richiede HTTPS o localhost. Puoi comunque inserire/scansionare il codice nel campo sotto.";
  }
  return "Fotocamera non disponibile in questo browser. Puoi comunque inserire/scansionare il codice nel campo sotto.";
}
