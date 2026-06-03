-- Harden remaining views with nullable label columns.
-- Applies the same COALESCE fallback pattern used in ticket_cost_summary
-- and client_budget_usage_summary to guarantee non-null display labels.

-- 1. active_client_bundle_assignments: add 'Cliente non assegnato' fallback
DROP VIEW IF EXISTS public.active_client_bundle_assignments CASCADE;

CREATE OR REPLACE VIEW public.active_client_bundle_assignments AS
SELECT
  a.id,
  a.client_id,
  COALESCE(c.company_name, c.name, 'Cliente non assegnato') AS client_name,
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

-- 2. bundle_assignment_usage_summary: replace raw c.name with COALESCE
DROP VIEW IF EXISTS public.bundle_assignment_usage_summary;

CREATE VIEW public.bundle_assignment_usage_summary AS
WITH usage_totals AS (
  SELECT
    client_bundle_assignment_id,
    COALESCE(SUM(used_hours), 0)::numeric(10,2) AS used_hours,
    COALESCE(SUM(onsite_visits), 0)::integer AS onsite_visits,
    COALESCE(SUM(extra_hours), 0)::numeric(10,2) AS extra_hours,
    COALESCE(SUM(extra_amount), 0)::numeric(12,2) AS extra_amount
  FROM public.bundle_usage_entries
  GROUP BY client_bundle_assignment_id
)
SELECT
  a.id AS client_bundle_assignment_id,
  a.id AS assignment_id,
  a.client_id,
  a.bundle_id,
  a.status,
  a.start_date,
  a.end_date,
  COALESCE(a.custom_fee, b.fee) AS effective_fee,
  COALESCE(a.custom_included_hours, b.included_hours) AS effective_included_hours,
  COALESCE(a.custom_extra_hourly_rate, b.extra_hourly_rate) AS effective_extra_hourly_rate,
  COALESCE(a.custom_sla_response_hours, b.sla_response_hours) AS effective_sla_response_hours,
  COALESCE(a.custom_sla_resolution_hours, b.sla_resolution_hours) AS effective_sla_resolution_hours,
  COALESCE(a.custom_included_onsite_visits, b.included_onsite_visits) AS effective_included_onsite_visits,
  COALESCE(ut.used_hours, 0)::numeric(10,2) AS used_hours,
  COALESCE(ut.extra_hours, 0)::numeric(10,2) AS extra_hours,
  CASE
    WHEN COALESCE(a.custom_included_hours, b.included_hours) IS NULL THEN NULL
    ELSE GREATEST(COALESCE(a.custom_included_hours, b.included_hours) - COALESCE(ut.used_hours, 0), 0)::numeric(10,2)
  END AS remaining_hours,
  COALESCE(ut.onsite_visits, 0)::integer AS onsite_visits,
  COALESCE(ut.onsite_visits, 0)::integer AS used_onsite_visits,
  CASE
    WHEN COALESCE(a.custom_included_onsite_visits, b.included_onsite_visits) IS NULL THEN NULL
    ELSE GREATEST(COALESCE(a.custom_included_onsite_visits, b.included_onsite_visits) - COALESCE(ut.onsite_visits, 0), 0)::integer
  END AS remaining_onsite_visits,
  COALESCE(ut.extra_amount, 0)::numeric(12,2) AS extra_amount,
  CASE
    WHEN COALESCE(a.custom_included_hours, b.included_hours) IS NULL OR COALESCE(a.custom_included_hours, b.included_hours) = 0 THEN NULL
    ELSE round((COALESCE(ut.used_hours, 0) / COALESCE(a.custom_included_hours, b.included_hours)) * 100, 2)
  END AS usage_percent,
  b.currency,
  b.name AS bundle_name,
  COALESCE(c.company_name, c.name, 'Cliente non assegnato') AS client_name,
  c.company_name
FROM public.client_bundle_assignments a
JOIN public.assistance_bundles b ON b.id = a.bundle_id
JOIN public.clients c ON c.id = a.client_id
LEFT JOIN usage_totals ut ON ut.client_bundle_assignment_id = a.id;

-- 3. activity_log_dedup: add fallback for actor_name
DROP VIEW IF EXISTS public.activity_log_dedup CASCADE;

CREATE OR REPLACE VIEW public.activity_log_dedup AS
SELECT DISTINCT ON (message, date_trunc('second', al.created_at))
  al.id,
  al.type,
  al.action_type,
  al.entity_type,
  al.entity_id,
  al.old_value,
  al.new_value,
  al.ip_address,
  al.severity,
  al.session_id,
  al.message,
  al.ticket_id,
  al.actor_id,
  al.created_at,
  COALESCE(NULLIF(p.full_name, ''), 'Sistema') AS actor_name,
  COALESCE(NULLIF(p.initials, ''), '?') AS actor_initials
FROM public.activity_log al
LEFT JOIN public.profiles p ON p.id = al.actor_id
ORDER BY message, date_trunc('second', al.created_at) DESC, al.created_at DESC;

COMMENT ON VIEW public.active_client_bundle_assignments IS 'Assegnazioni pacchetto attive con valori effettivi calcolati dagli override cliente. client_name garantito non nullo.';
COMMENT ON VIEW public.bundle_assignment_usage_summary IS 'Riepilogo consumi e residui per assegnazione pacchetto con metadati cliente/bundle. client_name garantito non nullo.';
COMMENT ON VIEW public.activity_log_dedup IS 'Log attivita deduplicato con actor_name garantito non nullo.';
