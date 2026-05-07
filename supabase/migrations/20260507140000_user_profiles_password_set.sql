alter table public.user_profiles
  add column if not exists password_set boolean not null default false;

update public.user_profiles
set password_set = true
where password_set = false
  and id in (
    select id
    from auth.users
    where coalesce(encrypted_password, '') <> ''
       or last_sign_in_at is not null
  );

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

  insert into public.user_profiles (id, display_name, password_set)
  values (new.id, _name, false)
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
