-- ============================================================================
-- Migration: Add UNIQUE constraints for idempotent seed re-execution
-- Created: 2026-06-03
-- 
-- Aggiunge UNIQUE constraints a tabelle che ne sono prive, per permettere
-- al seed di usare ON CONFLICT DO NOTHING in modo efficace.
-- Le tabelle con PK uuid random e senza UNIQUE constraint creano duplicati
-- a ogni riesecuzione del seed.
-- ============================================================================

-- 1. client_tags — univoco per nome
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'client_tags_name_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX client_tags_name_unique_idx
      ON public.client_tags (lower(name));
  END IF;
END $$;

-- 2. client_tag_assignments — univoco per (client_id, tag_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_tag_assignments_unique'
      AND conrelid = 'public.client_tag_assignments'::regclass
  ) THEN
    ALTER TABLE public.client_tag_assignments
      ADD CONSTRAINT client_tag_assignments_unique
      UNIQUE (client_id, tag_id);
  END IF;
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- 3. checklist_templates — univoco per nome (case-insensitive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'checklist_templates_name_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX checklist_templates_name_unique_idx
      ON public.checklist_templates (lower(name));
  END IF;
END $$;

-- 4. scripts — univoco per nome (case-insensitive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'scripts_name_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX scripts_name_unique_idx
      ON public.scripts (lower(name));
  END IF;
END $$;

-- 5. automation_rules — univoco per trigger_text
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'automation_rules_trigger_text_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX automation_rules_trigger_text_unique_idx
      ON public.automation_rules (trigger_text);
  END IF;
END $$;

-- 6. client_contracts — univoco per (client_id, name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'client_contracts_client_name_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX client_contracts_client_name_unique_idx
      ON public.client_contracts (client_id, name);
  END IF;
END $$;

-- 7. maintenance_schedules — univoco per (device_id, title)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'maintenance_schedules_device_title_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX maintenance_schedules_device_title_unique_idx
      ON public.maintenance_schedules (device_id, title);
  END IF;
END $$;

-- 8. bundle_fee_payments — univoco per (client_bundle_assignment_id, period_start)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'bundle_fee_payments_assignment_period_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX bundle_fee_payments_assignment_period_unique_idx
      ON public.bundle_fee_payments (client_bundle_assignment_id, period_start);
  END IF;
END $$;

-- 9. client_bundle_assignments — univoco per (client_id, bundle_id, start_date)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'client_bundle_assignments_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX client_bundle_assignments_unique_idx
      ON public.client_bundle_assignments (client_id, bundle_id, start_date);
  END IF;
END $$;

-- 10. audit_presets — univoco per (name, user_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'audit_presets_name_user_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX audit_presets_name_user_unique_idx
      ON public.audit_presets (name, user_id);
  END IF;
END $$;

-- 11. client_budgets — univoco per (client_id, period, starts_on)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'client_budgets_client_period_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX client_budgets_client_period_unique_idx
      ON public.client_budgets (client_id, period, starts_on);
  END IF;
END $$;

-- 12. cost_periodic_reports — univoco per (client_id, report_month)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'cost_periodic_reports_client_month_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX cost_periodic_reports_client_month_unique_idx
      ON public.cost_periodic_reports (client_id, report_month);
  END IF;
END $$;

-- 13. client_contract_alerts — univoco per (client_id, bundle_assignment_id, channel)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'client_contract_alerts_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX client_contract_alerts_unique_idx
      ON public.client_contract_alerts (client_id, bundle_assignment_id, channel);
  END IF;
END $$;

-- 14. activity_log — univoco per (type, message, ticket_id, created_at)
-- Previene duplicati da seed ma non interferisce con log di produzione (timestamp unici)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'activity_log_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX activity_log_unique_idx
      ON public.activity_log (type, message, COALESCE(ticket_id::text, ''), created_at);
  END IF;
END $$;

-- 15. notifications — univoco per (user_id, type, title, body, created_at)
-- Le notifiche generate dal seed hanno tutti i campi identici; in produzione
-- due notifiche identiche allo stesso microsecondo sono virtualmente impossibili.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'notifications_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX notifications_unique_idx
      ON public.notifications (user_id, type, title, COALESCE(body, ''), created_at);
  END IF;
END $$;

-- 16. ticket_notes — univoco per (ticket_id, author_id, content, created_at)
-- Due note identiche sullo stesso ticket con stesso autore allo stesso istante
-- possono solo provenire da una riesecuzione del seed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'ticket_notes_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX ticket_notes_unique_idx
      ON public.ticket_notes (ticket_id, author_id, content, created_at);
  END IF;
END $$;

-- 17. ticket_time_entries — univoco per (ticket_id, user_id, started_at)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'ticket_time_entries_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX ticket_time_entries_unique_idx
      ON public.ticket_time_entries (ticket_id, user_id, started_at);
  END IF;
END $$;
