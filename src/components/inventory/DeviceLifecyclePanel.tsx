import {
  ArrowRightLeft,
  FileText,
  History,
  Paperclip,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/pcready";
import {
  LIFECYCLE_PHASES,
  LIFECYCLE_PHASE_LABELS,
  getDeviceAttachmentSignedUrl,
  useDeleteDeviceAttachment,
  useDeviceAttachments,
  useDeviceLifecycleHistory,
  useTransitionDevicePhase,
  useUploadDeviceAttachment,
  type DeviceAttachment,
  type LifecyclePhase,
} from "@/lib/queries/device-lifecycle";

const PHASE_COLORS: Record<LifecyclePhase, string> = {
  warehouse: "var(--slate)",
  configuration: "var(--primary)",
  deployed: "var(--success)",
  repair: "var(--warning)",
  decommissioned: "var(--danger)",
};

function formatBytes(value?: number | null) {
  if (!value) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

/**
 * Panel for managing device lifecycle phases and documents.
 * Used as a tab in DeviceDetailModal.
 */
export function DeviceLifecyclePanel({
  deviceId,
  canEdit,
}: {
  deviceId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation("tickets");
  const { user } = useAuth();

  const historyQuery = useDeviceLifecycleHistory(deviceId);
  const attachmentsQuery = useDeviceAttachments(deviceId);

  const history = useMemo(() => (historyQuery.data ?? []) as any[], [historyQuery.data]);
  const attachments = useMemo(
    () => (attachmentsQuery.data ?? []) as DeviceAttachment[],
    [attachmentsQuery.data],
  );

  const curPhase: LifecyclePhase =
    history.length > 0 ? (history[0]?.phase as LifecyclePhase) : "warehouse";

  const transitionMut = useTransitionDevicePhase();
  const uploadMut = useUploadDeviceAttachment(deviceId);
  const deleteMut = useDeleteDeviceAttachment(deviceId);

  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [targetPhase, setTargetPhase] = useState<LifecyclePhase>(
    LIFECYCLE_PHASES.find((p) => p !== curPhase) ?? "deployed",
  );
  const [phaseNotes, setPhaseNotes] = useState("");
  const [phaseBusy, setPhaseBusy] = useState(false);
  const [uploadDragging, setUploadDragging] = useState(false);

  async function doTransitionPhase() {
    if (!user) return;
    setPhaseBusy(true);
    try {
      await transitionMut.mutateAsync({
        deviceId,
        phase: targetPhase,
        previousPhase: curPhase,
        userId: user.id,
        notes: phaseNotes.trim() || undefined,
      });
      setShowPhaseForm(false);
      setPhaseNotes("");
      toast.success(
        t("device.lifecycle.transitionSuccess", "Fase del ciclo di vita aggiornata"),
      );
    } catch (err: any) {
      toast.error(
        err?.message ||
          t("device.lifecycle.transitionError", "Errore nel cambiamento di fase"),
      );
    } finally {
      setPhaseBusy(false);
    }
  }

  async function handleUpload(files: FileList | File[]) {
    const fileArr = Array.from(files).filter(Boolean);
    if (!fileArr.length) return;
    try {
      for (const file of fileArr) {
        await uploadMut.mutateAsync({
          phase: curPhase,
          file,
          uploadedBy: user?.id,
        });
      }
      toast.success(
        t("device.lifecycle.uploadSuccess", "Documento caricato"),
      );
    } catch (err: any) {
      toast.error(
        err?.message || t("device.lifecycle.uploadError", "Errore caricamento documento"),
      );
    }
  }

  async function handleDelete(attachment: DeviceAttachment) {
    try {
      await deleteMut.mutateAsync(attachment);
      toast.success(
        t("device.lifecycle.deleteSuccess", "Documento eliminato"),
      );
    } catch (err: any) {
      toast.error(
        err?.message || t("device.lifecycle.deleteError", "Errore eliminazione documento"),
      );
    }
  }

  async function handlePreview(attachment: DeviceAttachment) {
    try {
      const url = await getDeviceAttachmentSignedUrl(attachment);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("device.lifecycle.previewError", "Anteprima non disponibile"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Current phase badge & transition button */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
        style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-text3">
            {t("device.lifecycle.currentPhase", "Fase corrente")}
          </span>
          <span
            className="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold"
            style={{
              color: PHASE_COLORS[curPhase] ?? "var(--text2)",
              background: `${PHASE_COLORS[curPhase] ?? "var(--text2)"}18`,
              borderColor: PHASE_COLORS[curPhase] ?? "var(--border)",
            }}
          >
            {LIFECYCLE_PHASE_LABELS[curPhase] ?? curPhase}
          </span>
        </div>
        {canEdit && (
          <button
            className="pc-btn pc-btn-primary pc-btn-sm ml-auto"
            onClick={() => {
              setTargetPhase(LIFECYCLE_PHASES.find((p) => p !== curPhase) ?? "deployed");
              setPhaseNotes("");
              setShowPhaseForm(true);
            }}
          >
            <ArrowRightLeft className="size-3" />{" "}
            {t("device.lifecycle.changePhase", "Cambia fase")}
          </button>
        )}
      </div>

      {/* Phase transition form */}
      {showPhaseForm && (
        <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-sm font-semibold">
              {t("device.lifecycle.transitionTitle", "Cambio fase")}
            </span>
            <button
              className="pc-btn-icon"
              onClick={() => setShowPhaseForm(false)}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="grid gap-3">
            <label className="text-xs">
              <span className="pc-label">
                {t("device.lifecycle.newPhase", "Nuova fase")}
              </span>
              <select
                className="pc-input mt-1 w-full"
                value={targetPhase}
                onChange={(e) => setTargetPhase(e.target.value as LifecyclePhase)}
              >
                {LIFECYCLE_PHASES.filter((p) => p !== curPhase).map((phase) => (
                  <option key={phase} value={phase}>
                    {LIFECYCLE_PHASE_LABELS[phase]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="pc-label">
                {t("device.lifecycle.notes", "Note")}
              </span>
              <textarea
                className="pc-input mt-1 min-h-[60px] w-full"
                value={phaseNotes}
                onChange={(e) => setPhaseNotes(e.target.value)}
                placeholder={t(
                  "device.lifecycle.notesPlaceholder",
                  "Note sulla transizione di fase...",
                )}
              />
            </label>
            <div className="flex gap-2">
              <button
                className="pc-btn pc-btn-primary pc-btn-sm"
                disabled={phaseBusy}
                onClick={() => void doTransitionPhase()}
              >
                {phaseBusy
                  ? t("device.lifecycle.saving", "Salvataggio...")
                  : t("device.lifecycle.confirmTransition", "Conferma transizione")}
              </button>
              <button
                className="pc-btn pc-btn-ghost pc-btn-sm"
                onClick={() => setShowPhaseForm(false)}
              >
                {t("device.lifecycle.cancel", "Annulla")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document upload zone */}
      {canEdit && (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            uploadDragging ? "bg-accent/10" : ""
          }`}
          style={{
            borderColor: uploadDragging ? "var(--accent)" : "var(--border)",
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setUploadDragging(true);
          }}
          onDragLeave={() => setUploadDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setUploadDragging(false);
            void handleUpload(event.dataTransfer.files);
          }}
        >
          <UploadCloud className="h-6 w-6 text-text3" />
          <span className="text-[12.5px] font-semibold">
            {t("device.lifecycle.uploadHint", "Carica documento per la fase")}{" "}
            <span style={{ color: PHASE_COLORS[curPhase] }}>
              {LIFECYCLE_PHASE_LABELS[curPhase]}
            </span>
          </span>
          <span className="text-[11px] text-text3">
            {t(
              "device.lifecycle.uploadFormats",
              "PDF, immagini, documenti Office — max 50 MB",
            )}
          </span>
          <input
            type="file"
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void handleUpload(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
        >
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
            <Paperclip className="size-3.5" />{" "}
            {t("device.lifecycle.documents", "Documenti allegati")}
          </div>
          <div className="flex flex-col gap-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2.5"
                style={{ borderColor: "var(--border)" }}
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md"
                  style={{ background: "var(--surface2)" }}
                >
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold">
                    {a.file_name}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-text3">
                    <span>{formatBytes(a.file_size)}</span>
                    <span>{a.mime_type || "file"}</span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        color: PHASE_COLORS[a.lifecycle_phase as LifecyclePhase] ?? "var(--text2)",
                        background: `${PHASE_COLORS[a.lifecycle_phase as LifecyclePhase] ?? "var(--text2)"}14`,
                      }}
                    >
                      {LIFECYCLE_PHASE_LABELS[a.lifecycle_phase as LifecyclePhase] ??
                        a.lifecycle_phase}
                    </span>
                    {a.description && (
                      <span className="italic">{a.description}</span>
                    )}
                    <span>{fmtDateTime(a.created_at)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="pc-btn pc-btn-ghost pc-btn-sm"
                  onClick={() => void handlePreview(a)}
                >
                  {t("device.lifecycle.preview", "Anteprima")}
                </button>
                {canEdit && (
                  <button
                    type="button"
                    className="pc-btn pc-btn-ghost pc-btn-sm text-destructive"
                    onClick={() => void handleDelete(a)}
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline of phase transitions */}
      <div
        className="rounded-lg border p-3"
        style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
      >
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
          <History className="size-3.5" />{" "}
          {t("device.lifecycle.history", "Cronologia fasi")}
        </div>
        <div className="relative max-h-[min(360px,40vh)] overflow-y-auto pl-1">
          <div
            className="absolute left-[7px] top-2 bottom-2 w-px"
            style={{ background: "var(--border)" }}
            aria-hidden
          />
          <div className="flex flex-col gap-0">
            {history.map((item: any, idx: number) => (
              <div
                key={item.id}
                className="relative flex gap-3 py-2.5 pl-5 text-[13px]"
              >
                <div
                  className="absolute left-0 top-[18px] h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background"
                  style={{
                    background: PHASE_COLORS[item.phase as LifecyclePhase] ?? "var(--text2)",
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold">
                      {LIFECYCLE_PHASE_LABELS[item.phase as LifecyclePhase] ?? item.phase}
                    </span>
                    <span className="font-mono text-[11px] text-text3">
                      {fmtDateTime(item.changed_at)}
                    </span>
                    {idx > 0 && item.previous_phase && (
                      <span className="text-[10px] text-text3">
                        ←{" "}
                        {LIFECYCLE_PHASE_LABELS[
                          item.previous_phase as LifecyclePhase
                        ] ?? item.previous_phase}
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <div className="text-[12px] text-text2 mt-0.5 whitespace-pre-wrap">
                      {item.notes}
                    </div>
                  )}
                  {item.changer?.display_name && (
                    <div className="mt-1 text-[11px] text-text3">
                      {item.changer.display_name}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {!history.length && (
              <div className="text-[12.5px] text-text3 py-4 pl-5">
                {t(
                  "device.lifecycle.noHistory",
                  "Nessuna transizione di fase registrata.",
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
