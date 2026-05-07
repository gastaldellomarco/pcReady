export type EmailEventType =
  | "invite"
  | "reset_password"
  | "confirm_account"
  | "ticket_assigned"
  | "checklist_completed";

export interface EmailTemplateVariable {
  token: string;
  description: string;
}

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
  invite: "Invito nuovo utente",
  reset_password: "Reset password",
  confirm_account: "Conferma account",
  ticket_assigned: "Notifica assegnazione ticket",
  checklist_completed: "Notifica completamento checklist",
};

export const EMAIL_EVENT_TYPES = Object.keys(EMAIL_EVENT_LABELS) as EmailEventType[];

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
};
