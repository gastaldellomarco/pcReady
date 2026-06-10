-- Add a unique constraint on user_id in user_roles, allowing upserts
-- with onConflict: 'user_id'. The existing composite UNIQUE(user_id, role)
-- is now redundant and is removed.

-- First, clean up any potential rows where a user has multiple role rows
-- (shouldn't happen with the existing app logic, but be safe)
delete from public.user_roles a
using public.user_roles b
where a.id < b.id
  and a.user_id = b.user_id;

-- Drop the composite unique constraint (auto-named by Postgres)
alter table public.user_roles
  drop constraint if exists user_roles_user_id_role_key;

-- Add unique constraint on user_id alone
alter table public.user_roles
  add constraint user_roles_user_id_unique
  unique (user_id);

-- Update the handle_new_user trigger: use the new unique constraint
-- instead of relying on the composite one
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
    on conflict (user_id) do nothing;
  else
    insert into public.user_roles (user_id, role)
    values (new.id, 'tech')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
