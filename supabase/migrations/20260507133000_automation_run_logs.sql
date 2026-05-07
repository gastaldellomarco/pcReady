create table if not exists public.automation_run_logs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automation_flows(id) on delete cascade,
  triggered_at timestamptz not null default now(),
  triggered_by uuid references auth.users(id),
  status text not null check (status in ('success', 'error', 'dry_run', 'skipped')),
  duration_ms integer,
  trigger_payload jsonb,
  actions_executed jsonb,
  error_message text,
  is_dry_run boolean not null default false
);

alter table public.automation_run_logs enable row level security;

create index if not exists automation_run_logs_automation_idx
  on public.automation_run_logs (automation_id, triggered_at desc);

create index if not exists automation_run_logs_triggered_at_idx
  on public.automation_run_logs (triggered_at desc);

drop policy if exists "automation_run_logs_read" on public.automation_run_logs;
create policy "automation_run_logs_read"
  on public.automation_run_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
      and role in ('admin', 'tech')
    )
  );
