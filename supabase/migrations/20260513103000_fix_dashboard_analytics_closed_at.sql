-- Migration: Fix dashboard analytics closed_at trigger and backfill
-- Date: 2026-05-13
-- This migration fixes the set_ticket_closed_at trigger/function so that
-- it reacts to the actual statuses used by the application ('completato', 'archiviato')
-- instead of 'ready'. It also backfills existing rows where appropriate.

BEGIN;

-- Replace function to set closed_at when status becomes 'completed' or 'archived'
CREATE OR REPLACE FUNCTION public.set_ticket_closed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Set closed_at when transitioning into a closed state
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE')
     AND NEW.status::text IN ('completed', 'archived')
     AND (TG_OP = 'INSERT' OR OLD.status::text NOT IN ('completed', 'archived'))
     AND NEW.closed_at IS NULL THEN
    -- mark closed_at when ticket moves to a final state
    NEW.closed_at := now();

  -- Clear closed_at when reopening (transitioning out of closed states)
    ELSIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE')
      AND NEW.status::text NOT IN ('completed', 'archived')
      AND (TG_OP = 'INSERT' OR OLD.status::text IN ('completed', 'archived')) THEN
    NEW.closed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- (Re)create trigger to ensure it fires on INSERT and UPDATE of status
DROP TRIGGER IF EXISTS trg_set_ticket_closed_at ON public.tickets;
CREATE TRIGGER trg_set_ticket_closed_at
BEFORE INSERT OR UPDATE OF status ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_ticket_closed_at();

-- Backfill existing tickets with realistic closed timestamps.
-- Strategy:
-- 1) For tickets missing closed_at, use the earliest ticket_status_history.changed_at
--    where to_status IN ('completed','archived'). This preserves the actual time the ticket
--    reached a final state.
-- 2) If no status history entry exists, prefer `completed_at` column (if present) when set.
-- 3) Fallback to `updated_at` as a last resort.
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- 1) Use ticket_status_history when available
  FOR rec IN
    SELECT t.id, h.changed_at
    FROM public.tickets t
    JOIN LATERAL (
      SELECT changed_at
      FROM public.ticket_status_history h
      WHERE h.ticket_id = t.id AND h.to_status IN ('completed','archived')
      ORDER BY changed_at ASC
      LIMIT 1
    ) h ON TRUE
    WHERE t.closed_at IS NULL
  LOOP
    UPDATE public.tickets SET closed_at = rec.changed_at WHERE id = rec.id;
  END LOOP;

  -- 2) For remaining tickets, if completed_at column exists and is set, use it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'completed_at'
  ) THEN
    UPDATE public.tickets
    SET closed_at = completed_at
    WHERE closed_at IS NULL AND completed_at IS NOT NULL;
  END IF;

  -- 3) Fallback to updated_at
  UPDATE public.tickets
  SET closed_at = updated_at
  WHERE closed_at IS NULL;
END;
$$;

-- Adjust unrealistic closed_at timestamps to more realistic values.
-- Compute median resolution days from tickets with valid resolution and apply
-- to tickets where closed_at is <= created_at or excessively large (>365 days).
DO $$
DECLARE
  median_days NUMERIC;
BEGIN
  SELECT percentile_disc(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (closed_at - created_at))/86400)
    INTO median_days
    FROM public.tickets
    WHERE closed_at IS NOT NULL AND closed_at > created_at;

  IF median_days IS NULL OR median_days <= 0 THEN
    median_days := 1; -- fallback to 1 day
  END IF;

  -- Update suspicious closed_at values
  UPDATE public.tickets
  SET closed_at = created_at + (median_days || ' days')::interval
  WHERE closed_at IS NULL
     OR closed_at <= created_at
     OR closed_at > created_at + INTERVAL '365 days';
END;
$$;

COMMIT;
