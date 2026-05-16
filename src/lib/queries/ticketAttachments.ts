import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_BUCKET = "ticket-documents";

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
  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) throw uploadError;

  const { data, error } = await (supabase as any)
    .from("ticket_attachments")
    .insert({
      ticket_id: ticketId,
      note_id: noteId,
      storage_bucket: STORAGE_BUCKET,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
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

export async function getAttachmentSignedUrl(attachment: TicketAttachment) {
  const { data, error } = await supabase.storage
    .from(attachment.storage_bucket || STORAGE_BUCKET)
    .createSignedUrl(attachment.storage_path, 60 * 10, {
      download: false,
    });
  if (error) throw error;
  return data.signedUrl;
}

export async function downloadAttachment(attachment: TicketAttachment) {
  const { data, error } = await supabase.storage
    .from(attachment.storage_bucket || STORAGE_BUCKET)
    .createSignedUrl(attachment.storage_path, 60 * 5, {
      download: attachment.file_name,
    });
  if (error) throw error;
  return data.signedUrl;
}

export function useTicketAttachments(ticketId: string | null, noteId?: string | null) {
  return useQuery({
    queryKey: attachmentKey(ticketId, noteId),
    queryFn: () => fetchTicketAttachments(ticketId as string, noteId),
    enabled: !!ticketId,
  });
}

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
