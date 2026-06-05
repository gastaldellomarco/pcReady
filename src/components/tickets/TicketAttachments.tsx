import {
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { useAuth } from "@/lib/auth-context";
import { fmtDateTime } from "@/lib/pcready";
import {
  downloadAttachment,
  getAttachmentSignedUrl,
  type TicketAttachment,
  useDeleteTicketAttachment,
  useTicketAttachments,
  useUploadTicketAttachment,
} from "@/lib/queries/ticketAttachments";

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

function isImage(attachment: TicketAttachment) {
  return attachment.mime_type?.startsWith("image/") ?? false;
}

/**
 *
 */
export function TicketAttachments({
  ticketId,
  noteId,
  compact = false,
}: {
  ticketId: string;
  noteId?: string | null;
  compact?: boolean;
}) {
  const { t } = useTranslation("tickets");
  const { user, canEdit } = useAuth();
  const attachmentsQuery = useTicketAttachments(ticketId, noteId);
  const attachments = useMemo(
    () => (attachmentsQuery.data ?? []) as TicketAttachment[],
    [attachmentsQuery.data],
  );
  const uploadMut = useUploadTicketAttachment(ticketId, noteId);
  const deleteMut = useDeleteTicketAttachment(ticketId, noteId);
  const [dragging, setDragging] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const imageAttachments = attachments.filter(isImage).slice(0, compact ? 3 : 12);
      const pairs = await Promise.all(
        imageAttachments.map(async (attachment) => {
          try {
            return [attachment.id, await getAttachmentSignedUrl(attachment)] as const;
          } catch {
            return [attachment.id, ""] as const;
          }
        }),
      );
      if (!cancelled) setPreviewUrls(Object.fromEntries(pairs.filter(([, url]) => Boolean(url))));
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [attachments, compact]);

  async function uploadFiles(fileList: FileList | File[]) {
    if (!canEdit) return toast.error(t("toasts.insufficientPermissions", "Permessi insufficienti"));
    const files = Array.from(fileList).filter(Boolean);
    if (!files.length) return;
    try {
      for (const file of files) {
        await uploadMut.mutateAsync({ file, uploadedBy: user?.id });
      }
      toast.success(
        files.length === 1
          ? t("attachments.uploadSuccess", "Allegato caricato")
          : t("attachments.uploadSuccessPlural", "Allegati caricati"),
      );
    } catch (err: any) {
      toast.error(err?.message || t("attachments.uploadError", "Errore caricamento allegato"));
    }
  }

  async function openPreview(attachment: TicketAttachment) {
    try {
      const url = await getAttachmentSignedUrl(attachment);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err?.message || t("attachments.previewError", "Anteprima non disponibile"));
    }
  }

  async function download(attachment: TicketAttachment) {
    try {
      const url = await downloadAttachment(attachment);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      toast.error(err?.message || t("attachments.downloadError", "Download non disponibile"));
    }
  }

  async function remove(attachment: TicketAttachment) {
    if (!canEdit) return;
    try {
      await deleteMut.mutateAsync(attachment);
      toast.success(t("attachments.deleteSuccess", "Allegato eliminato"));
    } catch (err: any) {
      toast.error(err?.message || t("attachments.deleteError", "Errore eliminazione allegato"));
    }
  }

  return (
    <section className={compact ? "space-y-2" : "space-y-4"}>
      {!compact && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-bold">{t("attachments.title", "Allegati")}</h3>
            <p className="text-[12px] text-text3">
              {t("attachments.description", "File, screenshot e documenti collegati al ticket.")}
            </p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-mono text-text3"
            style={{ background: "var(--surface2)" }}
          >
            {t("attachments.count", "{{count}} file", { count: attachments.length })}
          </span>
        </div>
      )}

      {canEdit && !compact && (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition-colors ${dragging ? "bg-accent/10" : ""}`}
          style={{ borderColor: dragging ? "var(--accent)" : "var(--border)" }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void uploadFiles(event.dataTransfer.files);
          }}
        >
          <UploadCloud className="h-6 w-6 text-text3" />
          <span className="text-[12.5px] font-semibold">
            {t("attachments.dropZoneText", "Trascina qui i file o clicca per caricarli")}
          </span>
          <span className="text-[11px] text-text3">
            {t("attachments.dropZoneHint", "Immagini, PDF e documenti")}
          </span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void uploadFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      )}

      {attachmentsQuery.isLoading && (
        <div className="text-[12px] text-text3">
          {t("attachments.loadingText", "Caricamento allegati...")}
        </div>
      )}
      {!compact && !attachmentsQuery.isLoading && attachments.length === 0 && (
        <div
          className="rounded-lg border p-4 text-center text-[12px] text-text3"
          style={{ borderColor: "var(--border)" }}
        >
          {t("attachments.emptyText", "Nessun allegato presente")}
        </div>
      )}

      {!compact && attachments.some(isImage) && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {attachments
            .filter(isImage)
            .slice(0, 6)
            .map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => openPreview(attachment)}
                className="group overflow-hidden rounded-lg border bg-background text-left"
                style={{ borderColor: "var(--border)" }}
              >
                {previewUrls[attachment.id] ? (
                  <OptimizedImage
                    src={previewUrls[attachment.id]}
                    alt={attachment.file_name}
                    width={320}
                    height={112}
                    className="h-28 w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-28 items-center justify-center bg-surface2">
                    <ImageIcon className="h-6 w-6 text-text3" />
                  </div>
                )}
                <div className="truncate p-2 text-[11px] font-semibold">{attachment.file_name}</div>
              </button>
            ))}
        </div>
      )}

      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2.5"
            style={{ borderColor: "var(--border)" }}
          >
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{ background: "var(--surface2)" }}
            >
              {isImage(attachment) ? (
                <ImageIcon className="size-4" />
              ) : (
                <FileText className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-semibold">{attachment.file_name}</div>
              <div className="flex flex-wrap gap-2 text-[11px] text-text3">
                <span>{formatBytes(attachment.file_size)}</span>
                <span>{attachment.mime_type || "file"}</span>
                <span>{attachment.uploader?.full_name || "Uploader"}</span>
                <span>{fmtDateTime(attachment.created_at)}</span>
              </div>
            </div>
            <button
              type="button"
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => openPreview(attachment)}
            >
              <Eye className="size-3" /> {t("attachments.preview", "Anteprima")}
            </button>
            <button
              type="button"
              className="pc-btn pc-btn-ghost pc-btn-sm"
              onClick={() => download(attachment)}
            >
              <Download className="size-3" /> {t("attachments.download", "Download")}
            </button>
            {canEdit && (
              <button
                type="button"
                className="pc-btn pc-btn-ghost pc-btn-sm text-red-600"
                onClick={() => remove(attachment)}
              >
                <Trash2 className="size-3" /> {t("attachments.delete", "Elimina")}
              </button>
            )}
          </div>
        ))}
      </div>

      {compact && attachments.length > 0 && (
        <div className="flex items-center gap-1 text-[11px] text-text3">
          <Paperclip className="size-3" />{" "}
          {t("attachments.noteAttachments", "{{count}} allegati nota", {
            count: attachments.length,
          })}
        </div>
      )}
    </section>
  );
}
