create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  phone text,
  timezone text default 'Europe/Rome',
  language text default 'it',
  notify_ticket_assigned boolean default true,
  notify_ticket_status_changed boolean default true,
  notify_automation_failed boolean default true,
  notify_device_status_changed boolean default true,
  notify_checklist_completed boolean default true,
  notify_mentions boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can manage their own user profile" on public.user_profiles;
create policy "Users can manage their own user profile"
  on public.user_profiles
  for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop trigger if exists user_profiles_updated on public.user_profiles;
create trigger user_profiles_updated
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

insert into public.user_profiles (id, display_name)
select
  users.id,
  coalesce(users.raw_user_meta_data->>'full_name', split_part(users.email, '@', 1))
from auth.users users
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Avatar images are readable by authenticated users" on storage.objects;
create policy "Avatar images are readable by authenticated users"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  _name text;
  _ini text;
begin
  _name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  _ini := upper(left(_name, 1) || coalesce(substring(_name from ' (.)'), ''));
  if length(_ini) < 2 then _ini := upper(left(_name, 2)); end if;

  insert into public.profiles (id, full_name, initials)
  values (new.id, _name, _ini)
  on conflict (id) do nothing;

  insert into public.user_profiles (id, display_name)
  values (new.id, _name)
  on conflict (id) do nothing;

  if (select count(*) from public.user_roles) = 0 then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin')
    on conflict do nothing;
  else
    insert into public.user_roles (user_id, role)
    values (new.id, 'tech')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
