-- Calendar event extensions: recurrence, agenda metadata, reminders, ticket links, sync

alter table public.calendar_events
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists availability_status text
    check (availability_status is null or availability_status in ('available', 'vacation', 'sick_leave', 'unavailable')),
  add column if not exists recurrence_frequency text
    check (recurrence_frequency is null or recurrence_frequency in ('daily', 'weekly', 'monthly', 'custom')),
  add column if not exists recurrence_interval integer
    check (recurrence_interval is null or recurrence_interval > 0),
  add column if not exists recurrence_until date,
  add column if not exists recurrence_count integer
    check (recurrence_count is null or recurrence_count > 0),
  add column if not exists recurrence_days text[],
  add column if not exists recurrence_series_id uuid references public.calendar_events(id) on delete cascade,
  add column if not exists recurrence_parent_id uuid references public.calendar_events(id) on delete cascade,
  add column if not exists recurrence_exception_date date,
  add column if not exists external_provider text
    check (external_provider is null or external_provider in ('google', 'outlook')),
  add column if not exists external_event_id text,
  add column if not exists external_updated_at timestamptz,
  add column if not exists sync_status text
    check (sync_status is null or sync_status in ('local', 'synced', 'pending', 'conflict', 'disabled'));

update public.calendar_events
set recurrence_interval = 1
where recurrence_frequency is not null
  and recurrence_interval is null;

create index if not exists idx_calendar_events_client
  on public.calendar_events (client_id, start_at);

create index if not exists idx_calendar_events_recurrence
  on public.calendar_events (recurrence_frequency, recurrence_until, start_at)
  where recurrence_frequency is not null;

create index if not exists idx_calendar_events_series
  on public.calendar_events (recurrence_series_id, recurrence_exception_date)
  where recurrence_series_id is not null;

create table if not exists public.calendar_event_tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, ticket_id)
);

create index if not exists idx_calendar_event_tickets_event
  on public.calendar_event_tickets (event_id);

create index if not exists idx_calendar_event_tickets_ticket
  on public.calendar_event_tickets (ticket_id);

alter table public.calendar_event_tickets enable row level security;

drop policy if exists "calendar_event_tickets_select" on public.calendar_event_tickets;
create policy "calendar_event_tickets_select"
  on public.calendar_event_tickets for select to authenticated
  using (true);

drop policy if exists "calendar_event_tickets_insert" on public.calendar_event_tickets;
create policy "calendar_event_tickets_insert"
  on public.calendar_event_tickets for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech')
  );

drop policy if exists "calendar_event_tickets_delete" on public.calendar_event_tickets;
create policy "calendar_event_tickets_delete"
  on public.calendar_event_tickets for delete to authenticated
  using (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech')
  );

create table if not exists public.calendar_event_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  offset_minutes integer not null check (offset_minutes > 0),
  channel text not null check (channel in ('email', 'in_app')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, offset_minutes, channel)
);

create index if not exists idx_calendar_event_reminders_event
  on public.calendar_event_reminders (event_id);

create index if not exists idx_calendar_event_reminders_pending
  on public.calendar_event_reminders (sent_at, offset_minutes)
  where sent_at is null;

alter table public.calendar_event_reminders enable row level security;

drop policy if exists "calendar_event_reminders_select" on public.calendar_event_reminders;
create policy "calendar_event_reminders_select"
  on public.calendar_event_reminders for select to authenticated
  using (true);

drop policy if exists "calendar_event_reminders_manage" on public.calendar_event_reminders;
create policy "calendar_event_reminders_manage"
  on public.calendar_event_reminders for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech')
  )
  with check (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech')
  );

create table if not exists public.calendar_sync_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google', 'outlook')),
  account_email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  sync_enabled boolean not null default false,
  last_synced_at timestamptz,
  sync_cursor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, account_email)
);

create index if not exists idx_calendar_sync_connections_user
  on public.calendar_sync_connections (user_id, provider);

alter table public.calendar_sync_connections enable row level security;

drop policy if exists "Users read own calendar sync connections" on public.calendar_sync_connections;
create policy "Users read own calendar sync connections"
  on public.calendar_sync_connections for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

drop policy if exists "Users manage own calendar sync connections" on public.calendar_sync_connections;
create policy "Users manage own calendar sync connections"
  on public.calendar_sync_connections for all to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

drop trigger if exists calendar_sync_connections_updated on public.calendar_sync_connections;
create trigger calendar_sync_connections_updated
  before update on public.calendar_sync_connections
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.calendar_event_tickets to authenticated;
grant select, insert, update, delete on public.calendar_event_reminders to authenticated;
grant select, insert, update, delete on public.calendar_sync_connections to authenticated;
