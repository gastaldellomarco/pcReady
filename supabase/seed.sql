insert into public.email_templates (event_type, subject, body_html, body_text, variables, is_active)
values
  (
    'invite',
    '[{{organization_name}}] Sei stato invitato',
    '<h1>Benvenuto in {{organization_name}}</h1><p>Ciao {{user_name}},</p><p>sei stato invitato ad accedere a PCReady.</p><p><a href="{{invite_link}}">Imposta la password e accedi</a></p><p>Per assistenza: {{support_email}}</p>',
    'Ciao {{user_name}}, sei stato invitato ad accedere a {{organization_name}}. Apri {{invite_link}} per impostare la password. Supporto: {{support_email}}',
    '["{{organization_name}}","{{support_email}}","{{user_name}}","{{user_email}}","{{invite_link}}"]'::jsonb,
    true
  ),
  (
    'reset_password',
    '[{{organization_name}}] Reset password',
    '<h1>Reset password</h1><p>Ciao {{user_name}},</p><p>usa questo link per impostare una nuova password:</p><p><a href="{{reset_link}}">Reimposta password</a></p><p>Supporto: {{support_email}}</p>',
    'Ciao {{user_name}}, usa questo link per impostare una nuova password: {{reset_link}}. Supporto: {{support_email}}',
    '["{{organization_name}}","{{support_email}}","{{user_name}}","{{user_email}}","{{reset_link}}"]'::jsonb,
    true
  ),
  (
    'confirm_account',
    '[{{organization_name}}] Conferma account',
    '<h1>Conferma account</h1><p>Ciao {{user_name}},</p><p>conferma il tuo account da qui:</p><p><a href="{{confirm_link}}">Conferma account</a></p><p>Supporto: {{support_email}}</p>',
    'Ciao {{user_name}}, conferma il tuo account da qui: {{confirm_link}}. Supporto: {{support_email}}',
    '["{{organization_name}}","{{support_email}}","{{user_name}}","{{user_email}}","{{confirm_link}}"]'::jsonb,
    true
  ),
  (
    'ticket_assigned',
    '[{{organization_name}}] Ticket assegnato {{ticket_code}}',
    '<h1>Nuovo ticket assegnato</h1><p>Ciao {{user_name}},</p><p>ti e'' stato assegnato il ticket <strong>{{ticket_code}}</strong>: {{ticket_title}}.</p><p><a href="{{ticket_link}}">Apri ticket</a></p><p>Supporto: {{support_email}}</p>',
    'Ciao {{user_name}}, ti e'' stato assegnato il ticket {{ticket_code}}: {{ticket_title}}. Apri: {{ticket_link}}',
    '["{{organization_name}}","{{support_email}}","{{user_name}}","{{user_email}}","{{ticket_code}}","{{ticket_title}}","{{ticket_link}}"]'::jsonb,
    true
  ),
  (
    'checklist_completed',
    '[{{organization_name}}] Checklist completata',
    '<h1>Checklist completata</h1><p>La checklist {{checklist_name}} per il ticket {{ticket_code}} e'' stata completata.</p><p><a href="{{ticket_link}}">Apri ticket</a></p><p>Supporto: {{support_email}}</p>',
    'La checklist {{checklist_name}} per il ticket {{ticket_code}} e'' stata completata. Apri: {{ticket_link}}',
    '["{{organization_name}}","{{support_email}}","{{user_name}}","{{user_email}}","{{checklist_name}}","{{ticket_code}}","{{ticket_link}}"]'::jsonb,
    true
  )
on conflict (event_type) do nothing;
