-- Migration: update activity_log_dedup view to include extended columns
-- This view deduplicates activity_log by message and second, now including action_type,
-- entity_type, entity_id, old_value, new_value, ip_address, severity, session_id.

DROP VIEW IF EXISTS public.activity_log_dedup CASCADE;

CREATE OR REPLACE VIEW public.activity_log_dedup AS
SELECT DISTINCT ON (message, date_trunc('second', al.created_at))
  al.id,
  al.type,
  al.action_type,
  al.entity_type,
  al.entity_id,
  al.old_value,
  al.new_value,
  al.ip_address,
  al.severity,
  al.session_id,
  al.message,
  al.ticket_id,
  al.actor_id,
  al.created_at,
  p.full_name as actor_name,
  p.initials as actor_initials
FROM public.activity_log al
LEFT JOIN public.profiles p ON p.id = al.actor_id
ORDER BY message, date_trunc('second', al.created_at) DESC, al.created_at DESC;
