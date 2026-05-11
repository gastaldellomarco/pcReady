-- Migration: Add `completed_at` column to tickets
-- Created: 2026-05-11

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tickets' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE public.tickets
      ADD COLUMN completed_at timestamptz NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- ignore errors to keep migration idempotent
  NULL;
END $$;

-- Create index for completed_at for efficient archiving queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'i' AND c.relname = 'idx_tickets_completed_at'
  ) THEN
    CREATE INDEX idx_tickets_completed_at ON public.tickets(completed_at) WHERE completed_at IS NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
