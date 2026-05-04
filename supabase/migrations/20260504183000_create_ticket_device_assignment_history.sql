-- Migration: create persistent history for ticket-device assignments
-- This table stores assignment events even if tickets or assignments are deleted

CREATE TABLE IF NOT EXISTS public.ticket_device_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID,
  device_id UUID,
  assignment_id UUID,
  action TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id UUID,
  changed_fields JSONB,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS ticket_device_assignment_history_ticket_idx
  ON public.ticket_device_assignment_history(ticket_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ticket_device_assignment_history_device_idx
  ON public.ticket_device_assignment_history(device_id, occurred_at DESC);

ALTER TABLE public.ticket_device_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authed read ticket device assignment history"
  ON public.ticket_device_assignment_history
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Tech/admin insert ticket device assignment history"
  ON public.ticket_device_assignment_history
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

-- Trigger function: mirror events from ticket_device_assignments into history
CREATE OR REPLACE FUNCTION public.track_ticket_device_assignment_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_device_assignment_history (ticket_id, device_id, assignment_id, action, occurred_at, actor_id, notes)
    VALUES (NEW.ticket_id, NEW.device_id, NEW.id, 'assigned', COALESCE(NEW.assigned_at, now()), auth.uid(), NEW.notes);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- unassignment
    IF OLD.unassigned_at IS NULL AND NEW.unassigned_at IS NOT NULL THEN
      INSERT INTO public.ticket_device_assignment_history (ticket_id, device_id, assignment_id, action, occurred_at, actor_id, notes)
      VALUES (NEW.ticket_id, NEW.device_id, NEW.id, 'unassigned', COALESCE(NEW.unassigned_at, now()), auth.uid(), NEW.notes);
    END IF;

    -- replacement (device changed)
    IF OLD.device_id IS DISTINCT FROM NEW.device_id THEN
      INSERT INTO public.ticket_device_assignment_history (ticket_id, device_id, assignment_id, action, occurred_at, actor_id, changed_fields, notes)
      VALUES (NEW.id, NEW.device_id, NEW.id, 'replaced', now(), auth.uid(), jsonb_build_object('from', OLD.device_id, 'to', NEW.device_id), NEW.notes);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.ticket_device_assignment_history (ticket_id, device_id, assignment_id, action, occurred_at, actor_id, notes)
    VALUES (OLD.ticket_id, OLD.device_id, OLD.id, 'deleted', now(), auth.uid(), OLD.notes);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ticket_device_assignments_history_trigger ON public.ticket_device_assignments;

CREATE TRIGGER ticket_device_assignments_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.ticket_device_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.track_ticket_device_assignment_history();
