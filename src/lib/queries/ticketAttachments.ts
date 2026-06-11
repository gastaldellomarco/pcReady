import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ALLOWED_FILE_TYPES,
  getFileExtension,
  isLikelyPlainText,
  detectMimeTypeFromHeader,
} from "@/lib/file-types-shared";

const STORAGE_BUCKET = "ticket-documents";

/**
 *
 */
export async function validateTicketAttachmentFile(file: File) {
  const extension = getFileExtension(file.name || "");
  const expectedType = ALLOWED_FILE_TYPES[extension];
  if (!expectedType) {
    throw new Error("Estensione file non consentita");
  }

  const headerBytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  const detectedType = detectMimeTypeFromHeader(headerBytes);
  if (detectedType) {
    if (detectedType !== expectedType) {
      throw new Error("Tipo file non valido in base all'intestazione del file");
    }
    return expectedType;
  }

  if (extension === ".txt") {
    if (!isLikelyPlainText(headerBytes)) {
      throw new Error("File .txt non è testo valido");
    }
    return expectedType;
  }

  throw new Error("Impossibile determinare il tipo di file");
}

/**
 *
 */
export interface TicketAttachment {
  id: string;
  ticket_id: string;
  note_id: string | null;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: { full_name: string; initials: string } | null;
  signedUrl?: string | null;
}

function attachmentKey(ticketId: string | null, noteId?: string | null) {
  return ["ticket", ticketId, noteId ? "note-attachments" : "attachments", noteId ?? "all"];
}

function sanitizeFileName(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

/**
 *
 */
export async function fetchTicketAttachments(ticketId: string, noteId?: string | null) {
  if (!ticketId) return [];
  let query = (supabase as any)
    .from("ticket_attachments")
    .select(
      "id, ticket_id, note_id, storage_bucket, storage_path, file_name, file_size, mime_type, uploaded_by, created_at, uploader:profiles(id, full_name, initials)",
    )
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false });

  query = noteId === undefined ? query.is("note_id", null) : query.eq("note_id", noteId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TicketAttachment[];
}

/**
 *
 */
export async function uploadTicketAttachment({
  ticketId,
  noteId = null,
  file,
  uploadedBy,
}: {
  ticketId: string;
  noteId?: string | null;
  file: File;
  uploadedBy?: string | null;
}) {
  const safeName = sanitizeFileName(file.name || "allegato");
  const path = `tickets/${ticketId}/${noteId ? `notes/${noteId}/` : ""}${Date.now()}-${safeName}`;
  const contentType = await validateTicketAttachmentFile(file);
  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await (supabase as any)
    .from("ticket_attachments")
    .insert({
      ticket_id: ticketId,
      note_id: noteId,
      storage_bucket: STORAGE_BUCKET,
      storage_path: path,
      // store a sanitized filename to avoid problematic characters
      file_name: safeName,
      file_size: file.size,
      mime_type: contentType,
      uploaded_by: uploadedBy ?? null,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    throw error;
  }
  return data;
}

/**
 *
 */
export async function deleteTicketAttachment(attachment: TicketAttachment) {
  const { error: storageError } = await supabase.storage
    .from(attachment.storage_bucket || STORAGE_BUCKET)
    .remove([attachment.storage_path]);
  if (storageError) throw storageError;
  const { error } = await (supabase as any)
    .from("ticket_attachments")
    .delete()
    .eq("id", attachment.id);
  if (error) throw error;
  return true;
}

/**
 *
 */
export async function getAttachmentSignedUrl(attachment: TicketAttachment) {
  const { data, error } = await supabase.storage
    .from(attachment.storage_bucket || STORAGE_BUCKET)
    .createSignedUrl(attachment.storage_path, 60 * 10, {
      // Force download to set Content-Disposition: attachment on served file
      // This prevents inline execution of potentially dangerous file types.
      download: attachment.file_name || true,
    });
  if (error) throw error;
  return data.signedUrl;
}

/**
 *
 */
export async function downloadAttachment(attachment: TicketAttachment) {
  const { data, error } = await supabase.storage
    .from(attachment.storage_bucket || STORAGE_BUCKET)
    .createSignedUrl(attachment.storage_path, 60 * 5, {
      download: attachment.file_name,
    });
  if (error) throw error;
  return data.signedUrl;
}

/**
 *
 */
export function useTicketAttachments(ticketId: string | null, noteId?: string | null) {
  return useQuery({
    queryKey: attachmentKey(ticketId, noteId),
    queryFn: () => fetchTicketAttachments(ticketId as string, noteId),
    enabled: !!ticketId,
  });
}

/**
 *
 */
export function useUploadTicketAttachment(ticketId: string, noteId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { file: File; uploadedBy?: string | null }) =>
      uploadTicketAttachment({ ticketId, noteId, file: vars.file, uploadedBy: vars.uploadedBy }),
    onSuccess() {
      qc.invalidateQueries({ queryKey: attachmentKey(ticketId, noteId) });
      if (noteId) qc.invalidateQueries({ queryKey: ["ticket", ticketId, "notes"] });
    },
  });
}

/**
 *
 */
export function useDeleteTicketAttachment(ticketId: string, noteId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachment: TicketAttachment) => deleteTicketAttachment(attachment),
    onSuccess() {
      qc.invalidateQueries({ queryKey: attachmentKey(ticketId, noteId) });
      if (noteId) qc.invalidateQueries({ queryKey: ["ticket", ticketId, "notes"] });
    },
  });
}

export default {
  fetchTicketAttachments,
  uploadTicketAttachment,
  deleteTicketAttachment,
  getAttachmentSignedUrl,
  downloadAttachment,
  useTicketAttachments,
  useUploadTicketAttachment,
  useDeleteTicketAttachment,
};
