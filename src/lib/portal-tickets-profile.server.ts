import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPortalSession } from "@/lib/portal-auth.server";
import { statusLabel } from "@/lib/portal-tickets-helpers.server";

export async function submitPortalTicketFeedbackServer(input: {
  token: string;
  ticketId: string;
  rating: number;
  comment?: string | null;
}) {
  const session = await getPortalSession(input.token);
  const { data: ticket, error } = await supabaseAdmin
    .from("tickets" as any)
    .select("id, client_id, status")
    .eq("id", input.ticketId)
    .eq("client_id", session.clientId)
    .maybeSingle();
  if (error) throw error;
  if (!ticket) throw new Response("Ticket non trovato", { status: 404 });
  if (!["ready", "completed", "archived"].includes((ticket as any).status)) {
    throw new Response("Feedback disponibile solo per ticket chiusi", { status: 400 });
  }
  const { error: upsertError } = await supabaseAdmin.from("ticket_feedback" as any).upsert(
    {
      ticket_id: input.ticketId,
      client_id: session.clientId,
      contact_id: session.contactId,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    },
    { onConflict: "ticket_id,contact_id" },
  );
  if (upsertError) throw upsertError;
  return { success: true };
}

export async function getPortalProfileOverviewServer(input: { token: string }) {
  const session = await getPortalSession(input.token);
  const closedStatuses = ["ready", "completed", "archived"];

  const [requestsResult, interventionsResult, documentsResult, contractsResult] = await Promise.all(
    [
      (supabaseAdmin as any)
        .from("tickets")
        .select(
          "id, ticket_code, model, notes, status, priority, created_at, updated_at, closed_at, completed_at, public_notes, assignee:profiles!tickets_assignee_id_fkey(full_name)",
        )
        .eq("client_id", session.clientId)
        .eq("requester_contact_id", session.contactId)
        .order("created_at", { ascending: false })
        .limit(20),
      (supabaseAdmin as any)
        .from("tickets")
        .select(
          "id, ticket_code, model, status, created_at, closed_at, completed_at, billable_hours, public_notes, assignee:profiles!tickets_assignee_id_fkey(full_name)",
        )
        .eq("client_id", session.clientId)
        .in("status", closedStatuses)
        .order("closed_at", { ascending: false, nullsFirst: false })
        .limit(12),
      (supabaseAdmin as any)
        .from("ticket_attachments")
        .select(
          "id, file_name, file_size, mime_type, created_at, ticket:tickets!inner(id, ticket_code, model, client_id)",
        )
        .eq("ticket.client_id", session.clientId)
        .order("created_at", { ascending: false })
        .limit(12),
      (supabaseAdmin as any)
        .from("client_contracts")
        .select(
          "id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes",
        )
        .eq("client_id", session.clientId)
        .eq("status", "active")
        .order("start_date", { ascending: false })
        .limit(20),
    ],
  );

  if (requestsResult.error) throw requestsResult.error;
  if (interventionsResult.error) throw interventionsResult.error;
  if (documentsResult.error) throw documentsResult.error;
  if (contractsResult.error) throw contractsResult.error;

  const requests = ((requestsResult.data ?? []) as any[]).map((ticket) => ({
    id: ticket.id,
    ticket_code: ticket.ticket_code,
    title: ticket.model || ticket.notes || "Richiesta assistenza",
    status: ticket.status,
    status_label: statusLabel(ticket.status),
    priority: ticket.priority,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
    closed_at: ticket.closed_at || ticket.completed_at || null,
    public_notes: ticket.public_notes ?? null,
    assignee_name: ticket.assignee?.full_name ?? null,
  }));

  const interventions = ((interventionsResult.data ?? []) as any[]).map((ticket) => ({
    id: ticket.id,
    ticket_code: ticket.ticket_code,
    title: ticket.model || "Intervento assistenza",
    status: ticket.status,
    status_label: statusLabel(ticket.status),
    date: ticket.closed_at || ticket.completed_at || ticket.created_at,
    technician: ticket.assignee?.full_name ?? null,
    duration_hours: Number(ticket.billable_hours ?? 0),
    report: ticket.public_notes ?? null,
  }));

  const documents = ((documentsResult.data ?? []) as any[]).map((attachment) => {
    const ticket = Array.isArray(attachment.ticket) ? attachment.ticket[0] : attachment.ticket;
    return {
      id: attachment.id,
      file_name: attachment.file_name,
      file_size: attachment.file_size ?? null,
      mime_type: attachment.mime_type ?? null,
      created_at: attachment.created_at,
      ticket_id: ticket?.id ?? null,
      ticket_code: ticket?.ticket_code ?? null,
      ticket_title: ticket?.model ?? null,
    };
  });

  return {
    session,
    stats: {
      submittedRequests: requests.length,
      openRequests: requests.filter((ticket) => !closedStatuses.includes(ticket.status)).length,
      completedInterventions: interventions.length,
      activeContracts: ((contractsResult.data ?? []) as any[]).length,
    },
    requests,
    interventions,
    documents,
    contracts: contractsResult.data ?? [],
  };
}

export async function getPortalTicketCategoriesServer(input: { token: string }) {
  await getPortalSession(input.token);
  const { data: rows, error } = await supabaseAdmin
    .from("app_settings" as any)
    .select("value")
    .eq("key", "ticket_categories")
    .maybeSingle();
  if (error) throw error;
  return { categories: Array.isArray((rows as any)?.value) ? (rows as any).value : [] };
}
