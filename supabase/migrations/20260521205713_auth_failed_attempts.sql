create table if not exists public.auth_failed_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  success boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auth_failed_attempts_email_created_at_idx
  on public.auth_failed_attempts (email, created_at desc);

alter table public.auth_failed_attempts enable row level security;
