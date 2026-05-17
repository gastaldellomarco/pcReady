create table if not exists public.user_mfa_backup_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, code_hash)
);

create index if not exists idx_user_mfa_backup_codes_user_id
  on public.user_mfa_backup_codes (user_id);

create index if not exists idx_user_mfa_backup_codes_unused
  on public.user_mfa_backup_codes (user_id, used_at)
  where used_at is null;

alter table public.user_mfa_backup_codes enable row level security;

drop policy if exists "Users can read their own 2FA backup code status" on public.user_mfa_backup_codes;
create policy "Users can read their own 2FA backup code status"
  on public.user_mfa_backup_codes
  for select
  to authenticated
  using (auth.uid() = user_id);

insert into public.app_settings (key, value)
values
  ('mfa_require_admin_users', 'false'),
  ('mfa_require_all_users', 'false'),
  ('mfa_grace_period_days', '7')
on conflict (key) do nothing;
