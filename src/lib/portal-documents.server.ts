import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPortalSession } from "@/lib/portal-auth.server";

const DOCUMENT_SIGNED_URL_TTL_SECONDS = 60 * 15;

async function createDocumentSignedUrl(
  bucket: string,
  path: string,
  fileName: string,
  download: boolean,
) {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(
      path,
      DOCUMENT_SIGNED_URL_TTL_SECONDS,
      download ? { download: fileName } : undefined,
    );
  if (error) {
    console.error("[portal-documents] signed URL error", { bucket, path, error });
    return null;
  }
  return data?.signedUrl ?? null;
}

function normalizeDocumentTicket(ticket: any) {
  return Array.isArray(ticket) ? ticket[0] : ticket;
}

/**
 *
 */
export async function listPortalDocumentsServer(input: { token: string }) {
  const session = await getPortalSession(input.token);

  const { data: attachments, error: attachmentsError } = await (supabaseAdmin as any)
    .from("ticket_attachments")
    .select(
      "id, storage_bucket, storage_path, file_name, file_size, mime_type, created_at, ticket:tickets!inner(id, ticket_code, model, client_id, status, closed_at, completed_at)",
    )
    .eq("ticket.client_id", session.clientId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (attachmentsError) {
    console.error("[portal-documents] attachment query failed", {
      clientId: session.clientId,
      error: attachmentsError,
    });
    throw new Response("Impossibile caricare i documenti associati al cliente", { status: 500 });
  }

  const { data: closedTickets, error: ticketsError } = await (supabaseAdmin as any)
    .from("tickets")
    .select("id, ticket_code, model, status, closed_at, completed_at, updated_at")
    .eq("client_id", session.clientId)
    .in("status", ["ready", "completed", "archived"])
    .order("closed_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (ticketsError) {
    console.error("[portal-documents] completed ticket query failed", {
      clientId: session.clientId,
      error: ticketsError,
    });
    throw new Response("Impossibile caricare i report degli interventi", { status: 500 });
  }

  const attachmentDocuments = await Promise.all(
    ((attachments ?? []) as any[]).map(async (attachment) => {
      const ticket = normalizeDocumentTicket(attachment.ticket);
      const bucket = attachment.storage_bucket || "ticket-documents";
      return {
        id: `attachment:${attachment.id}`,
        type: "attachment" as const,
        file_name: attachment.file_name,
        file_size: attachment.file_size ?? null,
        mime_type: attachment.mime_type ?? null,
        created_at: attachment.created_at,
        ticket_id: ticket?.id ?? null,
        ticket_code: ticket?.ticket_code ?? null,
        ticket_title: ticket?.model ?? null,
        status: ticket?.status ?? null,
        view_url: await createDocumentSignedUrl(
          bucket,
          attachment.storage_path,
          attachment.file_name,
          false,
        ),
        download_url: await createDocumentSignedUrl(
          bucket,
          attachment.storage_path,
          attachment.file_name,
          true,
        ),
      };
    }),
  );

  const ticketByCode = new Map(
    ((closedTickets ?? []) as any[]).map((ticket) => [String(ticket.ticket_code), ticket]),
  );
  let completionDocuments: any[] = [];
  const { data: completionFiles, error: completionError } = await supabaseAdmin.storage
    .from("ticket-documents")
    .list("completions", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });

  if (completionError) {
    console.error("[portal-documents] completion PDF list failed", {
      clientId: session.clientId,
      error: completionError,
    });
  } else {
    completionDocuments = await Promise.all(
      (completionFiles ?? [])
        .filter((file) => file.name.toLowerCase().endsWith(".pdf"))
        .map(async (file) => {
          const code = [...ticketByCode.keys()].find((ticketCode) =>
            file.name.startsWith(ticketCode),
          );
          if (!code) return null;
          const ticket = ticketByCode.get(code);
          const path = `completions/${file.name}`;
          return {
            id: `completion:${file.name}`,
            type: "completion_report" as const,
            file_name: `Report intervento ${code}.pdf`,
            file_size: file.metadata?.size ?? null,
            mime_type: "application/pdf",
            created_at:
              file.created_at || ticket.completed_at || ticket.closed_at || ticket.updated_at,
            ticket_id: ticket.id,
            ticket_code: ticket.ticket_code,
            ticket_title: ticket.model || "Intervento completato",
            status: ticket.status,
            view_url: await createDocumentSignedUrl(
              "ticket-documents",
              path,
              `Report-${code}.pdf`,
              false,
            ),
            download_url: await createDocumentSignedUrl(
              "ticket-documents",
              path,
              `Report-${code}.pdf`,
              true,
            ),
          };
        }),
    ).then((rows) => rows.filter(Boolean));
  }

  const seen = new Set<string>();
  const documents = [...attachmentDocuments, ...completionDocuments]
    .filter((doc) => {
      const key = `${doc.type}:${doc.ticket_id}:${doc.file_name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const documentIds = documents.map((d) => d.id);
  const { data: signatures, error: signaturesError } = documentIds.length
    ? await supabaseAdmin
        .from("document_signatures" as any)
        .select("document_id, signed_at, signature_path")
        .in("document_id", documentIds)
        .eq("client_id", session.clientId)
    : { data: [], error: null };
  if (signaturesError)
    console.error("[portal-documents] signatures query failed:", signaturesError);
  const signatureByDocument = new Map(((signatures ?? []) as any[]).map((s) => [s.document_id, s]));

  return {
    session,
    documents: documents.map((d) => ({
      ...d,
      signature: signatureByDocument.get(d.id) ?? null,
    })),
    diagnostics: {
      attachments: attachmentDocuments.length,
      completionReports: completionDocuments.length,
    },
  };
}

/**
 *
 */
export async function signPortalDocumentServer(input: {
  token: string;
  documentId: string;
  signatureDataUrl: string;
}) {
  const session = await getPortalSession(input.token);

  const match = /^data:image\/png;base64,(.+)$/.exec(input.signatureDataUrl);
  if (!match) throw new Response("Formato firma non valido", { status: 400 });
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.byteLength > 500 * 1024) throw new Response("Firma troppo grande", { status: 400 });

  const now = Date.now();
  const sanitizedId = input.documentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const storagePath = `signatures/${session.clientId}/${now}-${sanitizedId}.png`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("ticket-documents")
    .upload(storagePath, buffer, {
      contentType: "image/png",
      upsert: false,
      cacheControl: "private, max-age=31536000",
    });
  if (uploadError) throw uploadError;

  const { error: upsertError } = await supabaseAdmin.from("document_signatures" as any).upsert(
    {
      document_id: input.documentId,
      client_id: session.clientId,
      contact_id: session.contactId,
      signature_path: storagePath,
      signed_at: new Date().toISOString(),
    },
    { onConflict: "document_id,contact_id" },
  );
  if (upsertError) throw upsertError;

  const { data: signedUrlData } = await supabaseAdmin.storage
    .from("ticket-documents")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  return {
    success: true,
    signatureUrl: signedUrlData?.signedUrl ?? null,
    signedAt: new Date().toISOString(),
  };
}
