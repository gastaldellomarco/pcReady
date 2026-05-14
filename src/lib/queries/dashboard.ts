import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type DashboardRange = { from: string; to: string };

export async function fetchDashboardSnapshot(range: DashboardRange) {
  const from = range.from;
  const to = range.to;
  const [tRes, lRes, dRes, aRes] = await Promise.all([
    supabase
      .from('tickets')
      .select(
        'id, ticket_code, client, status, created_at, device:devices(model, serial), assignee:profiles!tickets_assignee_id_fkey(full_name, initials)',
      )
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false }),
    supabase
      .from('activity_log')
      .select('id, type, message, created_at, actor:profiles!activity_log_actor_id_fkey(full_name, initials)')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('devices')
      .select('id, model, serial, created_at, status, client_id, assigned_to')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('ticket_device_assignments').select('device_id').is('unassigned_at', null),
  ]);

  const t = (tRes as any).data ?? [];
  const l = (lRes as any).data ?? [];
  const d = (dRes as any).data ?? [];
  const a = (aRes as any).data ?? [];

  const assignedIds = new Set((a as any[]).map((r) => r.device_id));
  const devices = d as any[];
  const recentDevices = devices.slice(0, 6);
  const devicesWithoutTicket = devices.filter((dev) => !assignedIds.has(dev.id));
  const withoutDevice = (t as any[]).filter((tt) => !tt.device).length;
  const activeClients = new Set((t as any[]).map((tt) => tt.client).filter(Boolean));

  return {
    tickets: t,
    logs: l,
    devices,
    recentDevices,
    devicesWithoutTicket,
    ticketsWithoutDeviceCount: withoutDevice,
    activeClientsCount: activeClients.size,
  };
}

export function useDashboardSnapshot(range: DashboardRange) {
  return useQuery({
    queryKey: ['dashboard', range.from, range.to],
    queryFn: () => fetchDashboardSnapshot(range),
    placeholderData: (previousData) => previousData,
  });
}

export default { fetchDashboardSnapshot, useDashboardSnapshot };
