alter table public.user_profiles
  add column if not exists email_notify_ticket_assigned boolean default true,
  add column if not exists email_notify_ticket_status_changed boolean default true,
  add column if not exists email_notify_ticket_completed boolean default true,
  add column if not exists email_notify_automation_failed boolean default true,
  add column if not exists email_notify_device_status_changed boolean default true,
  add column if not exists email_notify_checklist_completed boolean default true,
  add column if not exists email_notify_mentions boolean default true,
  add column if not exists notification_digest text default 'immediate',
  add column if not exists webhook_url text,
  add column if not exists push_subscription jsonb,
  add column if not exists last_notification_sent_at timestamptz;

update public.user_profiles
set
  email_notify_ticket_assigned = coalesce(email_notify_ticket_assigned, true),
  email_notify_ticket_status_changed = coalesce(email_notify_ticket_status_changed, true),
  email_notify_ticket_completed = coalesce(email_notify_ticket_completed, true),
  email_notify_automation_failed = coalesce(email_notify_automation_failed, true),
  email_notify_device_status_changed = coalesce(email_notify_device_status_changed, true),
  email_notify_checklist_completed = coalesce(email_notify_checklist_completed, true),
  email_notify_mentions = coalesce(email_notify_mentions, true),
  notification_digest = coalesce(notification_digest, 'immediate')
where email_notify_ticket_assigned is null
   or email_notify_ticket_status_changed is null
   or email_notify_ticket_completed is null
   or email_notify_automation_failed is null
   or email_notify_device_status_changed is null
   or email_notify_checklist_completed is null
   or email_notify_mentions is null
   or notification_digest is null;
