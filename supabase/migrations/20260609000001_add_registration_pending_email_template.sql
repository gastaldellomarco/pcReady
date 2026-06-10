-- Add registration_pending to the email_templates check constraint
-- and seed the default template for admin notification on pending self-registrations.

alter table public.email_templates drop constraint if exists email_templates_event_type_check;

alter table public.email_templates add constraint email_templates_event_type_check
  check (event_type in (
    'invite',
    'reset_password',
    'confirm_account',
    'registration_pending',
    'ticket_assigned',
    'checklist_completed',
    'ticket_completed',
    'portal_ticket_created',
    'portal_ticket_status_changed',
    'portal_public_note_added',
    'portal_ticket_closed_feedback'
  ));

insert into public.email_templates (event_type, subject, body_html, body_text, variables, is_active)
values (
  'registration_pending',
  '[{{organization_name}}] Nuova registrazione in attesa di approvazione',
  '<h1>Nuova registrazione da approvare</h1><p>Ciao {{admin_name}},</p><p><strong>{{registered_user_name}}</strong> ({{registered_user_email}}) ha richiesto la registrazione su {{organization_name}}.</p><p>L''account è in attesa di approvazione. Accedi al pannello admin per approvarlo:</p><p><a href="{{admin_link}}">Vai alla sezione Admin → Utenti</a></p><p>L''utente apparirà come <strong>&quot;In attesa&quot;</strong> nella lista utenti.</p><p>Supporto: {{support_email}}</p>',
  'Ciao {{admin_name}}, {{registered_user_name}} ({{registered_user_email}}) ha richiesto la registrazione su {{organization_name}}. L''account è in attesa di approvazione. Vai qui: {{admin_link}}. Supporto: {{support_email}}',
  '["{{organization_name}}", "{{support_email}}", "{{user_name}}", "{{user_email}}", "{{admin_name}}", "{{registered_user_name}}", "{{registered_user_email}}", "{{admin_link}}"]'::jsonb,
  true
)
on conflict (event_type) do update
set subject = excluded.subject,
    body_html = excluded.body_html,
    body_text = excluded.body_text,
    variables = excluded.variables,
    is_active = excluded.is_active;
