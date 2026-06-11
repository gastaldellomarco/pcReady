import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPortalSession } from "@/lib/portal-auth.server";
import { statusLabel } from "@/lib/portal-tickets-helpers.server";

const BUNDLE_SELECT =
  "id, name, description, billing_type, fee, currency, included_hours, extra_hourly_rate, sla_response_hours, sla_resolution_hours, included_onsite_visits, remote_support, ticket_priority, auto_renew, active, created_by, created_at";
const BUNDLE_ASSIGNMENT_SELECT =
  "id, client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, custom_fee, custom_included_hours, custom_extra_hourly_rate, custom_sla_response_hours, custom_sla_resolution_hours, custom_included_onsite_visits, notes, created_at, updated_at, created_by";
const BUNDLE_USAGE_SUMMARY_SELECT =
  "client_bundle_assignment_id, client_id, bundle_id, used_hours, onsite_visits, extra_hours, extra_amount, remaining_hours, remaining_onsite_visits, usage_percent";

function computeMonthlyTicketVolume(tickets: any[]) {
  const now = new Date();
  const months: { label: string; opened: number; closed: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const label = new Intl.DateTimeFormat("it-IT", { month: "short", year: "2-digit" }).format(d);
    const opened = tickets.filter((t) => {
      const created = new Date(t.created_at);
      return created.getFullYear() === year && created.getMonth() === month;
    }).length;
    const closed = tickets.filter((t) => {
      const closedDate = t.closed_at || t.completed_at;
      if (!closedDate) return false;
      const closed = new Date(closedDate);
      return closed.getFullYear() === year && closed.getMonth() === month;
    }).length;
    months.push({ label, opened, closed });
  }
  return months;
}

export async function getPortalDashboardServer(input: { token: string }) {
  const session = await getPortalSession(input.token);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: tickets, error } = await supabaseAdmin
    .from("tickets" as any)
    .select(
      "id, ticket_code, model, notes, status, created_at, updated_at, ticket_type, closed_at, completed_at",
    )
    .eq("client_id", session.clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = (tickets ?? []) as any[];

  const { data: bundleAssignments, error: bundleAssignmentsError } = await supabaseAdmin
    .from("client_bundle_assignments" as any)
    .select(`${BUNDLE_ASSIGNMENT_SELECT}, bundle:assistance_bundles(${BUNDLE_SELECT})`)
    .eq("client_id", session.clientId)
    .eq("status", "active")
    .lte("start_date", new Date().toISOString().slice(0, 10))
    .order("end_date", { ascending: true, nullsFirst: true })
    .limit(50);
  if (bundleAssignmentsError) throw bundleAssignmentsError;

  const assignmentIds = ((bundleAssignments ?? []) as any[]).map((assignment) => assignment.id);
  const { data: usageSummaries, error: usageSummariesError } = assignmentIds.length
    ? await supabaseAdmin
        .from("bundle_assignment_usage_summary" as any)
        .select(BUNDLE_USAGE_SUMMARY_SELECT)
        .in("client_bundle_assignment_id", assignmentIds)
    : { data: [], error: null };
  if (usageSummariesError) throw usageSummariesError;
  const usageByAssignment = new Map(
    ((usageSummaries ?? []) as any[]).map((summary) => [
      summary.client_bundle_assignment_id,
      summary,
    ]),
  );
  const activeBundles = ((bundleAssignments ?? []) as any[])
    .filter(
      (assignment) =>
        !assignment.end_date || assignment.end_date >= new Date().toISOString().slice(0, 10),
    )
    .map((assignment) => ({
      ...assignment,
      usage: usageByAssignment.get(assignment.id) ?? null,
    }));

  // ── Monthly ticket volume (last 6 months) ──
  let ticketVolume: { label: string; opened: number; closed: number }[] = [];
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const { data: volumeTickets, error: volumeError } = await supabaseAdmin
      .from("tickets" as any)
      .select("created_at, closed_at, completed_at")
      .eq("client_id", session.clientId)
      .gte("created_at", sixMonthsAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);
    if (volumeError) {
      console.error("[portal-dashboard] volumeTickets query failed:", volumeError);
    } else {
      ticketVolume = computeMonthlyTicketVolume((volumeTickets ?? []) as any[]);
    }
  } catch (err) {
    console.error("[portal-dashboard] ticketVolume computation failed:", err);
  }

  // ── Service statuses ──
  let services: any[] = [];
  try {
    const { data: serviceStatuses, error: serviceError } = await supabaseAdmin
      .from("app_settings" as any)
      .select("value")
      .eq("key", "portal_service_statuses")
      .maybeSingle();
    if (!serviceError && (serviceStatuses as any)?.value) {
      services = Array.isArray((serviceStatuses as any).value)
        ? (serviceStatuses as any).value
        : [];
    }
  } catch (err) {
    console.error("[portal-dashboard] serviceStatuses query failed:", err);
  }

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
    recentTickets: rows.slice(0, 10).map((ticket) => ({
      id: ticket.id,
      ticket_code: ticket.ticket_code,
      title: ticket.model || ticket.notes || "Ticket assistenza",
      status: ticket.status,
      status_label: statusLabel(ticket.status),
      created_at: ticket.created_at,
    })),
    activeBundles,
    ticketVolume,
    services,
  };
}
