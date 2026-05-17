alter table public.clients
  add column if not exists portal_logo_url text,
  add column if not exists portal_primary_color text default '#1B4FD8',
  add column if not exists portal_welcome_message text,
  add column if not exists portal_name text;

alter table public.client_contacts
  add column if not exists portal_password_hash text,
  add column if not exists portal_password_updated_at timestamptz;

create table if not exists public.ticket_feedback (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  contact_id uuid references public.client_contacts(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(ticket_id, contact_id)
);

create index if not exists ticket_feedback_client_created_idx
  on public.ticket_feedback(client_id, created_at desc);

alter table public.ticket_feedback enable row level security;

drop policy if exists "Team can read ticket feedback" on public.ticket_feedback;
create policy "Team can read ticket feedback"
  on public.ticket_feedback
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'));

drop policy if exists "Team can delete ticket feedback" on public.ticket_feedback;
create policy "Team can delete ticket feedback"
  on public.ticket_feedback
  for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-portal-branding',
  'client-portal-branding',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Portal branding readable" on storage.objects;
create policy "Portal branding readable"
  on storage.objects
  for select
  to public
  using (bucket_id = 'client-portal-branding');

drop policy if exists "Team can upload portal branding" on storage.objects;
create policy "Team can upload portal branding"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'client-portal-branding'
    and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  );

drop policy if exists "Team can update portal branding" on storage.objects;
create policy "Team can update portal branding"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'client-portal-branding'
    and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  )
  with check (
    bucket_id = 'client-portal-branding'
    and (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'tech'))
  );

alter table public.email_templates drop constraint if exists email_templates_event_type_check;

alter table public.email_templates add constraint email_templates_event_type_check
  check (event_type in (
    'invite',
    'reset_password',
    'confirm_account',
    'ticket_assigned',
    'checklist_completed',
    'ticket_completed',
    'portal_ticket_created',
    'portal_ticket_status_changed',
    'portal_public_note_added',
    'portal_ticket_closed_feedback'
  ));

insert into public.email_templates (event_type, subject, body_html, body_text, variables, is_active)
values
  (
    'portal_ticket_created',
    '[{{organization_name}}] Ticket {{ticket_code}} ricevuto',
    '<h1>Ticket ricevuto</h1><p>Ciao {{contact_name}},</p><p>abbiamo ricevuto la richiesta <strong>{{ticket_code}}</strong>: {{ticket_title}}.</p><p>Stato iniziale: In attesa.</p><p><a href="{{portal_link}}">Apri il portale</a></p>',
    'Ciao {{contact_name}}, abbiamo ricevuto la richiesta {{ticket_code}}: {{ticket_title}}. Apri il portale: {{portal_link}}',
    '["organization_name", "contact_name", "ticket_code", "ticket_title", "portal_link"]'::jsonb,
    true
  ),
  (
    'portal_ticket_status_changed',
    '[{{organization_name}}] Ticket {{ticket_code}} aggiornato',
    '<h1>Ticket aggiornato</h1><p>Il ticket <strong>{{ticket_code}}</strong> ora è in stato <strong>{{ticket_status}}</strong>.</p><p><a href="{{portal_link}}">Vedi dettagli</a></p>',
    'Il ticket {{ticket_code}} ora è in stato {{ticket_status}}. Dettagli: {{portal_link}}',
    '["organization_name", "ticket_code", "ticket_status", "portal_link"]'::jsonb,
    true
  ),
  (
    'portal_public_note_added',
    '[{{organization_name}}] Nuova nota sul ticket {{ticket_code}}',
    '<h1>Nuova nota</h1><p>È stata aggiunta una nota pubblica al ticket <strong>{{ticket_code}}</strong>.</p><p>{{note_excerpt}}</p><p><a href="{{portal_link}}">Leggi nel portale</a></p>',
    'Nuova nota sul ticket {{ticket_code}}: {{note_excerpt}}. Portale: {{portal_link}}',
    '["organization_name", "ticket_code", "note_excerpt", "portal_link"]'::jsonb,
    true
  ),
  (
    'portal_ticket_closed_feedback',
    '[{{organization_name}}] Valuta il ticket {{ticket_code}}',
    '<h1>Ticket chiuso</h1><p>Il ticket <strong>{{ticket_code}}</strong> è stato chiuso.</p><p>Aiutaci a migliorare lasciando una valutazione.</p><p><a href="{{feedback_link}}">Lascia feedback</a></p>',
    'Il ticket {{ticket_code}} è stato chiuso. Lascia feedback: {{feedback_link}}',
    '["organization_name", "ticket_code", "feedback_link"]'::jsonb,
    true
  )
on conflict (event_type) do update
set subject = excluded.subject,
    body_html = excluded.body_html,
    body_text = excluded.body_text,
    variables = excluded.variables,
    is_active = excluded.is_active;

comment on table public.ticket_feedback is 'Valutazioni da portale cliente sui ticket chiusi.';
comment on column public.clients.portal_logo_url is 'Logo personalizzato mostrato nel portale cliente.';
comment on column public.clients.portal_primary_color is 'Colore principale del portale cliente.';
