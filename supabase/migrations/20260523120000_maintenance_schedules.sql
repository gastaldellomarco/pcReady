create table if not exists public.maintenance_schedules (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete cascade,
  title text not null,
  description text,
  recurrence text not null default 'once' check (recurrence in ('once', 'weekly', 'monthly', 'quarterly', 'yearly')),
  next_due_date date not null,
  last_done_date date,
  assigned_to uuid references public.user_profiles(id) on delete set null,
  auto_create_ticket boolean not null default false,
  ticket_template jsonb,
  last_ticket_created_for date,
  due_soon_notified_for date,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_history (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid references public.maintenance_schedules(id) on delete set null,
  device_id uuid not null references public.devices(id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_by uuid references auth.users(id) on delete set null,
  notes text
);

alter table public.maintenance_schedules enable row level security;
alter table public.maintenance_history enable row level security;

create index if not exists maintenance_schedules_device_due_idx
  on public.maintenance_schedules(device_id, next_due_date);

create index if not exists maintenance_schedules_due_assignee_idx
  on public.maintenance_schedules(next_due_date, assigned_to);

create index if not exists maintenance_history_device_completed_idx
  on public.maintenance_history(device_id, completed_at desc);

drop policy if exists "All authed read maintenance schedules" on public.maintenance_schedules;
create policy "All authed read maintenance schedules"
  on public.maintenance_schedules
  for select
  to authenticated
  using (true);

drop policy if exists "Tech admin insert maintenance schedules" on public.maintenance_schedules;
create policy "Tech admin insert maintenance schedules"
  on public.maintenance_schedules
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop policy if exists "Tech admin update maintenance schedules" on public.maintenance_schedules;
create policy "Tech admin update maintenance schedules"
  on public.maintenance_schedules
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop policy if exists "Admin delete maintenance schedules" on public.maintenance_schedules;
create policy "Admin delete maintenance schedules"
  on public.maintenance_schedules
  for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "All authed read maintenance history" on public.maintenance_history;
create policy "All authed read maintenance history"
  on public.maintenance_history
  for select
  to authenticated
  using (true);

drop policy if exists "Tech admin insert maintenance history" on public.maintenance_history;
create policy "Tech admin insert maintenance history"
  on public.maintenance_history
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'notifications_type_check'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications drop constraint notifications_type_check;
  end if;

  alter table public.notifications
    add constraint notifications_type_check
    check (type in (
      'ticket_assigned',
      'ticket_status_changed',
      'ticket_completed',
      'ticket_comment',
      'automation_failed',
      'device_status_changed',
      'checklist_completed',
      'checklist_section_assigned',
      'user_invited',
      'mention',
      'maintenance_due_soon'
    ));
end $$;

create or replace function public.next_maintenance_due_date(_from date, _recurrence text)
returns date
language plpgsql
immutable
as $$
begin
  if _recurrence = 'weekly' then
    return (_from + interval '7 days')::date;
  elsif _recurrence = 'monthly' then
    return (_from + interval '1 month')::date;
  elsif _recurrence = 'quarterly' then
    return (_from + interval '3 months')::date;
  elsif _recurrence = 'yearly' then
    return (_from + interval '1 year')::date;
  end if;
  return _from;
end;
$$;

create or replace function public.run_maintenance_automations()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s record;
  ticket_title text;
  ticket_description text;
  client_name text;
begin
  for s in
    select ms.*, d.model, d.serial, d.os, c.name as client_name
    from public.maintenance_schedules ms
    join public.devices d on d.id = ms.device_id
    left join public.clients c on c.id = d.client_id
    where ms.auto_create_ticket = true
      and ms.next_due_date <= current_date
      and (ms.last_ticket_created_for is null or ms.last_ticket_created_for <> ms.next_due_date)
  loop
    ticket_title := coalesce(s.ticket_template->>'title', s.title);
    ticket_description := coalesce(s.ticket_template->>'description', s.description, 'Manutenzione programmata in scadenza');
    client_name := coalesce(s.client_name, 'Cliente non assegnato');

    insert into public.tickets (
      client,
      model,
      serial,
      requester,
      end_user,
      priority,
      status,
      assignee_id,
      os,
      notes,
      device_id,
      client_id,
      ticket_type,
      category
    ) values (
      client_name,
      coalesce(s.model, ticket_title),
      s.serial,
      'Manutenzione programmata',
      client_name,
      'med',
      'pending',
      s.assigned_to,
      s.os,
      ticket_description,
      s.device_id,
      (select d.client_id from public.devices d where d.id = s.device_id),
      'maintenance',
      s.title
    );

    update public.maintenance_schedules
    set last_ticket_created_for = s.next_due_date
    where id = s.id;
  end loop;

  for s in
    select ms.*, d.model, d.serial
    from public.maintenance_schedules ms
    join public.devices d on d.id = ms.device_id
    where ms.assigned_to is not null
      and ms.next_due_date between current_date and current_date + interval '7 days'
      and (ms.due_soon_notified_for is null or ms.due_soon_notified_for <> ms.next_due_date)
  loop
    insert into public.notifications (user_id, type, title, body, payload, link)
    values (
      s.assigned_to,
      'maintenance_due_soon',
      'Manutenzione in scadenza',
      s.title || ' per ' || coalesce(s.model, 'dispositivo') || ' scade il ' || s.next_due_date::text,
      jsonb_build_object('schedule_id', s.id, 'device_id', s.device_id, 'next_due_date', s.next_due_date),
      '/inventory?device=' || s.device_id::text
    );

    update public.maintenance_schedules
    set due_soon_notified_for = s.next_due_date
    where id = s.id;
  end loop;
end;
$$;

revoke execute on function public.run_maintenance_automations() from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cron' and p.proname = 'schedule'
  ) then
    perform cron.schedule(
      'maintenance-automations-daily',
      '15 7 * * *',
      'select public.run_maintenance_automations();'
    );
  end if;
end;
$$;
