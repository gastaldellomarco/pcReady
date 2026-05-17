-- Database layer for assistance bundles / pacchetti assistenza.

CREATE TABLE IF NOT EXISTS public.assistance_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  billing_type text NOT NULL DEFAULT 'annual' CHECK (billing_type IN ('monthly', 'annual', 'one_time')),
  fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  included_hours numeric(10,2) CHECK (included_hours IS NULL OR included_hours >= 0),
  extra_hourly_rate numeric(10,2) NOT NULL DEFAULT 0 CHECK (extra_hourly_rate >= 0),
  sla_response_hours numeric(10,2) NOT NULL DEFAULT 8 CHECK (sla_response_hours > 0),
  sla_resolution_hours numeric(10,2) NOT NULL DEFAULT 48 CHECK (sla_resolution_hours > 0),
  included_onsite_visits integer CHECK (included_onsite_visits IS NULL OR included_onsite_visits >= 0),
  remote_support boolean NOT NULL DEFAULT true,
  ticket_priority text NOT NULL DEFAULT 'med' CHECK (ticket_priority IN ('low', 'med', 'high', 'critical')),
  auto_renew boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.client_bundle_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  bundle_id uuid NOT NULL REFERENCES public.assistance_bundles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending', 'renewed')),
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  auto_renew boolean NOT NULL DEFAULT true,
  renewal_mode text NOT NULL DEFAULT 'automatic' CHECK (renewal_mode IN ('automatic', 'manual')),
  custom_fee numeric(12,2) CHECK (custom_fee IS NULL OR custom_fee >= 0),
  custom_included_hours numeric(10,2) CHECK (custom_included_hours IS NULL OR custom_included_hours >= 0),
  custom_extra_hourly_rate numeric(10,2) CHECK (custom_extra_hourly_rate IS NULL OR custom_extra_hourly_rate >= 0),
  custom_sla_response_hours numeric(10,2) CHECK (custom_sla_response_hours IS NULL OR custom_sla_response_hours > 0),
  custom_sla_resolution_hours numeric(10,2) CHECK (custom_sla_resolution_hours IS NULL OR custom_sla_resolution_hours > 0),
  custom_included_onsite_visits integer CHECK (custom_included_onsite_visits IS NULL OR custom_included_onsite_visits >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.bundle_usage_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_bundle_assignment_id uuid NOT NULL REFERENCES public.client_bundle_assignments(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  time_entry_id uuid REFERENCES public.ticket_time_entries(id) ON DELETE SET NULL,
  usage_type text NOT NULL DEFAULT 'remote_hours' CHECK (usage_type IN ('remote_hours', 'onsite_hours', 'onsite_visit', 'manual_adjustment')),
  used_hours numeric(10,2) NOT NULL DEFAULT 0,
  onsite_visits integer NOT NULL DEFAULT 0,
  extra_hours numeric(10,2) NOT NULL DEFAULT 0,
  extra_amount numeric(12,2) NOT NULL DEFAULT 0,
  description text,
  used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.bundle_fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_bundle_assignment_id uuid NOT NULL REFERENCES public.client_bundle_assignments(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  period_start date,
  period_end date,
  paid_at date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CHECK (period_end IS NULL OR period_start IS NULL OR period_end >= period_start)
);

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS bundle_assignment_id uuid REFERENCES public.client_bundle_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bundle_extra_hours numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bundle_extra_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onsite_visit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sla_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_resolution_due_at timestamptz;

CREATE INDEX IF NOT EXISTS assistance_bundles_active_idx
  ON public.assistance_bundles (active, billing_type);

CREATE INDEX IF NOT EXISTS client_bundle_assignments_active_client_idx
  ON public.client_bundle_assignments (client_id, start_date, end_date)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS client_bundle_assignments_bundle_idx
  ON public.client_bundle_assignments (bundle_id, status);

CREATE INDEX IF NOT EXISTS bundle_usage_entries_assignment_used_at_idx
  ON public.bundle_usage_entries (client_bundle_assignment_id, used_at DESC);

CREATE INDEX IF NOT EXISTS bundle_usage_entries_ticket_idx
  ON public.bundle_usage_entries (ticket_id)
  WHERE ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bundle_usage_entries_assignment_month_idx
  ON public.bundle_usage_entries (client_bundle_assignment_id, date_trunc('month', used_at AT TIME ZONE 'UTC'));

CREATE UNIQUE INDEX IF NOT EXISTS bundle_usage_entries_time_entry_unique_idx
  ON public.bundle_usage_entries (time_entry_id)
  WHERE time_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bundle_fee_payments_assignment_status_idx
  ON public.bundle_fee_payments (client_bundle_assignment_id, status, period_start DESC);

CREATE INDEX IF NOT EXISTS bundle_fee_payments_client_status_idx
  ON public.bundle_fee_payments (client_id, status, paid_at DESC);

CREATE INDEX IF NOT EXISTS tickets_bundle_assignment_idx
  ON public.tickets (bundle_assignment_id)
  WHERE bundle_assignment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_assistance_bundle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assistance_bundles_touch_updated_at ON public.assistance_bundles;
CREATE TRIGGER assistance_bundles_touch_updated_at
  BEFORE UPDATE ON public.assistance_bundles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_assistance_bundle_updated_at();

DROP TRIGGER IF EXISTS client_bundle_assignments_touch_updated_at ON public.client_bundle_assignments;
CREATE TRIGGER client_bundle_assignments_touch_updated_at
  BEFORE UPDATE ON public.client_bundle_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_assistance_bundle_updated_at();

ALTER TABLE public.assistance_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_bundle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_usage_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_fee_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated can read assistance bundles" ON public.assistance_bundles;
CREATE POLICY "authenticated can read assistance bundles"
  ON public.assistance_bundles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin can insert assistance bundles" ON public.assistance_bundles;
CREATE POLICY "admin can insert assistance bundles"
  ON public.assistance_bundles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin can update assistance bundles" ON public.assistance_bundles;
CREATE POLICY "admin can update assistance bundles"
  ON public.assistance_bundles FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin can delete assistance bundles" ON public.assistance_bundles;
CREATE POLICY "admin can delete assistance bundles"
  ON public.assistance_bundles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "authenticated can read client bundle assignments" ON public.client_bundle_assignments;
CREATE POLICY "authenticated can read client bundle assignments"
  ON public.client_bundle_assignments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin and tech can insert client bundle assignments" ON public.client_bundle_assignments;
CREATE POLICY "admin and tech can insert client bundle assignments"
  ON public.client_bundle_assignments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "admin and tech can update client bundle assignments" ON public.client_bundle_assignments;
CREATE POLICY "admin and tech can update client bundle assignments"
  ON public.client_bundle_assignments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "admin can delete client bundle assignments" ON public.client_bundle_assignments;
CREATE POLICY "admin can delete client bundle assignments"
  ON public.client_bundle_assignments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "authenticated can read bundle usage entries" ON public.bundle_usage_entries;
CREATE POLICY "authenticated can read bundle usage entries"
  ON public.bundle_usage_entries FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin and tech can insert bundle usage entries" ON public.bundle_usage_entries;
CREATE POLICY "admin and tech can insert bundle usage entries"
  ON public.bundle_usage_entries FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "admin and tech can update bundle usage entries" ON public.bundle_usage_entries;
CREATE POLICY "admin and tech can update bundle usage entries"
  ON public.bundle_usage_entries FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "admin can delete bundle usage entries" ON public.bundle_usage_entries;
CREATE POLICY "admin can delete bundle usage entries"
  ON public.bundle_usage_entries FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "authenticated can read bundle fee payments" ON public.bundle_fee_payments;
CREATE POLICY "authenticated can read bundle fee payments"
  ON public.bundle_fee_payments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin and tech can insert bundle fee payments" ON public.bundle_fee_payments;
CREATE POLICY "admin and tech can insert bundle fee payments"
  ON public.bundle_fee_payments FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "admin and tech can update bundle fee payments" ON public.bundle_fee_payments;
CREATE POLICY "admin and tech can update bundle fee payments"
  ON public.bundle_fee_payments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "admin can delete bundle fee payments" ON public.bundle_fee_payments;
CREATE POLICY "admin can delete bundle fee payments"
  ON public.bundle_fee_payments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.active_client_bundle_assignments AS
SELECT
  a.id,
  a.client_id,
  COALESCE(c.company_name, c.name) AS client_name,
  a.bundle_id,
  b.name AS bundle_name,
  b.description AS bundle_description,
  a.status,
  a.start_date,
  a.end_date,
  a.auto_renew,
  a.renewal_mode,
  COALESCE(a.custom_fee, b.fee) AS effective_fee,
  b.currency,
  b.billing_type,
  COALESCE(a.custom_included_hours, b.included_hours) AS effective_included_hours,
  COALESCE(a.custom_extra_hourly_rate, b.extra_hourly_rate) AS effective_extra_hourly_rate,
  COALESCE(a.custom_sla_response_hours, b.sla_response_hours) AS effective_sla_response_hours,
  COALESCE(a.custom_sla_resolution_hours, b.sla_resolution_hours) AS effective_sla_resolution_hours,
  COALESCE(a.custom_included_onsite_visits, b.included_onsite_visits) AS effective_included_onsite_visits,
  b.remote_support,
  b.ticket_priority,
  a.notes,
  a.created_at,
  a.updated_at,
  CASE
    WHEN a.end_date IS NULL THEN NULL
    ELSE a.end_date - current_date
  END AS days_until_expiry
FROM public.client_bundle_assignments a
JOIN public.assistance_bundles b ON b.id = a.bundle_id
JOIN public.clients c ON c.id = a.client_id
WHERE a.status = 'active'
  AND b.active = true
  AND a.start_date <= current_date
  AND (a.end_date IS NULL OR a.end_date >= current_date);

CREATE OR REPLACE VIEW public.bundle_assignment_usage_summary AS
WITH usage_totals AS (
  SELECT
    client_bundle_assignment_id,
    COALESCE(SUM(used_hours), 0)::numeric(10,2) AS used_hours,
    COALESCE(SUM(onsite_visits), 0)::integer AS onsite_visits,
    COALESCE(SUM(extra_hours), 0)::numeric(10,2) AS extra_hours,
    COALESCE(SUM(extra_amount), 0)::numeric(12,2) AS extra_amount
  FROM public.bundle_usage_entries
  GROUP BY client_bundle_assignment_id
), assignment_effective AS (
  SELECT
    a.id,
    a.client_id,
    a.bundle_id,
    COALESCE(a.custom_included_hours, b.included_hours) AS effective_included_hours,
    COALESCE(a.custom_included_onsite_visits, b.included_onsite_visits) AS effective_included_onsite_visits
  FROM public.client_bundle_assignments a
  JOIN public.assistance_bundles b ON b.id = a.bundle_id
)
SELECT
  ae.id AS client_bundle_assignment_id,
  ae.client_id,
  ae.bundle_id,
  COALESCE(ut.used_hours, 0)::numeric(10,2) AS used_hours,
  COALESCE(ut.onsite_visits, 0)::integer AS onsite_visits,
  COALESCE(ut.extra_hours, 0)::numeric(10,2) AS extra_hours,
  COALESCE(ut.extra_amount, 0)::numeric(12,2) AS extra_amount,
  CASE
    WHEN ae.effective_included_hours IS NULL THEN NULL
    ELSE GREATEST(ae.effective_included_hours - COALESCE(ut.used_hours, 0), 0)::numeric(10,2)
  END AS remaining_hours,
  CASE
    WHEN ae.effective_included_onsite_visits IS NULL THEN NULL
    ELSE GREATEST(ae.effective_included_onsite_visits - COALESCE(ut.onsite_visits, 0), 0)::integer
  END AS remaining_onsite_visits,
  CASE
    WHEN ae.effective_included_hours IS NULL OR ae.effective_included_hours = 0 THEN NULL
    ELSE round((COALESCE(ut.used_hours, 0) / ae.effective_included_hours) * 100, 2)
  END AS usage_percent
FROM assignment_effective ae
LEFT JOIN usage_totals ut ON ut.client_bundle_assignment_id = ae.id;

CREATE OR REPLACE VIEW public.bundle_monthly_usage AS
SELECT
  client_bundle_assignment_id,
  client_id,
  date_trunc('month', used_at)::date AS usage_month,
  COALESCE(SUM(used_hours), 0)::numeric(10,2) AS used_hours,
  COALESCE(SUM(onsite_visits), 0)::integer AS onsite_visits,
  COALESCE(SUM(extra_hours), 0)::numeric(10,2) AS extra_hours,
  COALESCE(SUM(extra_amount), 0)::numeric(12,2) AS extra_amount,
  COUNT(*)::integer AS entry_count
FROM public.bundle_usage_entries
GROUP BY client_bundle_assignment_id, client_id, date_trunc('month', used_at)::date;

CREATE OR REPLACE FUNCTION public.get_active_bundle_for_client(_client_id uuid)
RETURNS SETOF public.active_client_bundle_assignments
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.active_client_bundle_assignments
  WHERE client_id = _client_id
  ORDER BY (status = 'active') DESC, end_date ASC NULLS LAST, created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.apply_bundle_to_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_bundle public.active_client_bundle_assignments%ROWTYPE;
  base_time timestamptz;
BEGIN
  IF NEW.client_id IS NULL OR NEW.bundle_assignment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO active_bundle
  FROM public.get_active_bundle_for_client(NEW.client_id);

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.bundle_assignment_id := active_bundle.id;
  NEW.priority := CASE active_bundle.ticket_priority
    WHEN 'critical' THEN 'high'
    WHEN 'high' THEN 'high'
    WHEN 'low' THEN 'low'
    ELSE 'med'
  END::public.ticket_priority;

  IF NEW.hourly_rate IS NULL OR NEW.hourly_rate = 0 THEN
    NEW.hourly_rate := COALESCE(active_bundle.effective_extra_hourly_rate, 0);
  END IF;

  base_time := COALESCE(NEW.created_at, now());
  NEW.sla_response_due_at := COALESCE(NEW.sla_response_due_at, base_time + (active_bundle.effective_sla_response_hours * interval '1 hour'));
  NEW.sla_resolution_due_at := COALESCE(NEW.sla_resolution_due_at, base_time + (active_bundle.effective_sla_resolution_hours * interval '1 hour'));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_apply_bundle ON public.tickets;
CREATE TRIGGER tickets_apply_bundle
  BEFORE INSERT OR UPDATE OF client_id
  ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_bundle_to_ticket();

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
    COALESCE(a.custom_included_hours, b.included_hours) AS included_hours,
    COALESCE(a.custom_extra_hourly_rate, b.extra_hourly_rate) AS extra_hourly_rate
  INTO assignment_row
  FROM public.client_bundle_assignments a
  JOIN public.assistance_bundles b ON b.id = a.bundle_id
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ticket_time_entries_sync_bundle_usage ON public.ticket_time_entries;
CREATE TRIGGER ticket_time_entries_sync_bundle_usage
  AFTER INSERT OR UPDATE OF ended_at, duration_minutes, description
  ON public.ticket_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_bundle_usage_from_time_entry();

INSERT INTO public.assistance_bundles (
  name,
  description,
  billing_type,
  fee,
  currency,
  included_hours,
  extra_hourly_rate,
  sla_response_hours,
  sla_resolution_hours,
  included_onsite_visits,
  remote_support,
  ticket_priority,
  auto_renew,
  active
)
SELECT *
FROM (VALUES
  ('Base', 'Pacchetto base per assistenza remota essenziale con un piccolo monte ore annuale.', 'annual', 480.00::numeric, 'EUR', 6.00::numeric, 80.00::numeric, 8.00::numeric, 72.00::numeric, 0::integer, true, 'low', true, true),
  ('Standard', 'Pacchetto standard per PMI con assistenza remota, SLA migliorato e visite onsite incluse.', 'annual', 1200.00::numeric, 'EUR', 20.00::numeric, 70.00::numeric, 4.00::numeric, 48.00::numeric, 2::integer, true, 'med', true, true),
  ('Premium', 'Pacchetto premium con priorità alta, monte ore esteso e interventi onsite inclusi.', 'annual', 2400.00::numeric, 'EUR', 50.00::numeric, 60.00::numeric, 2.00::numeric, 24.00::numeric, 6::integer, true, 'high', true, true),
  ('Enterprise', 'Pacchetto enterprise personalizzato: canone, SLA, ore e visite onsite definiti su misura.', 'annual', 0.00::numeric, 'EUR', NULL::numeric, 0.00::numeric, 1.00::numeric, 8.00::numeric, NULL::integer, true, 'critical', true, true)
) AS seed(name, description, billing_type, fee, currency, included_hours, extra_hourly_rate, sla_response_hours, sla_resolution_hours, included_onsite_visits, remote_support, ticket_priority, auto_renew, active)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.assistance_bundles b
  WHERE lower(b.name) = lower(seed.name)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notifications_type_check'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'ticket_assigned',
        'ticket_status_changed',
        'ticket_completed',
        'ticket_comment',
        'automation_failed',
        'device_status_changed',
        'checklist_completed',
        'checklist_section_assigned',
        'user_invited',
        'mention',
        'maintenance_due_soon',
        'bundle_expiring',
        'bundle_low_hours',
        'bundle_renewed'
      ));
  END IF;
END $$;

COMMENT ON TABLE public.assistance_bundles IS 'Catalogo pacchetti assistenza con canone, ore incluse, SLA e priorità ticket.';
COMMENT ON TABLE public.client_bundle_assignments IS 'Assegnazioni dei pacchetti assistenza ai clienti, con override personalizzati.';
COMMENT ON TABLE public.bundle_usage_entries IS 'Consumi di ore, visite onsite ed extra associati a un pacchetto cliente.';
COMMENT ON TABLE public.bundle_fee_payments IS 'Pagamenti o scadenze canone per pacchetti assistenza cliente.';
COMMENT ON VIEW public.active_client_bundle_assignments IS 'Assegnazioni pacchetto attive con valori effettivi calcolati dagli override cliente.';
COMMENT ON VIEW public.bundle_assignment_usage_summary IS 'Riepilogo consumi e residui per assegnazione pacchetto.';
COMMENT ON VIEW public.bundle_monthly_usage IS 'Aggregazione mensile dei consumi pacchetto.';
COMMENT ON FUNCTION public.get_active_bundle_for_client(uuid) IS 'Restituisce il pacchetto assistenza attivo prioritario per un cliente.';
COMMENT ON FUNCTION public.apply_bundle_to_ticket() IS 'Applica automaticamente pacchetto, priorità, tariffa e SLA al ticket cliente.';
COMMENT ON FUNCTION public.sync_bundle_usage_from_time_entry() IS 'Sincronizza i consumi pacchetto a partire dalle registrazioni tempo ticket.';
