-- Fix: add ticket_completed to check constraint and seed missing template
-- First, add the new event_type to the check constraint by recreating it

-- 1. Drop the existing check constraint
alter table public.email_templates drop constraint if exists email_templates_event_type_check;

-- 2. Add the updated check constraint with all 6 event types
alter table public.email_templates add constraint email_templates_event_type_check 
  check (
    event_type in (
      'invite',
      'reset_password',
      'confirm_account',
      'ticket_assigned',
      'checklist_completed',
      'ticket_completed'
    )
  );

-- 3. Insert the missing ticket_completed template
insert into public.email_templates (event_type, subject, body_html, body_text, variables, is_active)
values (
  'ticket_completed',
  '[{{organization_name}}] Ticket {{ticket_code}} completato',
  '<h1>Ticket completato</h1><p>Gentile {{client_name}},</p><p>Il ticket <strong>{{ticket_code}}</strong> e'' stato completato il {{completed_date}}.</p><p>Tecnico assegnatario: {{assignee_name}}.</p><p>Puoi scaricare il verbale al seguente link:</p><p><a href="{{pdf_link}}">Scarica verbale PDF</a></p><p>Per qualsiasi necessita, rispondi a questa email o accedi al <a href="{{portal_link}}">portale clienti</a>.</p><p>Cordiali saluti,<br/>{{organization_name}}</p>',
  'Gentile {{client_name}}, il ticket {{ticket_code}} e'' stato completato il {{completed_date}}. Tecnico: {{assignee_name}}. Scarica il verbale: {{pdf_link}}. Portale: {{portal_link}}. Cordiali saluti, {{organization_name}}',
  '["{{organization_name}}","{{support_email}}","{{user_name}}","{{user_email}}","{{ticket_code}}","{{ticket_title}}","{{client_name}}","{{assignee_name}}","{{completed_date}}","{{pdf_link}}","{{portal_link}}"]'::jsonb,
  true
)
on conflict (event_type) do nothing;
