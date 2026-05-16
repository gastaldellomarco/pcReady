-- SLA tracking for tickets: deadlines, breach flag and configurable thresholds.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sla_response_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_sla_deadline_active
  ON public.tickets (sla_deadline)
  WHERE status NOT IN ('completed', 'archived') AND sla_deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_sla_breached_active
  ON public.tickets (sla_breached, sla_deadline)
  WHERE status NOT IN ('completed', 'archived');

INSERT INTO public.app_settings (key, value)
VALUES
  ('sla_config', '{"high":{"responseHours":1,"resolutionHours":4},"med":{"responseHours":4,"resolutionHours":24},"low":{"responseHours":24,"resolutionHours":72}}'::jsonb),
  ('sla_limits', '{"high":4,"med":24,"low":72}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_sla_resolution_hours(ticket_priority public.ticket_priority)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  cfg jsonb;
  legacy jsonb;
  priority_key text := ticket_priority::text;
  hours integer;
BEGIN
  SELECT value INTO cfg FROM public.app_settings WHERE key = 'sla_config';
  SELECT value INTO legacy FROM public.app_settings WHERE key = 'sla_limits';

  hours := NULLIF((cfg -> priority_key ->> 'resolutionHours'), '')::integer;
  IF hours IS NULL THEN
    hours := NULLIF((legacy ->> priority_key), '')::integer;
  END IF;

  RETURN COALESCE(
    hours,
    CASE ticket_priority
      WHEN 'high' THEN 4
      WHEN 'med' THEN 24
      WHEN 'low' THEN 72
      ELSE 24
    END
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN CASE ticket_priority
    WHEN 'high' THEN 4
    WHEN 'med' THEN 24
    WHEN 'low' THEN 72
    ELSE 24
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_ticket_sla_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolution_hours integer;
  effective_deadline timestamptz;
BEGIN
  resolution_hours := public.get_sla_resolution_hours(NEW.priority);

  IF TG_OP = 'INSERT' THEN
    NEW.sla_deadline := COALESCE(NEW.created_at, now()) + make_interval(hours => resolution_hours);
  ELSIF NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.sla_deadline IS NULL THEN
    NEW.sla_deadline := COALESCE(NEW.created_at, now()) + make_interval(hours => resolution_hours);
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.sla_response_at IS NULL
     AND (
       (OLD.assignee_id IS NULL AND NEW.assignee_id IS NOT NULL)
       OR (OLD.status = 'pending' AND NEW.status IN ('in-progress', 'testing', 'ready', 'completed'))
     ) THEN
    NEW.sla_response_at := now();
  END IF;

  effective_deadline := COALESCE(NEW.due_date, NEW.sla_deadline);
  IF NEW.status IN ('completed', 'archived') THEN
    NEW.sla_breached := COALESCE(NEW.sla_breached, FALSE);
  ELSE
    NEW.sla_breached := effective_deadline IS NOT NULL AND effective_deadline < now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_sla_fields ON public.tickets;
CREATE TRIGGER tickets_sla_fields
  BEFORE INSERT OR UPDATE OF priority, created_at, due_date, sla_deadline, assignee_id, status
  ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ticket_sla_fields();

CREATE OR REPLACE FUNCTION public.refresh_ticket_sla_breaches()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_count integer;
BEGIN
  UPDATE public.tickets
  SET sla_breached = TRUE,
      updated_at = updated_at
  WHERE status NOT IN ('completed', 'archived')
    AND sla_breached IS DISTINCT FROM TRUE
    AND COALESCE(due_date, sla_deadline) < now();

  GET DIAGNOSTICS changed_count = ROW_COUNT;
  RETURN changed_count;
END;
$$;

UPDATE public.tickets
SET sla_deadline = COALESCE(sla_deadline, created_at + make_interval(hours => public.get_sla_resolution_hours(priority))),
    sla_breached = CASE
      WHEN status IN ('completed', 'archived') THEN COALESCE(sla_breached, FALSE)
      ELSE COALESCE(due_date, sla_deadline, created_at + make_interval(hours => public.get_sla_resolution_hours(priority))) < now()
    END
WHERE sla_deadline IS NULL
   OR sla_breached IS DISTINCT FROM (
      CASE
        WHEN status IN ('completed', 'archived') THEN COALESCE(sla_breached, FALSE)
        ELSE COALESCE(due_date, sla_deadline, created_at + make_interval(hours => public.get_sla_resolution_hours(priority))) < now()
      END
   );

COMMENT ON COLUMN public.tickets.due_date IS 'Manual due date set by staff/admin.';
COMMENT ON COLUMN public.tickets.sla_deadline IS 'Automatic resolution deadline calculated from priority and app_settings.sla_config.';
COMMENT ON COLUMN public.tickets.sla_breached IS 'True when the effective SLA deadline has been exceeded.';
COMMENT ON COLUMN public.tickets.sla_response_at IS 'Timestamp of first assignment or first transition out of pending.';
COMMENT ON FUNCTION public.refresh_ticket_sla_breaches() IS 'Marks active tickets as SLA breached. Intended for scheduled execution/cron.';
