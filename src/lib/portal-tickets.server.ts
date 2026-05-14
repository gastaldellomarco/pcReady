import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/lib/email-templates.server";
import { getPortalSession } from "@/lib/portal-auth.server";
import { createNotificationForAdmins } from "@/lib/notifications.server";
import { RATE_LIMITER_KEYS } from "@/lib/rate-limit-config";
import { throwIfRateLimited } from "@/lib/rate-limit";

function urgencyToPriority(urgency: "low" | "normal" | "high") {
  if (urgency === "high") return "high";
  if (urgency === "low") return "low";
  return "med";
}

function statusLabel(status: string) {
  if (status === "pending") return "Aperto";
  if (status === "in-progress") return "In lavorazione";
  if (status === "testing") return "In verifica";
  if (status === "ready") return "Completato";
  return status;
}

export async function getPortalDashboardServer(input: { token: string }) {
  const session = await getPortalSession(input.token);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: tickets, error } = await supabaseAdmin
    .from("tickets" as any)
    .select("id, ticket_code, model, notes, status, created_at, updated_at, ticket_type")
    .eq("client_id", session.clientId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;

  const rows = (tickets ?? []) as any[];
  return {
    session,
    stats: {
      open: rows.filter((ticket) => ticket.status === "pending").length,
      inProgress: rows.filter(
        (ticket) => ticket.status === "in-progress" || ticket.status === "testing",
      ).length,
      resolvedThisMonth: rows.filter(
        (ticket) => ticket.status === "ready" && new Date(ticket.updated_at) >= monthStart,
      ).length,
    },
    recentTickets: rows.map((ticket) => ({
      id: ticket.id,
      ticket_code: ticket.ticket_code,
      title: ticket.model || ticket.notes || "Ticket assistenza",
      status: ticket.status,
      status_label: statusLabel(ticket.status),
      created_at: ticket.created_at,
    })),
  };
}

export async function listPortalTicketsServer(input: { token: string }) {
  const session = await getPortalSession(input.token);
  const { data: tickets, error } = await supabaseAdmin
    .from("tickets" as any)
    .select(
      "id, ticket_code, model, notes, status, priority, created_at, updated_at, public_notes, assignee:profiles!tickets_assignee_id_fkey(full_name)",
    )
    .eq("client_id", session.clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { session, tickets: tickets ?? [] };
}

export async function getPortalTicketDetailServer(input: { token: string; ticketId: string }) {
  const session = await getPortalSession(input.token);
  const { data: ticket, error } = await supabaseAdmin
    .from("tickets" as any)
    .select(
      "id, ticket_code, model, notes, public_notes, status, priority, created_at, updated_at, assignee:profiles!tickets_assignee_id_fkey(full_name)",
    )
    .eq("id", input.ticketId)
    .eq("client_id", session.clientId)
    .maybeSingle();
  if (error) throw error;
  if (!ticket) throw new Response("Ticket non trovato", { status: 404 });

  // Fetch status history from the new ticket_status_history table
  const { data: history, error: historyError } = await supabaseAdmin
    .from("ticket_status_history" as any)
    .select("id, ticket_id, from_status, to_status, changed_by, changed_at, note")
    .eq("ticket_id", input.ticketId)
    .order("changed_at", { ascending: true });
  if (historyError) {
    console.error("Error fetching status history:", historyError);
  }

  // Fetch actor info for status history
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

  return { session, ticket, history: historyWithActors, publicNotes: notesWithAuthors };
}

export async function createPortalTicketServer(input: {
  token: string;
  title: string;
  description: string;
  category: string;
  urgency: "low" | "normal" | "high";
}) {
  const session = await getPortalSession(input.token);
  throwIfRateLimited(session.contactId, RATE_LIMITER_KEYS.CREATE_PORTAL_TICKET);
  const details = `${input.title}\n\nCategoria: ${input.category}\nUrgenza cliente: ${input.urgency}\n\n${input.description}`;

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
      ticket_type: "support",
      source: "portal",
      public_notes: null,
    })
    .select("id, ticket_code")
    .single();

  if (error) throw error;

  // Insert initial status history record for portal-created tickets
  await supabaseAdmin.from("ticket_status_history" as any).insert({
    ticket_id: (ticket as any).id,
    from_status: null,
    to_status: "pending",
    changed_by: null, // Portal/system created
    changed_at: new Date().toISOString(),
    note: "Ticket creato dal portale cliente",
  });

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

  return { success: true, ticketId: (ticket as any).id };
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
