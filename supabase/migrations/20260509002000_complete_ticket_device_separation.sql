ALTER TABLE public.tickets
  ALTER COLUMN device_id DROP NOT NULL;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_device_id_fkey;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_device_id_fkey
  FOREIGN KEY (device_id)
  REFERENCES public.devices(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tickets_device_id_idx
  ON public.tickets(device_id)
  WHERE device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tickets_client_id_idx
  ON public.tickets(client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tickets_requester_contact_id_idx
  ON public.tickets(requester_contact_id)
  WHERE requester_contact_id IS NOT NULL;

UPDATE public.tickets t
SET device_id = d.id
FROM public.devices d
WHERE t.device_id IS NULL
  AND t.client_id IS NOT NULL
  AND d.client_id = t.client_id
  AND (
    (t.serial IS NOT NULL AND btrim(t.serial) <> '' AND d.serial IS NOT NULL AND lower(d.serial) = lower(btrim(t.serial)))
    OR (
      (t.serial IS NULL OR btrim(t.serial) = '')
      AND t.model IS NOT NULL
      AND btrim(t.model) <> ''
      AND d.model = t.model
    )
  );

INSERT INTO public.ticket_device_assignments (ticket_id, device_id, assigned_at, assigned_by, notes)
SELECT t.id, t.device_id, COALESCE(t.created_at, now()), t.created_by, 'Backfill separazione ticket-device'
FROM public.tickets t
WHERE t.device_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.ticket_device_assignments a
    WHERE a.ticket_id = t.id
      AND a.device_id = t.device_id
      AND a.unassigned_at IS NULL
  );

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
    IF OLD.unassigned_at IS NULL AND NEW.unassigned_at IS NOT NULL THEN
      INSERT INTO public.ticket_device_assignment_history (ticket_id, device_id, assignment_id, action, occurred_at, actor_id, notes)
      VALUES (NEW.ticket_id, NEW.device_id, NEW.id, 'unassigned', COALESCE(NEW.unassigned_at, now()), auth.uid(), NEW.notes);
    END IF;

    IF OLD.device_id IS DISTINCT FROM NEW.device_id THEN
      INSERT INTO public.ticket_device_assignment_history (ticket_id, device_id, assignment_id, action, occurred_at, actor_id, changed_fields, notes)
      VALUES (NEW.ticket_id, NEW.device_id, NEW.id, 'replaced', now(), auth.uid(), jsonb_build_object('from', OLD.device_id, 'to', NEW.device_id), NEW.notes);
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
