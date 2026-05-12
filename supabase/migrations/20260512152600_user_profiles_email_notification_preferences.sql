alter table public.user_profiles
  add column if not exists notify_checklist_completed boolean default true,
  add column if not exists notify_ticket_completed boolean default true;

update public.user_profiles
set
  notify_checklist_completed = coalesce(notify_checklist_completed, true),
  notify_ticket_completed = coalesce(notify_ticket_completed, true)
where notify_checklist_completed is null
   or notify_ticket_completed is null;
