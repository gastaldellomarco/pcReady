-- Add descriptive metadata to automation rules
ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Generale',
  ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
