ALTER TABLE public.tickets
  ALTER COLUMN model DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.ticket_device_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS ticket_device_assignments_ticket_idx
  ON public.ticket_device_assignments(ticket_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS ticket_device_assignments_device_idx
  ON public.ticket_device_assignments(device_id, assigned_at DESC);

ALTER TABLE public.ticket_device_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authed read ticket device assignments"
  ON public.ticket_device_assignments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Tech/admin insert ticket device assignments"
  ON public.ticket_device_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

CREATE POLICY "Tech/admin update ticket device assignments"
  ON public.ticket_device_assignments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

INSERT INTO public.ticket_device_assignments (ticket_id, device_id, assigned_at, assigned_by, notes)
SELECT t.id, t.device_id, COALESCE(t.created_at, now()), t.created_by, 'Backfill da tickets.device_id'
FROM public.tickets t
WHERE t.device_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.ticket_device_assignments h
    WHERE h.ticket_id = t.id
      AND h.device_id = t.device_id
      AND h.unassigned_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.track_ticket_device_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.device_id IS NOT NULL THEN
      INSERT INTO public.ticket_device_assignments (ticket_id, device_id, assigned_by, notes)
      VALUES (NEW.id, NEW.device_id, auth.uid(), 'Associazione iniziale');
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.device_id IS DISTINCT FROM NEW.device_id THEN
    IF OLD.device_id IS NOT NULL THEN
      UPDATE public.ticket_device_assignments
      SET unassigned_at = now()
      WHERE ticket_id = OLD.id
        AND device_id = OLD.device_id
        AND unassigned_at IS NULL;
    END IF;

    IF NEW.device_id IS NOT NULL THEN
      INSERT INTO public.ticket_device_assignments (ticket_id, device_id, assigned_by, notes)
      VALUES (NEW.id, NEW.device_id, auth.uid(), 'Cambio dispositivo ticket');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_device_assignment_history ON public.tickets;

CREATE TRIGGER tickets_device_assignment_history
  AFTER INSERT OR UPDATE OF device_id ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.track_ticket_device_assignment();
