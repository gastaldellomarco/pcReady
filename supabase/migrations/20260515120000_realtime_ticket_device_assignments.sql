-- Realtime for dashboard KPI refresh when assignments change
alter table if exists public.ticket_device_assignments replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ticket_device_assignments'
  ) then
    alter publication supabase_realtime add table public.ticket_device_assignments;
  end if;
end;
$$;
