-- Idempotent patch to fix types, policies and activity_log FK
-- Safe to run multiple times

-- Ensure enums exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'tech', 'viewer');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
    CREATE TYPE public.ticket_status AS ENUM ('pending', 'in-progress', 'testing', 'ready');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority') THEN
    CREATE TYPE public.ticket_priority AS ENUM ('high', 'med', 'low');
  END IF;
END$$;

-- Ensure profiles table exists (no-op if already present)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  initials TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure activity_log.actor_id FK points to public.profiles(id)
ALTER TABLE public.activity_log
  DROP CONSTRAINT IF EXISTS activity_log_actor_id_fkey;

ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Ensure Row Level Security is enabled on activity_log (no-op if already enabled)
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Ensure policies exist for activity_log (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'All authed read log' AND schemaname = 'public' AND tablename = 'activity_log'
  ) THEN
    CREATE POLICY "All authed read log" ON public.activity_log FOR SELECT TO authenticated USING (true);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authed insert log' AND schemaname = 'public' AND tablename = 'activity_log'
  ) THEN
    CREATE POLICY "Authed insert log" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END$$;
