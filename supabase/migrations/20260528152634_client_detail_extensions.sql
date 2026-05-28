-- Client detail extensions: internal notes, tags, documents, activity helpers, contract alerts.

create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_notes_client_created
  on public.client_notes (client_id, created_at desc);

create table if not exists public.client_note_revisions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.client_notes(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  previous_content text not null,
  new_content text not null,
  author_id uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_client_note_revisions_note
  on public.client_note_revisions (note_id, changed_at desc);

create table if not exists public.client_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_client_tags_name_unique
  on public.client_tags (lower(name));

create table if not exists public.client_tag_assignments (
  client_id uuid not null references public.clients(id) on delete cascade,
  tag_id uuid not null references public.client_tags(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id) on delete set null,
  primary key (client_id, tag_id)
);

create index if not exists idx_client_tag_assignments_tag
  on public.client_tag_assignments (tag_id, client_id);

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  file_name text not null,
  storage_bucket text not null default 'client-documents',
  storage_path text not null,
  file_size bigint,
  mime_type text,
  document_type text not null default 'other'
    check (document_type in ('contract', 'nda', 'technical', 'other')),
  description text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now()
);

create unique index if not exists idx_client_documents_storage_path
  on public.client_documents (storage_bucket, storage_path);

create index if not exists idx_client_documents_client
  on public.client_documents (client_id, uploaded_at desc);

create table if not exists public.client_contract_alerts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  bundle_assignment_id uuid references public.client_bundle_assignments(id) on delete cascade,
  days_before integer not null default 30 check (days_before > 0),
  channel text not null default 'in_app' check (channel in ('in_app', 'email')),
  enabled boolean not null default true,
  last_notified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, bundle_assignment_id, channel)
);

create index if not exists idx_client_contract_alerts_client
  on public.client_contract_alerts (client_id, enabled);

create or replace function public.touch_client_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.record_client_note_revision()
returns trigger
language plpgsql
as $$
begin
  if old.content is distinct from new.content then
    insert into public.client_note_revisions (
      note_id,
      client_id,
      previous_content,
      new_content,
      author_id
    ) values (
      old.id,
      old.client_id,
      old.content,
      new.content,
      new.author_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists client_notes_touch_updated_at on public.client_notes;
create trigger client_notes_touch_updated_at
  before update on public.client_notes
  for each row execute function public.touch_client_notes_updated_at();

drop trigger if exists client_notes_record_revision on public.client_notes;
create trigger client_notes_record_revision
  after update of content on public.client_notes
  for each row execute function public.record_client_note_revision();

drop trigger if exists client_contract_alerts_touch_updated_at on public.client_contract_alerts;
create trigger client_contract_alerts_touch_updated_at
  before update on public.client_contract_alerts
  for each row execute function public.set_updated_at();

create or replace function public.run_client_contract_alerts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  alert_record record;
begin
  for alert_record in
    select
      a.id as alert_id,
      a.channel,
      a.days_before,
      c.id as client_id,
      c.name as client_name,
      c.company_name,
      ba.id as bundle_assignment_id,
      ba.end_date,
      b.name as bundle_name
    from public.client_contract_alerts a
    join public.clients c on c.id = a.client_id
    join public.client_bundle_assignments ba
      on ba.client_id = a.client_id
      and (a.bundle_assignment_id is null or a.bundle_assignment_id = ba.id)
    join public.assistance_bundles b on b.id = ba.bundle_id
    where a.enabled = true
      and a.channel = 'in_app'
      and ba.status = 'active'
      and ba.end_date is not null
      and ba.end_date <= current_date + make_interval(days => a.days_before)
      and ba.end_date >= current_date
      and (
        a.last_notified_at is null
        or a.last_notified_at::date < current_date
      )
  loop
    insert into public.notifications (user_id, type, title, body, payload, link)
    select
      p.id,
      'bundle_expiring',
      'Contratto cliente in scadenza',
      coalesce(alert_record.company_name, alert_record.client_name) || ' - ' ||
        coalesce(alert_record.bundle_name, 'bundle') || ' scade il ' ||
        alert_record.end_date::text,
      jsonb_build_object(
        'client_id', alert_record.client_id,
        'bundle_assignment_id', alert_record.bundle_assignment_id,
        'end_date', alert_record.end_date,
        'days_before', alert_record.days_before
      ),
      '/clients?clientId=' || alert_record.client_id::text || '&tab=settings'
    from public.profiles p
    where p.role in ('admin', 'tech');

    update public.client_contract_alerts
    set last_notified_at = now()
    where id = alert_record.alert_id;
  end loop;
end;
$$;

revoke execute on function public.run_client_contract_alerts() from public, anon, authenticated;

alter table public.client_notes enable row level security;
alter table public.client_note_revisions enable row level security;
alter table public.client_tags enable row level security;
alter table public.client_tag_assignments enable row level security;
alter table public.client_documents enable row level security;
alter table public.client_contract_alerts enable row level security;

drop policy if exists "authenticated can read client notes" on public.client_notes;
create policy "authenticated can read client notes"
  on public.client_notes for select to authenticated using (true);

drop policy if exists "admin and tech can insert client notes" on public.client_notes;
create policy "admin and tech can insert client notes"
  on public.client_notes for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop policy if exists "admin and tech can update client notes" on public.client_notes;
create policy "admin and tech can update client notes"
  on public.client_notes for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop policy if exists "admin can delete client notes" on public.client_notes;
create policy "admin can delete client notes"
  on public.client_notes for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "authenticated can read client note revisions" on public.client_note_revisions;
create policy "authenticated can read client note revisions"
  on public.client_note_revisions for select to authenticated using (true);

drop policy if exists "authenticated can read client tags" on public.client_tags;
create policy "authenticated can read client tags"
  on public.client_tags for select to authenticated using (true);

drop policy if exists "admin and tech can manage client tags" on public.client_tags;
create policy "admin and tech can manage client tags"
  on public.client_tags for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop policy if exists "authenticated can read client tag assignments" on public.client_tag_assignments;
create policy "authenticated can read client tag assignments"
  on public.client_tag_assignments for select to authenticated using (true);

drop policy if exists "admin and tech can manage client tag assignments" on public.client_tag_assignments;
create policy "admin and tech can manage client tag assignments"
  on public.client_tag_assignments for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop policy if exists "authenticated can read client documents" on public.client_documents;
create policy "authenticated can read client documents"
  on public.client_documents for select to authenticated using (true);

drop policy if exists "admin and tech can insert client documents" on public.client_documents;
create policy "admin and tech can insert client documents"
  on public.client_documents for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop policy if exists "admin and tech can update client documents" on public.client_documents;
create policy "admin and tech can update client documents"
  on public.client_documents for update to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop policy if exists "admin can delete client documents" on public.client_documents;
create policy "admin can delete client documents"
  on public.client_documents for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "authenticated can read client contract alerts" on public.client_contract_alerts;
create policy "authenticated can read client contract alerts"
  on public.client_contract_alerts for select to authenticated using (true);

drop policy if exists "admin and tech can manage client contract alerts" on public.client_contract_alerts;
create policy "admin and tech can manage client contract alerts"
  on public.client_contract_alerts for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

drop policy if exists "authenticated can read client documents files" on storage.objects;
create policy "authenticated can read client documents files"
  on storage.objects for select to authenticated
  using (bucket_id = 'client-documents');

drop policy if exists "admin and tech can upload client documents files" on storage.objects;
create policy "admin and tech can upload client documents files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'client-documents'
    and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  );

drop policy if exists "admin and tech can update client documents files" on storage.objects;
create policy "admin and tech can update client documents files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'client-documents'
    and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  )
  with check (
    bucket_id = 'client-documents'
    and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  );

drop policy if exists "admin can delete client documents files" on storage.objects;
create policy "admin can delete client documents files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'client-documents' and public.has_role(auth.uid(), 'admin'));

grant select, insert, update, delete on public.client_notes to authenticated;
grant select on public.client_note_revisions to authenticated;
grant select, insert, update, delete on public.client_tags to authenticated;
grant select, insert, update, delete on public.client_tag_assignments to authenticated;
grant select, insert, update, delete on public.client_documents to authenticated;
grant select, insert, update, delete on public.client_contract_alerts to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'cron' and p.proname = 'schedule'
  ) then
    perform cron.schedule(
      'client-contract-alerts-daily',
      '30 7 * * *',
      'select public.run_client_contract_alerts();'
    );
  end if;
end;
$$;
