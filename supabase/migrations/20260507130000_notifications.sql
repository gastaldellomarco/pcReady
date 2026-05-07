create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'ticket_assigned',
    'ticket_status_changed',
    'ticket_comment',
    'automation_failed',
    'device_status_changed',
    'checklist_completed',
    'user_invited',
    'mention'
  )),
  title text not null,
  body text,
  payload jsonb,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own"
  on public.notifications
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
    )
  then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cron' and p.proname = 'schedule'
  ) then
    execute $cron$
      select cron.schedule(
        'cleanup-old-notifications',
        '0 3 * * *',
        $job$
          delete from public.notifications
          where read_at is not null
          and read_at < now() - interval '30 days';
        $job$
      )
    $cron$;
  end if;
end;
$$;
