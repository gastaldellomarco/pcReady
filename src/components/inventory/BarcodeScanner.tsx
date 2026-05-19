import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Modal } from "@/components/pcready/Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
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

    if (!canUseCamera()) {
      setError(cameraUnavailableMessage());
      return () => {
        active = false;
      };
    }

    import("@zxing/browser")
      .then(({ BrowserMultiFormatReader }) => {
        if (!active || !videoRef.current) return null;
        const reader = new BrowserMultiFormatReader();
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
        setError(err instanceof Error ? err.message : "Impossibile avviare la fotocamera");
      });

    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected]);

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
    <Modal open={open} onClose={handleClose} title="Scansiona codice" size="lg">
      <div className="flex flex-col gap-3">
        <div
          className="aspect-video overflow-hidden rounded-md border"
          style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
        >
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        </div>
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : (
          <div className="text-xs text-text3">
            Inquadra un QR o barcode. Funziona anche con scanner esterni che inseriscono testo nel
            sistema.
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="pc-input font-mono"
            placeholder="Seriale o contenuto QR"
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitManualCode();
            }}
          />
          <button className="pc-btn pc-btn-primary" onClick={submitManualCode}>
            Cerca
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
