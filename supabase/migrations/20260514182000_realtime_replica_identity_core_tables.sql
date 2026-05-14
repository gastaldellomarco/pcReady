-- Supabase Realtime: richer payloads for postgres_changes (especially with RLS)
-- and ensure tables are published when supabase_realtime exists.

alter table if exists public.tickets replica identity full;
alter table if exists public.devices replica identity full;
alter table if exists public.clients replica identity full;
alter table if exists public.activity_log replica identity full;

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  foreach t in array array['tickets', 'devices', 'clients', 'activity_log']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
