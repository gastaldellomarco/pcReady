import { useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { fmtDate } from "@/lib/pcready";
import queries from "@/lib/queries/clients";

/**
 *
 */
export function ClientDocumentsPanel({
  clientId,
  canEdit,
  canDelete,
  userId,
  ResponsiveTable,
  documentTypeLabel,
  formatFileSize,
}: {
  clientId: string;
  canEdit: boolean;
  canDelete: boolean;
  userId: string | null;
  ResponsiveTable: any;
  documentTypeLabel: (type: import("@/lib/queries/clients").ClientDocument["document_type"]) => string;
  formatFileSize: (value: number | null | undefined) => string;
}) {
  const { t } = useTranslation("clients");
  const qc = useQueryClient();
  const documentsQuery = (queries as any).useClientDocuments(clientId);
  const [documentType, setDocumentType] =
    useState<import("@/lib/queries/clients").ClientDocument["document_type"]>("contract");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const documents = (documentsQuery.data ?? []) as import("@/lib/queries/clients").ClientDocument[];

  async function upload(file: File | null) {
    if (!file || !canEdit) return;
    setBusy(true);
    try {
      await (queries as any).uploadClientDocument({
        clientId,
        file,
        documentType,
        description,
        userId,
      });
      setDescription("");
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "documents"] });
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "activity"] });
      toast.success(t("documents.uploaded", "Documento caricato"));
    } catch (error) {
      toast.error(errorMessage(error, t("documents.uploadError", "Errore upload documento")));
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(document: import("@/lib/queries/clients").ClientDocument) {
    try {
      const url = await (queries as any).getClientDocumentSignedUrl(document);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(errorMessage(error, t("documents.openError", "Errore apertura documento")));
    }
  }

  async function removeDocument(document: import("@/lib/queries/clients").ClientDocument) {
    if (!canDelete) return;
    setBusy(true);
    try {
      await (queries as any).deleteClientDocument(document);
      void qc.invalidateQueries({ queryKey: ["clients", clientId, "documents"] });
      toast.success(t("documents.deleted", "Documento eliminato"));
    } catch (error) {
      toast.error(errorMessage(error, t("documents.deleteError", "Errore eliminazione documento")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pc-card-body space-y-4">
      <div
        className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-[180px_minmax(0,1fr)_auto]"
        style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
      >
        <select
          className="pc-input"
          value={documentType}
          disabled={!canEdit || busy}
          onChange={(event) => setDocumentType(event.target.value as any)}
          aria-label={t("documents.typeLabel", "Tipo documento")}
        >
          <option value="contract">{t("documents.typeContract", "Contratto")}</option>
          <option value="nda">{t("documents.typeNda", "NDA")}</option>
          <option value="technical">{t("documents.typeTechnical", "Tecnico")}</option>
          <option value="other">{t("documents.typeOther", "Altro")}</option>
        </select>
        <input
          className="pc-input"
          value={description}
          disabled={!canEdit || busy}
          placeholder={t("documents.description", "Descrizione documento")}
          onChange={(event) => setDescription(event.target.value)}
          aria-label={t("documents.descriptionLabel", "Descrizione documento")}
        />
        <label className="pc-btn pc-btn-primary pc-btn-sm justify-center">
          <Upload className="size-3" />{" "}
          {busy ? t("documents.uploading", "Upload...") : t("documents.upload", "Carica")}
          <input
            type="file"
            className="hidden"
            disabled={!canEdit || busy}
            onChange={(event) => void upload(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <ResponsiveTable
        empty={t("documents.empty", "Nessun documento allegato al cliente.")}
        headers={[
          t("documents.headers.name", "Nome"),
          t("documents.headers.type", "Tipo"),
          t("documents.headers.size", "Dimensione"),
          t("documents.headers.uploaded", "Caricato"),
          t("documents.headers.actions", "Azioni"),
        ]}
        rows={documents.map((document: import("@/lib/queries/clients").ClientDocument) => [
          <button
            key={`doc-name-${document.id}`}
            className="font-semibold text-accent"
            type="button"
            onClick={() => void openDocument(document)}
          >
            {document.file_name}
          </button>,
          documentTypeLabel(document.document_type),
          formatFileSize(document.file_size),
          fmtDate(document.uploaded_at),
          <div key={`doc-actions-${document.id}`} className="flex gap-1">
            <button
              className="pc-btn pc-btn-ghost pc-btn-xs"
              type="button"
              onClick={() => void openDocument(document)}
            >
              <Download className="size-3" />
            </button>
            <button
              className="pc-btn pc-btn-ghost pc-btn-xs"
              type="button"
              disabled={!canDelete || busy}
              onClick={() => void removeDocument(document)}
            >
              <Trash2 className="size-3" />
            </button>
          </div>,
        ])}
      />
    </div>
  );
}
