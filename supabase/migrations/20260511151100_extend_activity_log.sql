ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS old_value JSONB,
  ADD COLUMN IF NOT EXISTS new_value JSONB,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS session_id TEXT;

UPDATE public.activity_log
SET severity = 'info'
WHERE severity IS NULL;

ALTER TABLE public.activity_log
  DROP CONSTRAINT IF EXISTS activity_log_severity_check;

ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_severity_check
  CHECK (severity IN ('info', 'warning', 'critical'));

CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON public.activity_log (action_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_severity ON public.activity_log (severity);
CREATE INDEX IF NOT EXISTS idx_activity_log_session_id ON public.activity_log (session_id);
