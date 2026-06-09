import {
  ArrowRightLeft,
  ClipboardCheck,
  Clock,
  History,
  PenLine,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/pcready";
import {
  useActiveCheckout,
  useTicketCheckouts,
  useCheckoutDevice,
  useCheckinDevice,
  type DeviceCheckout,
} from "@/lib/queries/device-checkouts";

// ── Signature Canvas Hook ──

function useSignatureCanvas(
  onSignatureChange: (hasDrawing: boolean) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
  }, []);

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    onSignatureChange(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSignatureChange(false);
  };

  const getDataUrl = () => canvasRef.current?.toDataURL("image/png") ?? "";

  return {
    canvasRef,
    getDataUrl,
    clearSignature,
    handlers: {
      onMouseDown: startDrawing,
      onMouseMove: draw,
      onMouseUp: stopDrawing,
      onMouseLeave: stopDrawing,
      onTouchStart: startDrawing,
      onTouchMove: draw,
      onTouchEnd: stopDrawing,
    },
  };
}

// ── Signature Dialog Component ──

function SignatureDialog({
  title,
  subtitle,
  busy,
  showNotes,
  notesValue,
  onNotesChange,
  onConfirm,
  onClose,
}: {
  title: string;
  subtitle: string;
  busy: boolean;
  showNotes?: boolean;
  notesValue?: string;
  onNotesChange?: (value: string) => void;
  onConfirm: (dataUrl?: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("tickets");
  const [hasDrawing, setHasDrawing] = useState(false);
  const canvas = useSignatureCanvas(setHasDrawing);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, busy]);

  return (
    <button
      type="button"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 border-0"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      aria-label="Chiudi"
    >
      <div className="w-full max-w-lg rounded-lg bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-xs text-text3">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-1.5 text-text3 hover:bg-muted hover:text-text"
            aria-label={t("device.checkout.cancel", "Annulla")}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {showNotes && onNotesChange && (
            <label className="block text-xs">
              <span className="pc-label">
                {t("device.checkout.conditionNotes", "Note condizioni")}
              </span>
              <textarea
                className="pc-input mt-1 min-h-[70px] w-full"
                value={notesValue ?? ""}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder={t(
                  "device.checkout.notesPlaceholder",
                  "Condizioni del dispositivo, danni, note...",
                )}
              />
            </label>
          )}

          <p className="text-sm text-text3">
            {t("device.checkout.signatureHint", "Disegna la firma nel riquadro sottostante")}
          </p>

          <div
            className="rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30"
            style={{ touchAction: "none" }}
          >
            <canvas
              ref={canvas.canvasRef}
              className="h-40 w-full cursor-crosshair rounded-lg"
              {...canvas.handlers}
            />
          </div>

          <div className="flex justify-between">
            <button
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={canvas.clearSignature}
              disabled={!hasDrawing || busy}
            >
              {t("device.checkout.clearSignature", "Cancella")}
            </button>
            <button
              className="pc-btn pc-btn-primary pc-btn-sm gap-2"
              onClick={() => {
                const dataUrl = hasDrawing ? canvas.getDataUrl() : undefined;
                onConfirm(dataUrl);
              }}
              disabled={busy}
            >
              <PenLine className="size-3" />
              {busy
                ? t("device.checkout.signing", "Salvataggio...")
                : t("device.checkout.sign", "Firma e conferma")}
            </button>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Main Component ──

/**
 * Check-in / Check-out panel for devices assigned to a ticket.
 * Renders inside TicketDetailModal below the connected devices section.
 */
export function TicketDeviceCheckout({
  ticketId,
  deviceId,
  canEdit,
  technicianId,
}: {
  ticketId: string;
  deviceId: string | null;
  canEdit: boolean;
  technicianId: string;
}) {
  const { t } = useTranslation("tickets");

  const activeQuery = useActiveCheckout(deviceId);
  const historyQuery = useTicketCheckouts(ticketId);
  const checkoutMut = useCheckoutDevice();
  const checkinMut = useCheckinDevice();

  const active = useMemo(
    () => (activeQuery.data ?? null) as DeviceCheckout | null,
    [activeQuery.data],
  );
  const history = useMemo(
    () => (historyQuery.data ?? []) as DeviceCheckout[],
    [historyQuery.data],
  );

  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showCheckinDialog, setShowCheckinDialog] = useState(false);
  const [checkinNotes, setCheckinNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const canCheckIn =
    canEdit && active !== null && active.technician_id === technicianId;

  async function handleCheckout(signatureDataUrl?: string) {
    if (!deviceId) return;
    setBusy(true);
    try {
      await checkoutMut.mutateAsync({
        deviceId,
        ticketId,
        technicianId,
        signatureDataUrl,
      });
      setShowCheckoutDialog(false);
      toast.success(t("device.checkout.checkoutSuccess", "Dispositivo preso in carico"));
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : t("device.checkout.checkoutError", "Errore durante il check-out"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckin(signatureDataUrl?: string) {
    if (!active || !deviceId) return;
    setBusy(true);
    try {
      await checkinMut.mutateAsync({
        checkoutId: active.id,
        deviceId,
        ticketId,
        technicianId,
        signatureDataUrl,
        conditionNotes: checkinNotes.trim() || undefined,
      });
      setCheckinNotes("");
      setShowCheckinDialog(false);
      toast.success(t("device.checkout.checkinSuccess", "Dispositivo restituito"));
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : t("device.checkout.checkinError", "Errore durante il check-in"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!deviceId) return null;

  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="size-4" />
          <span className="text-[13px] font-bold">
            {t("device.checkout.title", "Check-in / Check-out")}
          </span>
        </div>

        {active ? (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{
                color: "var(--warning)",
                background: "var(--warning-light, #fef3c7)",
                borderColor: "var(--warning)",
              }}
            >
              <Clock className="size-2.5" />
              {t("device.checkout.checkedOut", "In carico")}
            </span>
            {canCheckIn && (
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                onClick={() => {
                  setCheckinNotes("");
                  setShowCheckinDialog(true);
                }}
              >
                <ClipboardCheck className="size-3" />{" "}
                {t("device.checkout.checkin", "Check-in")}
              </button>
            )}
          </div>
        ) : (
          canEdit && (
            <button
              className="pc-btn pc-btn-primary pc-btn-sm"
              onClick={() => setShowCheckoutDialog(true)}
            >
              <ArrowRightLeft className="size-3" />{" "}
              {t("device.checkout.checkout", "Check-out")}
            </button>
          )
        )}
      </div>

      {/* Active checkout info */}
      {active && (
        <div
          className="mb-2 rounded-md border bg-background p-2.5 text-xs"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {active.technician?.full_name ?? "Tecnico"}
            </span>
            <span className="text-text3">
              {t("device.checkout.since", "dal")} {fmtDateTime(active.checkout_at)}
            </span>
          </div>
          {active.condition_notes && (
            <div className="mt-1 text-text2 whitespace-pre-wrap">
              {active.condition_notes}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-text3">
            <History className="size-3" />{" "}
            {t("device.checkout.history", "Storico check-in/out")}
          </div>
          <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md border bg-background p-2 text-xs"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold">
                      {item.technician?.full_name ?? "Tecnico"}
                    </span>
                    <span className="text-text3">{fmtDateTime(item.checkout_at)}</span>
                    {item.checkin_at ? (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ color: "var(--success)", background: "var(--success-light, #dcfce7)" }}
                      >
                        {t("device.checkout.returned", "Restituito")}{" "}
                        {fmtDateTime(item.checkin_at)}
                      </span>
                    ) : (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                        style={{ color: "var(--warning)", background: "var(--warning-light, #fef3c7)" }}
                      >
                        {t("device.checkout.active", "In corso")}
                      </span>
                    )}
                  </div>
                  {item.condition_notes && (
                    <div className="mt-0.5 text-text2 line-clamp-2">
                      {item.condition_notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Check-out Dialog */}
      {showCheckoutDialog && (
        <SignatureDialog
          title={t("device.checkout.checkoutDialogTitle", "Check-out dispositivo")}
          subtitle={t(
            "device.checkout.checkoutDialogSubtitle",
            "Firma per confermare la presa in carico del dispositivo",
          )}
          busy={busy}
          onConfirm={handleCheckout}
          onClose={() => setShowCheckoutDialog(false)}
        />
      )}

      {/* Check-in Dialog */}
      {showCheckinDialog && (
        <SignatureDialog
          title={t("device.checkout.checkinDialogTitle", "Check-in dispositivo")}
          subtitle={t(
            "device.checkout.checkinDialogSubtitle",
            "Firma per confermare la restituzione del dispositivo",
          )}
          busy={busy}
          showNotes
          notesValue={checkinNotes}
          onNotesChange={setCheckinNotes}
          onConfirm={handleCheckin}
          onClose={() => {
            setCheckinNotes("");
            setShowCheckinDialog(false);
          }}
        />
      )}
    </div>
  );
}
