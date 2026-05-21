-- Indexes for paginated list queries (devices, tickets, clients) and active device assignments.

CREATE INDEX IF NOT EXISTS idx_devices_status ON public.devices (status);
CREATE INDEX IF NOT EXISTS idx_devices_client_id ON public.devices (client_id);
CREATE INDEX IF NOT EXISTS idx_devices_updated_at_desc ON public.devices (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_status_created_at
  ON public.tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_device_assignments_active_device
  ON public.ticket_device_assignments (device_id)
  WHERE unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients (name);
