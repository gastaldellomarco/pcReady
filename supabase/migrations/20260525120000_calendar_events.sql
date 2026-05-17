-- Calendar events for shared team calendar
-- Supports interventions, deadlines, appointments, and availability blocks

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  event_type text not null default 'appointment'
    check (event_type in ('intervention', 'deadline', 'appointment', 'availability')),
  ticket_id uuid references public.tickets(id) on delete set null,
  assignee_id uuid references public.profiles(id) on delete set null,
  color text,
  estimated_duration_minutes integer check (estimated_duration_minutes > 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendar_events_range
  on public.calendar_events (start_at, end_at);

create index if not exists idx_calendar_events_assignee
  on public.calendar_events (assignee_id, start_at);

create index if not exists idx_calendar_events_ticket
  on public.calendar_events (ticket_id);

create index if not exists idx_calendar_events_created_by
  on public.calendar_events (created_by, start_at);

alter table public.calendar_events enable row level security;

-- All authenticated users can read events (team visibility)
drop policy if exists "calendar_events_select" on public.calendar_events;
create policy "calendar_events_select"
  on public.calendar_events for select to authenticated
  using (true);

-- Only admins and techs can insert
drop policy if exists "calendar_events_insert" on public.calendar_events;
create policy "calendar_events_insert"
  on public.calendar_events for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech')
  );

-- Admin can update all; techs/others can only update their own
drop policy if exists "calendar_events_update" on public.calendar_events;
create policy "calendar_events_update"
  on public.calendar_events for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin') or created_by = auth.uid()
  )
  with check (
    public.has_role(auth.uid(), 'admin') or created_by = auth.uid()
  );

-- Admin can delete all; techs/others can only delete their own
drop policy if exists "calendar_events_delete" on public.calendar_events;
create policy "calendar_events_delete"
  on public.calendar_events for delete to authenticated
  using (
    public.has_role(auth.uid(), 'admin') or created_by = auth.uid()
  );

-- Auto-update updated_at
create or replace function public.touch_calendar_events_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists calendar_events_updated_at on public.calendar_events;
create trigger calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.touch_calendar_events_updated_at();

-- Enable realtime replication
alter table public.calendar_events replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'calendar_events'
  ) then
    alter publication supabase_realtime add table public.calendar_events;
  end if;
end;
$$;