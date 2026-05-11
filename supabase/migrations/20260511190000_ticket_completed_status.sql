-- Migration: Add support for 'completed' ticket status and ticket completion workflow
-- Created: 2026-05-11

-- Update CHECK constraint on tickets.status to include 'completed'
DO $$
BEGIN
  -- Drop existing constraint if exists (to allow all statuses including new ones)
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'tickets' AND constraint_name = 'tickets_status_check'
  ) THEN
    ALTER TABLE public.tickets DROP CONSTRAINT tickets_status_check;
  END IF;

  -- Add new constraint with all valid statuses including 'completed'
  ALTER TABLE public.tickets
    ADD CONSTRAINT tickets_status_check
    CHECK (status IN ('pending', 'in-progress', 'testing', 'ready', 'completed'));
EXCEPTION
  WHEN others THEN
    -- Constraint might already be updated or not exist, ignore error
    NULL;
END $$;

-- Add notify_ticket_completed preference column to user_profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'notify_ticket_completed'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN notify_ticket_completed boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add index for faster status-based queries
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);

-- Add index for status + client_id combination (portal queries)
CREATE INDEX IF NOT EXISTS idx_tickets_status_client ON public.tickets(status, client_id);

-- Comment for documentation
COMMENT ON COLUMN public.user_profiles.notify_ticket_completed IS 'Whether to send notifications when a ticket is completed';

-- Update CHECK constraint on notifications.type to include 'ticket_completed'
DO $$
BEGIN
  -- Drop existing constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'notifications' AND constraint_name = 'notifications_type_check'
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
  END IF;

  -- Add new constraint with all valid notification types including 'ticket_completed'
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('ticket_assigned', 'ticket_status_changed', 'ticket_comment', 'automation_failed', 'device_status_changed', 'checklist_completed', 'user_invited', 'mention', 'ticket_completed'));
EXCEPTION
  WHEN others THEN
    -- Constraint might already be updated or not exist, ignore error
    NULL;
END $$;
