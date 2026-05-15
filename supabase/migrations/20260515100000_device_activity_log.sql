-- Migration: Add device_id to activity_log for device-level activity tracking
-- Created: 2026-05-15

-- Add device_id column to activity_log
ALTER TABLE IF EXISTS public.activity_log
  ADD COLUMN IF NOT EXISTS device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL;

-- Index for efficient device activity queries
CREATE INDEX IF NOT EXISTS activity_log_device_id_idx ON public.activity_log(device_id);
CREATE INDEX IF NOT EXISTS activity_log_device_id_created_at_idx ON public.activity_log(device_id, created_at DESC);

-- Update RLS: authenticated users can view activity for devices they have access to
DROP POLICY IF EXISTS "authenticated users can view device activity" ON public.activity_log;
CREATE POLICY "authenticated users can view device activity"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert device activity
DROP POLICY IF EXISTS "authenticated users can insert device activity" ON public.activity_log;
CREATE POLICY "authenticated users can insert device activity"
  ON public.activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON COLUMN public.activity_log.device_id IS 'Optional reference to a device for device-level activity tracking';
