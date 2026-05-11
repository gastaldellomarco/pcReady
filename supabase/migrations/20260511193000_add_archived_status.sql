-- Migration: Add 'archived' ticket status and nightly archiving job
-- Created: 2026-05-11

-- Update CHECK constraint on tickets.status to include 'archived'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'tickets' AND constraint_name = 'tickets_status_check'
  ) THEN
    ALTER TABLE public.tickets DROP CONSTRAINT tickets_status_check;
  END IF;

  ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_status_check
    CHECK (status IN ('pending', 'in-progress', 'testing', 'ready', 'completed', 'archived'));
EXCEPTION
  WHEN others THEN
    NULL;
END $$;

-- Create index for fast status queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);

-- Create helper function to archive completed tickets older than configured days
CREATE OR REPLACE FUNCTION public.archive_completed_tickets()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  cfg jsonb;
  days integer := 7;
BEGIN
  -- try to read archive_after_days from app_settings
  BEGIN
    SELECT value::jsonb INTO cfg FROM public.app_settings WHERE key = 'archive_after_days' LIMIT 1;
    IF cfg IS NOT NULL THEN
      days := (cfg #>> '{}')::integer;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    days := 7;
  END;

  UPDATE public.tickets
  SET status = 'archived'
  WHERE status = 'completed'
    AND completed_at IS NOT NULL
    AND completed_at < now() - (days || ' days')::interval;
END;
$$;

-- Schedule nightly job via pg_cron if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('archive-completed-tickets', '0 2 * * *', 'SELECT public.archive_completed_tickets();');
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- ignore if pg_cron not available or job exists
  NULL;
END $$;
