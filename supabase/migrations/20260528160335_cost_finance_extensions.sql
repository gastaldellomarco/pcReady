-- Finance extensions for /costs: invoices, quotes, material rows, budgets,
-- payment reconciliation and scheduled client reports.

CREATE TABLE IF NOT EXISTS public.cost_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'void')),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  period_start date,
  period_end date,
  currency text NOT NULL DEFAULT 'EUR',
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 22 CHECK (tax_rate >= 0),
  tax_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  logo_url text,
  sender_name text,
  sender_address text,
  recipient_name text,
  recipient_address text,
  notes text,
  accounting_export_format text CHECK (accounting_export_format IS NULL OR accounting_export_format IN ('fatture_in_cloud_csv', 'fattura_pa_xml')),
  accounting_exported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cost_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.cost_invoices(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total numeric(12,2) GENERATED ALWAYS AS (round((quantity * unit_price)::numeric, 2)) STORED,
  item_type text NOT NULL DEFAULT 'service' CHECK (item_type IN ('service', 'labor', 'material', 'contract', 'extra')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cost_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  quote_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected', 'converted', 'expired')),
  title text NOT NULL DEFAULT 'Preventivo extra-contratto',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  currency text NOT NULL DEFAULT 'EUR',
  subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 22 CHECK (tax_rate >= 0),
  tax_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  approved_at timestamptz,
  approved_by text,
  converted_ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cost_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.cost_quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  line_total numeric(12,2) GENERATED ALWAYS AS (round((quantity * unit_price)::numeric, 2)) STORED,
  item_type text NOT NULL DEFAULT 'service' CHECK (item_type IN ('service', 'labor', 'material', 'extra')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ticket_material_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  description text NOT NULL,
  supplier text,
  sku text,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  resale_margin_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (resale_margin_percent >= 0),
  unit_price numeric(12,2) GENERATED ALWAYS AS (round((unit_cost * (1 + resale_margin_percent / 100))::numeric, 2)) STORED,
  total_cost numeric(12,2) GENERATED ALWAYS AS (round((quantity * unit_cost)::numeric, 2)) STORED,
  total_price numeric(12,2) GENERATED ALWAYS AS (round((quantity * unit_cost * (1 + resale_margin_percent / 100))::numeric, 2)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  period text NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'annual')),
  budget_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (budget_amount >= 0),
  alert_threshold_percent numeric(5,2) NOT NULL DEFAULT 80 CHECK (alert_threshold_percent > 0 AND alert_threshold_percent <= 100),
  starts_on date NOT NULL DEFAULT CURRENT_DATE,
  ends_on date,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, period, starts_on)
);

CREATE TABLE IF NOT EXISTS public.cost_periodic_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  report_month date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'generated', 'sent', 'failed')),
  email_to text,
  generated_pdf_path text,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, report_month)
);

CREATE INDEX IF NOT EXISTS cost_invoices_client_status_idx
  ON public.cost_invoices (client_id, status, due_date);
CREATE INDEX IF NOT EXISTS cost_invoice_items_invoice_idx
  ON public.cost_invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS cost_quotes_client_status_idx
  ON public.cost_quotes (client_id, status, valid_until);
CREATE INDEX IF NOT EXISTS ticket_material_items_ticket_idx
  ON public.ticket_material_items (ticket_id);
CREATE INDEX IF NOT EXISTS client_budgets_active_client_idx
  ON public.client_budgets (client_id, active, period);
CREATE INDEX IF NOT EXISTS cost_periodic_reports_client_month_idx
  ON public.cost_periodic_reports (client_id, report_month DESC);

DROP TRIGGER IF EXISTS cost_invoices_touch_updated_at ON public.cost_invoices;
CREATE TRIGGER cost_invoices_touch_updated_at
  BEFORE UPDATE ON public.cost_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_client_contracts_updated_at();

DROP TRIGGER IF EXISTS cost_quotes_touch_updated_at ON public.cost_quotes;
CREATE TRIGGER cost_quotes_touch_updated_at
  BEFORE UPDATE ON public.cost_quotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_client_contracts_updated_at();

DROP TRIGGER IF EXISTS ticket_material_items_touch_updated_at ON public.ticket_material_items;
CREATE TRIGGER ticket_material_items_touch_updated_at
  BEFORE UPDATE ON public.ticket_material_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_client_contracts_updated_at();

DROP TRIGGER IF EXISTS client_budgets_touch_updated_at ON public.client_budgets;
CREATE TRIGGER client_budgets_touch_updated_at
  BEFORE UPDATE ON public.client_budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_client_contracts_updated_at();

DROP TRIGGER IF EXISTS cost_periodic_reports_touch_updated_at ON public.cost_periodic_reports;
CREATE TRIGGER cost_periodic_reports_touch_updated_at
  BEFORE UPDATE ON public.cost_periodic_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_client_contracts_updated_at();

ALTER TABLE public.cost_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_material_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_periodic_reports ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.cost_invoices,
  public.cost_invoice_items,
  public.cost_quotes,
  public.cost_quote_items,
  public.ticket_material_items,
  public.client_budgets,
  public.cost_periodic_reports
TO authenticated;

DROP POLICY IF EXISTS "team can read cost invoices" ON public.cost_invoices;
CREATE POLICY "team can read cost invoices" ON public.cost_invoices
  FOR SELECT TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles));
DROP POLICY IF EXISTS "admin and tech can manage cost invoices" ON public.cost_invoices;
CREATE POLICY "admin and tech can manage cost invoices" ON public.cost_invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "team can read cost invoice items" ON public.cost_invoice_items;
CREATE POLICY "team can read cost invoice items" ON public.cost_invoice_items
  FOR SELECT TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles));
DROP POLICY IF EXISTS "admin and tech can manage cost invoice items" ON public.cost_invoice_items;
CREATE POLICY "admin and tech can manage cost invoice items" ON public.cost_invoice_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "team can read cost quotes" ON public.cost_quotes;
CREATE POLICY "team can read cost quotes" ON public.cost_quotes
  FOR SELECT TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles));
DROP POLICY IF EXISTS "admin and tech can manage cost quotes" ON public.cost_quotes;
CREATE POLICY "admin and tech can manage cost quotes" ON public.cost_quotes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "team can read cost quote items" ON public.cost_quote_items;
CREATE POLICY "team can read cost quote items" ON public.cost_quote_items
  FOR SELECT TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles));
DROP POLICY IF EXISTS "admin and tech can manage cost quote items" ON public.cost_quote_items;
CREATE POLICY "admin and tech can manage cost quote items" ON public.cost_quote_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "team can read ticket material items" ON public.ticket_material_items;
CREATE POLICY "team can read ticket material items" ON public.ticket_material_items
  FOR SELECT TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles));
DROP POLICY IF EXISTS "admin and tech can manage ticket material items" ON public.ticket_material_items;
CREATE POLICY "admin and tech can manage ticket material items" ON public.ticket_material_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "team can read client budgets" ON public.client_budgets;
CREATE POLICY "team can read client budgets" ON public.client_budgets
  FOR SELECT TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles));
DROP POLICY IF EXISTS "admin and tech can manage client budgets" ON public.client_budgets;
CREATE POLICY "admin and tech can manage client budgets" ON public.client_budgets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));

DROP POLICY IF EXISTS "team can read cost periodic reports" ON public.cost_periodic_reports;
CREATE POLICY "team can read cost periodic reports" ON public.cost_periodic_reports
  FOR SELECT TO authenticated USING (auth.uid() IN (SELECT id FROM public.profiles));
DROP POLICY IF EXISTS "admin and tech can manage cost periodic reports" ON public.cost_periodic_reports;
CREATE POLICY "admin and tech can manage cost periodic reports" ON public.cost_periodic_reports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
-- Ensure dependent views are dropped first so we can change column types safely
DROP VIEW IF EXISTS public.client_budget_usage_summary CASCADE;
DROP VIEW IF EXISTS public.ticket_cost_summary CASCADE;
DROP VIEW IF EXISTS public.ticket_material_summary CASCADE;

/* Recreate views with the desired numeric(12,2) precision for aggregated costs. */

CREATE OR REPLACE VIEW public.ticket_material_summary AS
SELECT
  ticket_id,
  COALESCE(SUM(total_cost), 0)::numeric(12,2) AS material_cost,
  COALESCE(SUM(total_price), 0)::numeric(12,2) AS material_revenue,
  COALESCE(SUM(total_price - total_cost), 0)::numeric(12,2) AS material_margin,
  COUNT(*)::integer AS material_items_count
FROM public.ticket_material_items
GROUP BY ticket_id;

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
  (COALESCE(t.material_cost, 0) + COALESCE(ms.material_cost, 0))::numeric(12,2) AS material_cost,
  t.labor_cost,
  (COALESCE(t.labor_cost, 0) + COALESCE(t.material_cost, 0) + COALESCE(ms.material_cost, 0))::numeric(12,2) AS total_cost,
  t.cost_currency,
  t.cost_notes,
  COALESCE(ms.material_revenue, 0)::numeric(12,2) AS material_revenue,
  COALESCE(ms.material_margin, 0)::numeric(12,2) AS material_margin,
  COALESCE(ms.material_items_count, 0)::integer AS material_items_count,
  COALESCE(SUM(COALESCE(te.duration_minutes, 0)), 0)::integer AS tracked_minutes
FROM public.tickets t
LEFT JOIN public.clients c ON c.id = t.client_id
LEFT JOIN public.profiles p ON p.id = t.assignee_id
LEFT JOIN public.ticket_time_entries te ON te.ticket_id = t.id
LEFT JOIN public.ticket_material_summary ms ON ms.ticket_id = t.id
GROUP BY t.id, c.company_name, c.name, p.full_name, ms.material_cost, ms.material_revenue, ms.material_margin, ms.material_items_count;

CREATE OR REPLACE VIEW public.client_budget_usage_summary AS
SELECT
  b.id AS budget_id,
  b.client_id,
  COALESCE(c.company_name, c.name) AS client_name,
  b.period,
  b.budget_amount,
  b.alert_threshold_percent,
  b.starts_on,
  b.ends_on,
  b.active,
  COALESCE(SUM(tcs.total_cost), 0)::numeric(12,2) AS used_amount,
  CASE WHEN b.budget_amount > 0
    THEN round((COALESCE(SUM(tcs.total_cost), 0) / b.budget_amount * 100)::numeric, 2)
    ELSE 0
  END AS used_percent,
  CASE WHEN b.budget_amount > 0
    THEN COALESCE(SUM(tcs.total_cost), 0) >= (b.budget_amount * b.alert_threshold_percent / 100)
    ELSE false
  END AS alert_active
FROM public.client_budgets b
JOIN public.clients c ON c.id = b.client_id
LEFT JOIN public.ticket_cost_summary tcs
  ON tcs.client_id = b.client_id
  AND tcs.created_at::date >= b.starts_on
  AND (b.ends_on IS NULL OR tcs.created_at::date <= b.ends_on)
GROUP BY b.id, c.company_name, c.name;

COMMENT ON TABLE public.cost_invoices IS 'Customer invoices generated from /costs, including payment reconciliation fields.';
COMMENT ON TABLE public.cost_quotes IS 'Quotes for extra-contract work, approvable and convertible to tickets.';
COMMENT ON TABLE public.ticket_material_items IS 'Material and spare-part line items attached to tickets, with supplier and resale margin.';
COMMENT ON TABLE public.client_budgets IS 'Monthly or annual client budget thresholds used by /costs alerts.';
COMMENT ON TABLE public.cost_periodic_reports IS 'Monthly report jobs for active clients; generation/sending is handled by the application layer.';
