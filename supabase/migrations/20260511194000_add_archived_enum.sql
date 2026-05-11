-- Migration: Add 'archived' to ticket_status enum if missing
-- Created: 2026-05-11

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ticket_status' AND e.enumlabel = 'archived'
  ) THEN
    ALTER TYPE public.ticket_status ADD VALUE 'archived';
  END IF;
EXCEPTION
  WHEN others THEN
    -- If the enum or value already exists or another error occurs, ignore to keep migration idempotent
    NULL;
END $$;
