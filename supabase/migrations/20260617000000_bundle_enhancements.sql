-- Enhancements for assistance bundles:
-- * is_custom + custom_client_id: bundles tied to a specific client (not in general catalog)
-- * low_hours_threshold_pct: configurable threshold per bundle for low-hours alert
-- * last_low_hours_notified_percent + low_hours_notified_at on assignment: idempotent notifications
-- * extend sync_bundle_usage_from_time_entry to insert a bundle_low_hours notification
--   when the assignment crosses the threshold (transition only).
-- The function runs SECURITY DEFINER so it bypasses notifications RLS for the INSERT.

ALTER TABLE public.assistance_bundles
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_client_id uuid
    -- CASCADE (not SET NULL) on the ad-hoc FK: deleting the dedicated client
    -- must remove the custom bundle, otherwise we'd leave an orphaned
    -- is_custom=true row with custom_client_id NULL, violating the
    -- assistance_bundles_custom_client_required CHECK.
    REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS low_hours_threshold_pct numeric(5,2)
    NOT NULL DEFAULT 80
    CHECK (low_hours_threshold_pct >= 0 AND low_hours_threshold_pct <= 100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'assistance_bundles_custom_client_required'
      AND conrelid = 'public.assistance_bundles'::regclass
  ) THEN
    ALTER TABLE public.assistance_bundles
      ADD CONSTRAINT assistance_bundles_custom_client_required
      CHECK ((is_custom = false) OR (custom_client_id IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS assistance_bundles_custom_client_idx
  ON public.assistance_bundles (custom_client_id)
  WHERE is_custom = true;

-- Relax client_bundle_assignments.bundle_id from RESTRICT to NO ACTION so that
-- deleting a client with ad-hoc-bundle assignments can proceed cleanly.
-- Plan: DELETE FROM clients fires both CASCADE branches in the same statement:
--   1. clients -> client_bundle_assignments (client_id CASCADE) -- removes the rows.
--   2. clients -> assistance_bundles       (custom_client_id CASCADE) -- removes the bundle.
-- RESTRICT aborts the statement instantly as soon as a restricting FK is hit,
-- regardless of cascade-clearable siblings in the same DELETE. NO ACTION
-- defers the FK check to end-of-statement, by which time the assignments are
-- already gone and the bundle can be safely removed. Direct DELETE of an
-- ad-hoc bundle while assignments still exist will still error (intentional
-- -- admins should cancel/remove the assignment first); surface that via
-- errorMessage() in the UI.
DO $$
DECLARE
  existing_bundle_fk text;
BEGIN
  -- Drop any pre-existing FK on bundle_id regardless of its name so this
  -- migration is idempotent on databases where the FK was named differently.
  -- Gates on IF EXISTS to avoid the `no_data_found` raised by PL/pgSQL when
  -- EXECUTE is given a subquery returning zero rows (fresh DB scenario).
  SELECT c.conname INTO existing_bundle_fk
  FROM pg_constraint c
  WHERE c.conrelid = 'public.client_bundle_assignments'::regclass
    AND c.contype = 'f'
    AND pg_get_constraintdef(c.oid) ILIKE '%REFERENCES public.assistance_bundles(id)%'
    AND c.conname LIKE '%bundle_id%'
  LIMIT 1;

  IF existing_bundle_fk IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.client_bundle_assignments DROP CONSTRAINT %I',
      existing_bundle_fk
    );
  END IF;

  ALTER TABLE public.client_bundle_assignments
    ADD CONSTRAINT client_bundle_assignments_bundle_id_fkey
    FOREIGN KEY (bundle_id) REFERENCES public.assistance_bundles(id)
    ON DELETE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.client_bundle_assignments
  ADD COLUMN IF NOT EXISTS last_low_hours_notified_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS low_hours_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.sync_bundle_usage_from_time_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket_row public.tickets%ROWTYPE;
  assignment_row record;
  used_hours_value numeric(10,2);
  current_used_hours numeric(10,2);
  included_hours_value numeric(10,2);
  extra_rate_value numeric(10,2);
  previous_overage numeric(10,2);
  new_overage numeric(10,2);
  extra_hours_value numeric(10,2);
  extra_amount_value numeric(12,2);
  threshold_pct numeric(5,2);
  current_usage_pct numeric(7,2);
  previously_notified_pct numeric(5,2);
  threshold_crossed boolean;
  threshold_uncrossed boolean;
BEGIN
  IF NEW.ended_at IS NULL OR COALESCE(NEW.duration_minutes, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO ticket_row
  FROM public.tickets
  WHERE id = NEW.ticket_id;

  IF NOT FOUND
     OR ticket_row.client_id IS NULL
     OR ticket_row.bundle_assignment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    a.id,
    a.client_id,
    a.created_by,
    COALESCE(a.custom_included_hours, b.included_hours) AS included_hours,
    COALESCE(a.custom_extra_hourly_rate, b.extra_hourly_rate) AS extra_hourly_rate,
    COALESCE(b.low_hours_threshold_pct, 80) AS low_hours_threshold_pct,
    b.name AS bundle_name,
    COALESCE(c.company_name, c.name) AS client_name
  INTO assignment_row
  FROM public.client_bundle_assignments a
  JOIN public.assistance_bundles b ON b.id = a.bundle_id
  JOIN public.clients c ON c.id = a.client_id
  WHERE a.id = ticket_row.bundle_assignment_id
    AND a.client_id = ticket_row.client_id
    AND a.status = 'active'
    AND b.active = true
    AND a.start_date <= current_date
    AND (a.end_date IS NULL OR a.end_date >= current_date)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  used_hours_value := round((NEW.duration_minutes::numeric / 60), 2);
  included_hours_value := assignment_row.included_hours;
  extra_rate_value := COALESCE(assignment_row.extra_hourly_rate, 0);

  SELECT COALESCE(SUM(used_hours), 0)::numeric(10,2)
  INTO current_used_hours
  FROM public.bundle_usage_entries
  WHERE client_bundle_assignment_id = assignment_row.id
    AND (time_entry_id IS NULL OR time_entry_id <> NEW.id);

  IF included_hours_value IS NULL THEN
    extra_hours_value := 0;
  ELSE
    previous_overage := GREATEST(current_used_hours - included_hours_value, 0);
    new_overage := GREATEST(current_used_hours + used_hours_value - included_hours_value, 0);
    extra_hours_value := GREATEST(new_overage - previous_overage, 0);
  END IF;

  extra_amount_value := round((extra_hours_value * extra_rate_value)::numeric, 2);

  INSERT INTO public.bundle_usage_entries (
    client_bundle_assignment_id,
    client_id,
    ticket_id,
    time_entry_id,
    usage_type,
    used_hours,
    onsite_visits,
    extra_hours,
    extra_amount,
    description,
    used_at,
    created_by
  ) VALUES (
    assignment_row.id,
    ticket_row.client_id,
    ticket_row.id,
    NEW.id,
    CASE WHEN COALESCE(ticket_row.onsite_visit, false) THEN 'onsite_hours' ELSE 'remote_hours' END,
    used_hours_value,
    0,
    extra_hours_value,
    extra_amount_value,
    NEW.description,
    COALESCE(NEW.ended_at, now()),
    NEW.user_id
  )
  ON CONFLICT (time_entry_id) WHERE time_entry_id IS NOT NULL DO UPDATE
  SET client_bundle_assignment_id = EXCLUDED.client_bundle_assignment_id,
      client_id = EXCLUDED.client_id,
      ticket_id = EXCLUDED.ticket_id,
      usage_type = EXCLUDED.usage_type,
      used_hours = EXCLUDED.used_hours,
      extra_hours = EXCLUDED.extra_hours,
      extra_amount = EXCLUDED.extra_amount,
      description = EXCLUDED.description,
      used_at = EXCLUDED.used_at;

  UPDATE public.tickets t
  SET bundle_extra_hours = COALESCE(ticket_usage.extra_hours, 0),
      bundle_extra_amount = COALESCE(ticket_usage.extra_amount, 0)
  FROM (
    SELECT
      COALESCE(SUM(extra_hours), 0)::numeric(10,2) AS extra_hours,
      COALESCE(SUM(extra_amount), 0)::numeric(12,2) AS extra_amount
    FROM public.bundle_usage_entries
    WHERE ticket_id = ticket_row.id
      AND client_bundle_assignment_id = assignment_row.id
  ) AS ticket_usage
  WHERE t.id = ticket_row.id;

  -- Low-hours threshold notification (only when the assignment has a finite included_hours).
  IF included_hours_value IS NOT NULL AND included_hours_value > 0 THEN
    threshold_pct := COALESCE(assignment_row.low_hours_threshold_pct, 80);
    current_usage_pct := round(
      ((current_used_hours + used_hours_value) / included_hours_value) * 100,
      2
    );

    SELECT last_low_hours_notified_percent
    INTO previously_notified_pct
    FROM public.client_bundle_assignments
    WHERE id = assignment_row.id;

    threshold_crossed := (current_usage_pct >= threshold_pct)
      AND COALESCE(previously_notified_pct, -1) < threshold_pct;
    threshold_uncrossed := (current_usage_pct < threshold_pct)
      AND COALESCE(previously_notified_pct, threshold_pct) >= threshold_pct;

    IF threshold_crossed THEN
      IF assignment_row.created_by IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, payload, link)
        VALUES (
          assignment_row.created_by,
          'bundle_low_hours',
          'Soglia consumo bundle raggiunta',
          format(
            'Bundle %s (%s) ha raggiunto %s%% delle ore incluse.',
            assignment_row.bundle_name,
            assignment_row.client_name,
            current_usage_pct
          ),
          jsonb_build_object(
            'client_bundle_assignment_id', assignment_row.id,
            'client_id', ticket_row.client_id,
            'bundle_id', ticket_row.bundle_id,
            'usage_percent', current_usage_pct,
            'threshold_pct', threshold_pct
          ),
          '/bundles'
        );
      END IF;

      UPDATE public.client_bundle_assignments
      SET last_low_hours_notified_percent = current_usage_pct,
          low_hours_notified_at = now()
      WHERE id = assignment_row.id;
    ELSIF threshold_uncrossed THEN
      -- Reset the marker so a future crossing can fire again.
      UPDATE public.client_bundle_assignments
      SET last_low_hours_notified_percent = NULL,
          low_hours_notified_at = NULL
      WHERE id = assignment_row.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ticket_time_entries_sync_bundle_usage ON public.ticket_time_entries;
CREATE TRIGGER ticket_time_entries_sync_bundle_usage
  AFTER INSERT OR UPDATE OF ended_at, duration_minutes, description
  ON public.ticket_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_bundle_usage_from_time_entry();

COMMENT ON COLUMN public.assistance_bundles.is_custom
  IS 'True se il bundle è personalizzato per un cliente specifico e non va mostrato nel catalogo generale.';
COMMENT ON COLUMN public.assistance_bundles.custom_client_id
  IS 'Se is_custom=true, identifica il cliente a cui il bundle è dedicato.';
COMMENT ON COLUMN public.assistance_bundles.low_hours_threshold_pct
  IS 'Percentuale di ore incluse che fa scattare la notifica bundle_low_hours. Default 80%.';
COMMENT ON COLUMN public.client_bundle_assignments.last_low_hours_notified_percent
  IS 'Percentuale di utilizzo registrata l''ultima volta che è stata emessa la notifica bundle_low_hours. NULL se si è scesi sotto la soglia.';
COMMENT ON COLUMN public.client_bundle_assignments.low_hours_notified_at
  IS 'Timestamp dell''ultima notifica bundle_low_hours per questa assegnazione.';
