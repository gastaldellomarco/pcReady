-- Ticket checklist instances: snapshot checklist templates per ticket with per-section assignments.

create table if not exists public.ticket_checklist_instances (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  template_id uuid references public.checklist_templates(id) on delete set null,
  title text not null,
  structure jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  section_assignments jsonb not null default '{}'::jsonb,
  completed_by uuid references public.user_profiles(id) on delete set null,
  completion_confirmed boolean not null default false,
  signature_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.ticket_checklist_responses (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.ticket_checklist_instances(id) on delete cascade,
  item_key text not null,
  value text,
  compiled_by uuid references public.user_profiles(id) on delete set null,
  compiled_at timestamptz not null default now(),
  unique (instance_id, item_key)
);

create index if not exists idx_ticket_checklist_instances_ticket_id
  on public.ticket_checklist_instances(ticket_id, created_at);

create index if not exists idx_ticket_checklist_instances_assigned_to
  on public.ticket_checklist_instances(assigned_to)
  where assigned_to is not null;

create index if not exists idx_ticket_checklist_responses_instance_id
  on public.ticket_checklist_responses(instance_id, item_key);

alter table public.ticket_checklist_instances enable row level security;
alter table public.ticket_checklist_responses enable row level security;

drop policy if exists "ticket checklist instances read" on public.ticket_checklist_instances;
create policy "ticket checklist instances read"
  on public.ticket_checklist_instances
  for select
  to authenticated
  using (true);

drop policy if exists "ticket checklist instances insert staff" on public.ticket_checklist_instances;
create policy "ticket checklist instances insert staff"
  on public.ticket_checklist_instances
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop policy if exists "ticket checklist instances update staff" on public.ticket_checklist_instances;
create policy "ticket checklist instances update staff"
  on public.ticket_checklist_instances
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop policy if exists "ticket checklist responses read" on public.ticket_checklist_responses;
create policy "ticket checklist responses read"
  on public.ticket_checklist_responses
  for select
  to authenticated
  using (true);

drop policy if exists "ticket checklist responses upsert staff" on public.ticket_checklist_responses;
create policy "ticket checklist responses upsert staff"
  on public.ticket_checklist_responses
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop trigger if exists set_ticket_checklist_instances_updated_at on public.ticket_checklist_instances;
create trigger set_ticket_checklist_instances_updated_at
  before update on public.ticket_checklist_instances
  for each row execute function public.set_updated_at();

-- Extend notification type constraint for section assignment events.
do $$
begin
  alter table public.notifications drop constraint if exists notifications_type_check;
  alter table public.notifications add constraint notifications_type_check check (type in (
    'ticket_assigned',
    'ticket_status_changed',
    'ticket_completed',
    'ticket_comment',
    'automation_failed',
    'device_status_changed',
    'checklist_completed',
    'checklist_section_assigned',
    'user_invited',
    'mention'
  ));
end;
$$;
