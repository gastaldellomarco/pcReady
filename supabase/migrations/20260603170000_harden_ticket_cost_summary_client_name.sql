-- Harden ticket_cost_summary and client_budget_usage_summary views so that
-- client_name is never NULL.  When a ticket has no linked client (client_id IS NULL)
-- or the linked client has both company_name and name NULL, the previous COALESCE
-- chain could still produce NULL.  This migration adds a final fallback string
-- 'Cliente non assegnato' at the database level so charts, reports and exports
-- never show blank labels.

DROP VIEW IF EXISTS public.client_budget_usage_summary CASCADE;
DROP VIEW IF EXISTS public.ticket_cost_summary CASCADE;

CREATE OR REPLACE VIEW public.ticket_cost_summary AS
SELECT
  t.id,
  t.ticket_code,
  t.client_id,
  COALESCE(c.company_name, c.name, t.client, 'Cliente non assegnato') AS client_name,
  t.assignee_id,
  COALESCE(p.full_name, 'Non assegnato') AS technician_name,
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
  COALESCE(c.company_name, c.name, 'Cliente non assegnato') AS client_name,
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

COMMENT ON VIEW public.ticket_cost_summary IS 'Aggregated ticket cost view with guaranteed non-null client_name and technician_name for chart/report safety.';
