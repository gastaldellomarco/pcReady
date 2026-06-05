import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPortalSession } from "@/lib/portal-auth.server";

export async function listPortalDevicesServer(input: { token: string }) {
  const session = await getPortalSession(input.token);
  const { data: devices, error } = await supabaseAdmin
    .from("devices" as any)
    .select(
      "id, model, serial, os, status, assigned_to, updated_at, purchase_date, warranty_expiry_date, warranty_type, warranty_provider, warranty_notes",
    )
    .eq("client_id", session.clientId)
    .order("model", { ascending: true })
    .limit(200);
  if (error) throw error;
  const deviceIds = ((devices ?? []) as any[]).map((device) => device.id);
  const { data: tickets, error: ticketError } = deviceIds.length
    ? await supabaseAdmin
        .from("tickets" as any)
        .select(
          "id, ticket_code, device_id, status, created_at, model, updated_at, closed_at, completed_at",
        )
        .in("device_id", deviceIds)
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [], error: null };
  if (ticketError) throw ticketError;
  const latestByDevice = new Map<string, any>();
  const ticketsByDevice = new Map<string, any[]>();
  ((tickets ?? []) as any[]).forEach((ticket) => {
    if (!latestByDevice.has(ticket.device_id)) latestByDevice.set(ticket.device_id, ticket);
    const list = ticketsByDevice.get(ticket.device_id) || [];
    list.push(ticket);
    ticketsByDevice.set(ticket.device_id, list);
  });
  return {
    session,
    devices: ((devices ?? []) as any[]).map((device) => ({
      ...device,
      lastTicket: latestByDevice.get(device.id) ?? null,
      ticketHistory: ticketsByDevice.get(device.id) ?? [],
    })),
  };
}
