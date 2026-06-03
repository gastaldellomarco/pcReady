import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_BUCKET = "ticket-documents";

const ALLOWED_FILE_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
};

function getFileExtension(name: string) {
  const match = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

function isLikelyPlainText(bytes: Uint8Array) {
  if (bytes.includes(0)) return false;
  return Array.from(bytes).every((byte) => {
    return byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 128;
  });
}

function detectMimeTypeFromHeader(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  return null;
}

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
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
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
