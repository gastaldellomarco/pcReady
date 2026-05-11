-- Migration: ticket_status_history table for tracking status transitions
-- Created: 2026-05-11

-- Create the ticket_status_history table
CREATE TABLE IF NOT EXISTS public.ticket_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_status text,                    -- null if initial creation
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id), -- null if automatic/system
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text                            -- optional note about the change
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS ticket_status_history_ticket_id_idx ON public.ticket_status_history(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_status_history_changed_at_idx ON public.ticket_status_history(changed_at);
CREATE INDEX IF NOT EXISTS ticket_status_history_changed_by_idx ON public.ticket_status_history(changed_by);

-- Enable RLS
ALTER TABLE public.ticket_status_history ENABLE ROW LEVEL SECURITY;

-- Policy: Clients can view history only for their own tickets
DROP POLICY IF EXISTS "client can view own ticket history" ON public.ticket_status_history;
CREATE POLICY "client can view own ticket history"
  ON public.ticket_status_history FOR SELECT
  USING (
    ticket_id IN (
      SELECT id FROM public.tickets WHERE client_id = auth.uid()
    )
  );

-- Policy: Authenticated users can view all history (for admin interface)
DROP POLICY IF EXISTS "authenticated users can view all history" ON public.ticket_status_history;
CREATE POLICY "authenticated users can view all history"
  ON public.ticket_status_history FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert history (for status changes)
DROP POLICY IF EXISTS "authenticated users can insert history" ON public.ticket_status_history;
CREATE POLICY "authenticated users can insert history"
  ON public.ticket_status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: History records cannot be modified or deleted by anyone (immutable)
DROP POLICY IF EXISTS "history records cannot be updated" ON public.ticket_status_history;
CREATE POLICY "history records cannot be updated"
  ON public.ticket_status_history FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "history records cannot be deleted" ON public.ticket_status_history;
CREATE POLICY "history records cannot be deleted"
  ON public.ticket_status_history FOR DELETE
  TO authenticated
  USING (false);

-- Comments for documentation
COMMENT ON TABLE public.ticket_status_history IS 'Tracks all status transitions for tickets, providing audit trail for customer portal';
COMMENT ON COLUMN public.ticket_status_history.from_status IS 'Previous status (null if this is the initial status upon ticket creation)';
COMMENT ON COLUMN public.ticket_status_history.to_status IS 'New status after the transition';
COMMENT ON COLUMN public.ticket_status_history.changed_by IS 'User who made the change (null for automatic/system changes)';
COMMENT ON COLUMN public.ticket_status_history.note IS 'Optional note explaining the status change';
