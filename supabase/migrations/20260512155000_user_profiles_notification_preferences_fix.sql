alter table public.user_profiles
  add column if not exists notify_ticket_assigned boolean default true,
  add column if not exists notify_ticket_status_changed boolean default true,
  add column if not exists notify_automation_failed boolean default true,
  add column if not exists notify_device_status_changed boolean default true,
  add column if not exists notify_checklist_completed boolean default true,
  add column if not exists notify_mentions boolean default true,
  add column if not exists notify_ticket_completed boolean default true;

update public.user_profiles
set
  notify_ticket_assigned = coalesce(notify_ticket_assigned, true),
  notify_ticket_status_changed = coalesce(notify_ticket_status_changed, true),
  notify_automation_failed = coalesce(notify_automation_failed, true),
  notify_device_status_changed = coalesce(notify_device_status_changed, true),
  notify_checklist_completed = coalesce(notify_checklist_completed, true),
  notify_mentions = coalesce(notify_mentions, true),
  notify_ticket_completed = coalesce(notify_ticket_completed, true)
where notify_ticket_assigned is null
   or notify_ticket_status_changed is null
   or notify_automation_failed is null
   or notify_device_status_changed is null
   or notify_checklist_completed is null
   or notify_mentions is null
   or notify_ticket_completed is null;
