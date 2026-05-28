-- Cost management for tickets and client assistance contracts.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS billable_hours numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS material_cost numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS cost_notes text;

ALTER TABLE public.tickets
  DROP COLUMN IF EXISTS labor_cost,
  DROP COLUMN IF EXISTS total_cost;

ALTER TABLE public.tickets
  ADD COLUMN labor_cost numeric(12,2) GENERATED ALWAYS AS (round((billable_hours * hourly_rate)::numeric, 2)) STORED,
  ADD COLUMN total_cost numeric(12,2) GENERATED ALWAYS AS (round(((billable_hours * hourly_rate) + material_cost)::numeric, 2)) STORED;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_billable_hours_non_negative CHECK (billable_hours >= 0) NOT VALID,
  ADD CONSTRAINT tickets_hourly_rate_non_negative CHECK (hourly_rate >= 0) NOT VALID,
  ADD CONSTRAINT tickets_material_cost_non_negative CHECK (material_cost >= 0) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_tickets_cost_created_client
  ON public.tickets (created_at, client_id)
  WHERE total_cost IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_cost_assignee
  ON public.tickets (assignee_id, created_at)
  WHERE total_cost IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.client_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Contratto assistenza',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired', 'draft')),
  billing_period text NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'annual')),
  recurring_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (recurring_fee >= 0),
  included_hours numeric(10,2) NOT NULL DEFAULT 0 CHECK (included_hours >= 0),
  extra_hourly_rate numeric(10,2) NOT NULL DEFAULT 0 CHECK (extra_hourly_rate >= 0),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_contracts_client_status
  ON public.client_contracts (client_id, status);

CREATE INDEX IF NOT EXISTS idx_client_contracts_period
  ON public.client_contracts (start_date, end_date);

CREATE OR REPLACE FUNCTION public.touch_client_contracts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_contracts_touch_updated_at ON public.client_contracts;
CREATE TRIGGER client_contracts_touch_updated_at
  BEFORE UPDATE ON public.client_contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_client_contracts_updated_at();

ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team can read client contracts" ON public.client_contracts;
CREATE POLICY "team can read client contracts"
  ON public.client_contracts FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.profiles));

DROP POLICY IF EXISTS "admin and tech can manage client contracts" ON public.client_contracts;
CREATE POLICY "admin and tech can manage client contracts"
  ON public.client_contracts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

CREATE OR REPLACE VIEW public.ticket_cost_summary AS
SELECT
  t.id,
  t.ticket_code,
  t.client_id,
  COALESCE(c.company_name, c.name, t.client) AS client_name,
  t.assignee_id,
  p.full_name AS technician_name,
  t.status,
  t.priority,
  t.ticket_type,
  t.created_at,
  t.completed_at,
  t.billable_hours,
  t.hourly_rate,
  t.material_cost,
  t.labor_cost,
  t.total_cost,
  t.cost_currency,
  t.cost_notes,
  COALESCE(SUM(COALESCE(te.duration_minutes, 0)), 0)::integer AS tracked_minutes
FROM public.tickets t
LEFT JOIN public.clients c ON c.id = t.client_id
LEFT JOIN public.profiles p ON p.id = t.assignee_id
LEFT JOIN public.ticket_time_entries te ON te.ticket_id = t.id
GROUP BY t.id, c.company_name, c.name, p.full_name;

COMMENT ON COLUMN public.tickets.billable_hours IS 'Ore fatturabili del ticket. Il costo manodopera viene calcolato come ore x tariffa.';
COMMENT ON COLUMN public.tickets.hourly_rate IS 'Tariffa oraria applicata al ticket.';
COMMENT ON COLUMN public.tickets.material_cost IS 'Costo materiali, ricambi o costi vivi associati al ticket.';
COMMENT ON COLUMN public.tickets.labor_cost IS 'Costo manodopera calcolato automaticamente.';
COMMENT ON COLUMN public.tickets.total_cost IS 'Costo totale calcolato automaticamente: manodopera + materiali.';
COMMENT ON TABLE public.client_contracts IS 'Contratti di assistenza cliente con canone, ore incluse e tariffa extra.';
COMMENT ON VIEW public.ticket_cost_summary IS 'Vista aggregata per report costi e fatturazione.';
