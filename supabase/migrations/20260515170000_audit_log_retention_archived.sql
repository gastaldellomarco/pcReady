-- Migration: add log retention settings and archived logs table

-- Add log_retention_days to app_settings (default 365)
INSERT INTO public.app_settings (key, value, updated_by)
VALUES ('log_retention_days', '365', NULL)
ON CONFLICT (key) DO NOTHING;

-- Create archived_logs table for future archive storage
CREATE TABLE IF NOT EXISTS public.archived_logs (
  id uuid PRIMARY KEY,
  type text NOT NULL,
  action_type text,
  entity_type text,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  severity text DEFAULT 'info',
  session_id text,
  message text NOT NULL,
  ticket_id uuid,
  actor_id uuid,
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_reason text DEFAULT 'retention'
);

-- Index for efficient querying of archived logs
CREATE INDEX IF NOT EXISTS idx_archived_logs_created_at ON public.archived_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_logs_archived_at ON public.archived_logs (archived_at DESC);

-- Enable RLS on archived_logs
ALTER TABLE public.archived_logs ENABLE ROW LEVEL SECURITY;

-- Policy: only admins can read archived logs
CREATE POLICY "Admins can read archived logs"
  ON public.archived_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
