-- Migration: create view activity_log_dedup to deduplicate activity_log by message and second
-- Run this migration in your Supabase project to create the deduplicated view.

CREATE OR REPLACE VIEW public.activity_log_dedup AS
SELECT DISTINCT ON (message, date_trunc('second', al.created_at))
  al.id,
  al.type,
  al.message,
  al.ticket_id,
  al.actor_id,
  al.created_at,
  p.full_name as actor_name,
  p.initials as actor_initials
FROM public.activity_log al
LEFT JOIN public.profiles p ON p.id = al.actor_id
ORDER BY message, date_trunc('second', al.created_at) DESC, al.created_at DESC;
