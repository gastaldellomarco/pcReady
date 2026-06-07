/**
 *
 */
export type EmailEventType =
  | "invite"
  | "reset_password"
  | "confirm_account"
  | "ticket_assigned"
  | "checklist_completed"
  | "ticket_completed"
  | "portal_ticket_created"
  | "portal_ticket_status_changed"
  | "portal_public_note_added"
  | "portal_ticket_closed_feedback";

/**
 *
 */
export interface EmailTemplateVariable {
  token: string;
  description: string;
}

/**
 *
 */
export interface EmailTemplate {
  id: string;
  event_type: EmailEventType;
  subject: string;
  body_html: string;
  body_text: string | null;
  variables: string[];
  is_active: boolean;
  last_modified_at: string;
  last_modified_by: string | null;
  last_modified_by_name: string | null;
  created_at: string;
}

export const EMAIL_EVENT_LABELS: Record<EmailEventType, string> = {
  invite: "emailTemplate.events.invite",
  reset_password: "emailTemplate.events.reset_password",
  confirm_account: "emailTemplate.events.confirm_account",
  ticket_assigned: "emailTemplate.events.ticket_assigned",
  checklist_completed: "emailTemplate.events.checklist_completed",
  ticket_completed: "emailTemplate.events.ticket_completed",
  portal_ticket_created: "emailTemplate.events.portal_ticket_created",
  portal_ticket_status_changed: "emailTemplate.events.portal_ticket_status_changed",
  portal_public_note_added: "emailTemplate.events.portal_public_note_added",
  portal_ticket_closed_feedback: "emailTemplate.events.portal_ticket_closed_feedback",
};

export const EMAIL_EVENT_TYPES = Object.keys(EMAIL_EVENT_LABELS) as EmailEventType[];

export interface EmailEventMeta {
  when: string;
  recipient: string;
}

export const EMAIL_EVENT_META: Record<EmailEventType, EmailEventMeta> = {
  invite: {
    when: "emailTemplate.meta.invite.when",
    recipient: "emailTemplate.meta.invite.recipient",
  },
  reset_password: {
    when: "emailTemplate.meta.reset_password.when",
    recipient: "emailTemplate.meta.reset_password.recipient",
  },
  confirm_account: {
    when: "emailTemplate.meta.confirm_account.when",
    recipient: "emailTemplate.meta.confirm_account.recipient",
  },
  ticket_assigned: {
    when: "emailTemplate.meta.ticket_assigned.when",
    recipient: "emailTemplate.meta.ticket_assigned.recipient",
  },
  checklist_completed: {
    when: "emailTemplate.meta.checklist_completed.when",
    recipient: "emailTemplate.meta.checklist_completed.recipient",
  },
  ticket_completed: {
    when: "emailTemplate.meta.ticket_completed.when",
    recipient: "emailTemplate.meta.ticket_completed.recipient",
  },
  portal_ticket_created: {
    when: "emailTemplate.meta.portal_ticket_created.when",
    recipient: "emailTemplate.meta.portal_ticket_created.recipient",
  },
  portal_ticket_status_changed: {
    when: "emailTemplate.meta.portal_ticket_status_changed.when",
    recipient: "emailTemplate.meta.portal_ticket_status_changed.recipient",
  },
  portal_public_note_added: {
    when: "emailTemplate.meta.portal_public_note_added.when",
    recipient: "emailTemplate.meta.portal_public_note_added.recipient",
  },
  portal_ticket_closed_feedback: {
    when: "emailTemplate.meta.portal_ticket_closed_feedback.when",
    recipient: "emailTemplate.meta.portal_ticket_closed_feedback.recipient",
  },
};

export const DEFAULT_TEMPLATES: Record<
  EmailEventType,
  { subject: string; body_html: string; body_text: string }
> = {
  invite: {
    subject: "[{{organization_name}}] Sei stato invitato",
    body_html:
      '<h1>Benvenuto in {{organization_name}}</h1><p>Ciao {{user_name}},</p><p>sei stato invitato ad accedere a PCReady.</p><p><a href="{{invite_link}}">Imposta la password e accedi</a></p><p>Per assistenza: {{support_email}}</p>',
    body_text:
      "Ciao {{user_name}}, sei stato invitato ad accedere a {{organization_name}}. Apri {{invite_link}} per impostare la password. Supporto: {{support_email}}",
  },
  reset_password: {
    subject: "[{{organization_name}}] Reset password",
    body_html:
      '<h1>Reset password</h1><p>Ciao {{user_name}},</p><p>usa questo link per impostare una nuova password:</p><p><a href="{{reset_link}}">Reimposta password</a></p><p>Supporto: {{support_email}}</p>',
    body_text:
      "Ciao {{user_name}}, usa questo link per impostare una nuova password: {{reset_link}}. Supporto: {{support_email}}",
  },
  confirm_account: {
    subject: "[{{organization_name}}] Conferma account",
    body_html:
      '<h1>Conferma account</h1><p>Ciao {{user_name}},</p><p>conferma il tuo account da qui:</p><p><a href="{{confirm_link}}">Conferma account</a></p><p>Supporto: {{support_email}}</p>',
    body_text:
      "Ciao {{user_name}}, conferma il tuo account da qui: {{confirm_link}}. Supporto: {{support_email}}",
  },
  ticket_assigned: {
    subject: "[{{organization_name}}] Ticket assegnato {{ticket_code}}",
    body_html:
      '<h1>Nuovo ticket assegnato</h1><p>Ciao {{user_name}},</p><p>ti e\' stato assegnato il ticket <strong>{{ticket_code}}</strong>: {{ticket_title}}.</p><p><a href="{{ticket_link}}">Apri ticket</a></p>',
    body_text:
      "Ciao {{user_name}}, ti e' stato assegnato il ticket {{ticket_code}}: {{ticket_title}}. Apri: {{ticket_link}}",
  },
  checklist_completed: {
    subject: "[{{organization_name}}] Checklist completata",
    body_html:
      '<h1>Checklist completata</h1><p>La checklist {{checklist_name}} per il ticket {{ticket_code}} e\' stata completata.</p><p><a href="{{ticket_link}}">Apri ticket</a></p>',
    body_text:
      "La checklist {{checklist_name}} per il ticket {{ticket_code}} e' stata completata. Apri: {{ticket_link}}",
  },
  ticket_completed: {
    subject: "[{{organization_name}}] Ticket {{ticket_code}} completato",
    body_html:
      '<h1>Ticket completato</h1><p>Gentile {{client_name}},</p><p>Il ticket <strong>{{ticket_code}}</strong> e\' stato completato il {{completed_date}}.</p><p>Tecnico assegnatario: {{assignee_name}}.</p><p>Puoi scaricare il verbale al seguente link:</p><p><a href="{{pdf_link}}">Scarica verbale PDF</a></p><p>Per qualsiasi necessita, rispondi a questa email o accedi al <a href="{{portal_link}}">portale clienti</a>.</p><p>Cordiali saluti,<br/>{{organization_name}}</p>',
    body_text:
      "Gentile {{client_name}}, il ticket {{ticket_code}} e' stato completato il {{completed_date}}. Tecnico: {{assignee_name}}. Scarica il verbale: {{pdf_link}}. Portale: {{portal_link}}. Cordiali saluti, {{organization_name}}",
  },
  portal_ticket_created: {
    subject: "[{{organization_name}}] Ticket {{ticket_code}} ricevuto",
    body_html:
      '<h1>Ticket ricevuto</h1><p>Ciao {{contact_name}},</p><p>abbiamo ricevuto la richiesta <strong>{{ticket_code}}</strong>: {{ticket_title}}.</p><p><a href="{{portal_link}}">Apri il portale</a></p>',
    body_text:
      "Ciao {{contact_name}}, abbiamo ricevuto la richiesta {{ticket_code}}: {{ticket_title}}. Portale: {{portal_link}}",
  },
  portal_ticket_status_changed: {
    subject: "[{{organization_name}}] Ticket {{ticket_code}} aggiornato",
    body_html:
      '<h1>Ticket aggiornato</h1><p>Il ticket <strong>{{ticket_code}}</strong> ora è in stato <strong>{{ticket_status}}</strong>.</p><p><a href="{{portal_link}}">Vedi dettagli</a></p>',
    body_text: "Il ticket {{ticket_code}} ora è in stato {{ticket_status}}. {{portal_link}}",
  },
  portal_public_note_added: {
    subject: "[{{organization_name}}] Nuova nota sul ticket {{ticket_code}}",
    body_html:
      '<h1>Nuova nota</h1><p>{{note_excerpt}}</p><p><a href="{{portal_link}}">Leggi nel portale</a></p>',
    body_text: "Nuova nota sul ticket {{ticket_code}}: {{note_excerpt}}. {{portal_link}}",
  },
  portal_ticket_closed_feedback: {
    subject: "[{{organization_name}}] Valuta il ticket {{ticket_code}}",
    body_html:
      '<h1>Ticket chiuso</h1><p>Aiutaci a migliorare lasciando una valutazione.</p><p><a href="{{feedback_link}}">Lascia feedback</a></p>',
    body_text: "Ticket {{ticket_code}} chiuso. Lascia feedback: {{feedback_link}}",
  },
};

const COMMON_VARIABLES: EmailTemplateVariable[] = [
  { token: "{{organization_name}}", description: "Nome dell'organizzazione" },
  { token: "{{support_email}}", description: "Email supporto configurata nelle impostazioni" },
  { token: "{{user_name}}", description: "Nome completo del destinatario" },
  { token: "{{user_email}}", description: "Email del destinatario" },
];

export const EMAIL_TEMPLATE_VARIABLES: Record<EmailEventType, EmailTemplateVariable[]> = {
  invite: [
    ...COMMON_VARIABLES,
    { token: "{{invite_link}}", description: "Link di invito con token" },
  ],
  reset_password: [
    ...COMMON_VARIABLES,
    { token: "{{reset_link}}", description: "Link per impostare una nuova password" },
  ],
  confirm_account: [
    ...COMMON_VARIABLES,
    { token: "{{confirm_link}}", description: "Link di conferma account" },
  ],
  ticket_assigned: [
    ...COMMON_VARIABLES,
    { token: "{{ticket_code}}", description: "Codice del ticket" },
    { token: "{{ticket_title}}", description: "Titolo o sintesi del ticket" },
    { token: "{{ticket_link}}", description: "Link diretto al ticket" },
  ],
  checklist_completed: [
    ...COMMON_VARIABLES,
    { token: "{{checklist_name}}", description: "Nome della checklist completata" },
    { token: "{{ticket_code}}", description: "Codice del ticket collegato" },
    { token: "{{ticket_link}}", description: "Link diretto al ticket" },
  ],
  ticket_completed: [
    ...COMMON_VARIABLES,
    { token: "{{ticket_code}}", description: "Codice del ticket completato" },
    { token: "{{ticket_title}}", description: "Titolo o descrizione del ticket" },
    { token: "{{client_name}}", description: "Nome del cliente" },
    { token: "{{assignee_name}}", description: "Nome del tecnico assegnatario" },
    { token: "{{completed_date}}", description: "Data di completamento" },
    { token: "{{pdf_link}}", description: "Link per scaricare il verbale PDF" },
    { token: "{{portal_link}}", description: "Link al portale clienti" },
  ],
  portal_ticket_created: [
    ...COMMON_VARIABLES,
    { token: "{{contact_name}}", description: "Nome referente cliente" },
    { token: "{{ticket_code}}", description: "Codice ticket" },
    { token: "{{ticket_title}}", description: "Titolo ticket" },
    { token: "{{portal_link}}", description: "Link portale" },
  ],
  portal_ticket_status_changed: [
    ...COMMON_VARIABLES,
    { token: "{{ticket_code}}", description: "Codice ticket" },
    { token: "{{ticket_status}}", description: "Nuovo stato" },
    { token: "{{portal_link}}", description: "Link portale" },
  ],
  portal_public_note_added: [
    ...COMMON_VARIABLES,
    { token: "{{ticket_code}}", description: "Codice ticket" },
    { token: "{{note_excerpt}}", description: "Estratto nota" },
    { token: "{{portal_link}}", description: "Link portale" },
  ],
  portal_ticket_closed_feedback: [
    ...COMMON_VARIABLES,
    { token: "{{ticket_code}}", description: "Codice ticket" },
    { token: "{{feedback_link}}", description: "Link feedback" },
  ],
};
