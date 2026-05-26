-- Enhance bundle_assignment_usage_summary with assignment metadata, client/bundle info,
-- and effective (override-aware) columns so the frontend USAGE_SUMMARY_SELECT works.
-- Original view only exposed aggregate data; the frontend expects 24 columns.
-- DROP first: CREATE OR REPLACE can't rename/reorder columns.

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
  c.name AS client_name,
  c.company_name
FROM public.client_bundle_assignments a
JOIN public.assistance_bundles b ON b.id = a.bundle_id
JOIN public.clients c ON c.id = a.client_id
LEFT JOIN usage_totals ut ON ut.client_bundle_assignment_id = a.id;

COMMENT ON VIEW public.bundle_assignment_usage_summary IS 'Riepilogo consumi e residui per assegnazione pacchetto con metadati cliente/bundle (catalogo e override).';
