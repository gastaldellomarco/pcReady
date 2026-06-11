import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email-templates.server";
import { createNotificationForAdmins } from "@/lib/notifications.server";
import { getPortalSession } from "@/lib/portal-auth.server";
import { throwIfRateLimited } from "@/lib/rate-limit";
import { RATE_LIMITER_KEYS } from "@/lib/rate-limit-config";
import { statusLabel } from "@/lib/portal-tickets-helpers.server";

function urgencyToPriority(urgency: "low" | "normal" | "high" | "urgent") {
  if (urgency === "high" || urgency === "urgent") return "high";
  if (urgency === "low") return "low";
  return "med";
}

async function uploadPortalAttachments(
  ticketId: string,
  attachments: Array<{ fileName: string; mimeType?: string; dataUrl: string }> | undefined,
) {
  if (!attachments?.length) return [];
  const uploaded: any[] = [];
  for (const attachment of attachments) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(attachment.dataUrl);
    if (!match) continue;
    const mimeType = attachment.mimeType || match[1] || "application/octet-stream";
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.byteLength > 5 * 1024 * 1024)
      throw new Response("Allegato troppo grande", { status: 400 });
    const safeName = attachment.fileName.replace(/[^a-z0-9._-]/gi, "_");
    const storagePath = `portal/${ticketId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("ticket-documents")
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await supabaseAdmin
      .from("ticket_attachments" as any)
      .insert({
        ticket_id: ticketId,
        storage_bucket: "ticket-documents",
        storage_path: storagePath,
        file_name: attachment.fileName,
        file_size: buffer.byteLength,
        mime_type: mimeType,
      })
      .select("id, file_name")
      .single();
    if (error) throw error;
    uploaded.push(data);
  }
  return uploaded;
}

export async function listPortalTicketsServer(input: {
  token: string;
  status?: "all" | "open" | "in-progress" | "completed";
  q?: string;
  sortBy?: "created_at" | "status" | "priority";
  sortDir?: "asc" | "desc";
  deviceId?: string | null;
}) {
  const session = await getPortalSession(input.token);
  let query = supabaseAdmin
    .from("tickets" as any)
    .select(
      "id, ticket_code, model, notes, status, priority, created_at, updated_at, closed_at, public_notes, device_id, assignee:profiles!tickets_assignee_id_fkey(full_name)",
    )
    .eq("client_id", session.clientId);

  if (input.status === "open") query = query.in("status", ["pending"] as any);
  if (input.status === "in-progress") query = query.in("status", ["in-progress", "testing"] as any);
  if (input.status === "completed")
    query = query.in("status", ["ready", "completed", "archived"] as any);
  if (input.deviceId) query = query.eq("device_id", input.deviceId);
  const term = input.q?.trim().replace(/[,%]/g, "");
  if (term)
    query = query.or(`ticket_code.ilike.%${term}%,model.ilike.%${term}%,notes.ilike.%${term}%`);

  query = query
    .order(input.sortBy || "created_at", { ascending: input.sortDir === "asc" })
    .limit(200);
  const { data: tickets, error } = await query;
  if (error) throw error;
  return {
    session,
    tickets: ((tickets ?? []) as any[]).map((ticket) => ({
      ...ticket,
      title: ticket.model || "Ticket assistenza",
      status_label: statusLabel(ticket.status),
    })),
  };
}

export async function getPortalTicketDetailServer(input: { token: string; ticketId: string }) {
  const session = await getPortalSession(input.token);
  const { data: ticket, error } = await supabaseAdmin
    .from("tickets" as any)
    .select(
      "id, ticket_code, model, notes, public_notes, status, priority, created_at, updated_at, closed_at, device_id, assignee:profiles!tickets_assignee_id_fkey(full_name)",
    )
    .eq("id", input.ticketId)
    .eq("client_id", session.clientId)
    .maybeSingle();
  if (error) throw error;
  if (!ticket) throw new Response("Ticket non trovato", { status: 404 });

  const { data: history, error: historyError } = await supabaseAdmin
    .from("ticket_status_history" as any)
    .select("id, ticket_id, from_status, to_status, changed_by, changed_at, note")
    .eq("ticket_id", input.ticketId)
    .order("changed_at", { ascending: true });
  if (historyError) {
    console.error("Error fetching status history:", historyError);
  }

  const actorIds = [
    ...new Set(((history ?? []) as any[]).map((h) => h.changed_by).filter(Boolean)),
  ];
  const { data: actors, error: actorsError } = actorIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, initials").in("id", actorIds)
    : { data: [], error: null };
  if (actorsError) console.error("Error fetching actors:", actorsError);
  const actorById = new Map(((actors ?? []) as any[]).map((actor) => [actor.id, actor]));
  const historyWithActors = ((history ?? []) as any[]).map((h) => ({
    ...h,
    actor: actorById.get(h.changed_by) ?? null,
  }));

  const { data: publicNotes, error: notesError } = await supabaseAdmin
    .from("ticket_notes" as any)
    .select("id, content, created_at, author_id")
    .eq("ticket_id", input.ticketId)
    .eq("is_internal", false)
    .order("created_at", { ascending: true });
  if (notesError) throw notesError;

  const authorIds = [
    ...new Set(((publicNotes ?? []) as any[]).map((note) => note.author_id).filter(Boolean)),
  ];
  const { data: authors, error: authorsError } = authorIds.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, initials").in("id", authorIds)
    : { data: [], error: null };
  if (authorsError) throw authorsError;
  const authorById = new Map(((authors ?? []) as any[]).map((author) => [author.id, author]));
  const notesWithAuthors = ((publicNotes ?? []) as any[]).map((note) => ({
    ...note,
    author: authorById.get(note.author_id) ?? null,
  }));

  const { data: feedback, error: feedbackError } = await supabaseAdmin
    .from("ticket_feedback" as any)
    .select("id, rating, comment, created_at")
    .eq("ticket_id", input.ticketId)
    .eq("contact_id", session.contactId)
    .maybeSingle();
  if (feedbackError) throw feedbackError;

  return { session, ticket, history: historyWithActors, publicNotes: notesWithAuthors, feedback };
}

export async function createPortalTicketServer(input: {
  token: string;
  title: string;
  description: string;
  category: string;
  urgency: "low" | "normal" | "high" | "urgent";
  requestType: "technical_issue" | "request" | "device_fault";
  deviceId?: string | null;
  attachments?: Array<{ fileName: string; mimeType?: string; dataUrl: string }>;
}) {
  const session = await getPortalSession(input.token);
  throwIfRateLimited(session.contactId, RATE_LIMITER_KEYS.CREATE_PORTAL_TICKET);
  let device: any = null;
  if (input.deviceId) {
    const { data: deviceRow, error: deviceError } = await supabaseAdmin
      .from("devices" as any)
      .select("id, model, serial, os, client_id")
      .eq("id", input.deviceId)
      .eq("client_id", session.clientId)
      .maybeSingle();
    if (deviceError) throw deviceError;
    if (!deviceRow) throw new Response("Dispositivo non disponibile", { status: 404 });
    device = deviceRow;
  }
  const typeLabel = {
    technical_issue: "Problema tecnico",
    request: "Richiesta",
    device_fault: "Guasto dispositivo",
  }[input.requestType];
  const details = `${input.title}\n\nTipo: ${typeLabel}\nCategoria: ${input.category}\nPriorità percepita: ${input.urgency}\n${device ? `Dispositivo: ${device.model} ${device.serial || ""}\n` : ""}\n${input.description}`;

  const { data: ticket, error } = await supabaseAdmin
    .from("tickets" as any)
    .insert({
      client: session.clientName,
      client_id: session.clientId,
      requester: session.contactName || session.contactEmail,
      requester_contact_id: session.contactId,
      model: input.title,
      notes: details,
      priority: urgencyToPriority(input.urgency),
      status: "pending",
      ticket_type: input.requestType === "device_fault" ? "device" : "support",
      source: "portal",
      public_notes: null,
      device_id: device?.id ?? null,
      os: device?.os ?? null,
    })
    .select("id, ticket_code")
    .single();

  if (error) throw error;

  await supabaseAdmin.from("ticket_status_history" as any).insert({
    ticket_id: (ticket as any).id,
    from_status: null,
    to_status: "pending",
    changed_by: null,
    changed_at: new Date().toISOString(),
    note: "Ticket creato dal portale cliente",
  });

  await uploadPortalAttachments((ticket as any).id, input.attachments);

  await createNotificationForAdmins({
    type: "ticket_comment",
    title: "Nuovo ticket dal portale cliente",
    body: `${session.clientName}: ${input.title}`,
    payload: { ticketId: (ticket as any).id, source: "portal", clientId: session.clientId },
    link: "/tickets",
  });

  const teamEmail = process.env.SUPPORT_TEAM_EMAIL || process.env.SMTP_USER;
  if (teamEmail) {
    await sendEmail(
      teamEmail,
      `Nuovo ticket portale ${(ticket as any).ticket_code}`,
      `<p><strong>${session.clientName}</strong> ha aperto un nuovo ticket.</p><p><strong>${input.title}</strong></p><p>${input.description}</p>`,
      `${session.clientName} ha aperto un nuovo ticket: ${input.title}\n\n${input.description}`,
    );
  }

  return { success: true, ticketId: (ticket as any).id, ticketCode: (ticket as any).ticket_code };
}
