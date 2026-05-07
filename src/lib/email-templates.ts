export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "ticket-assigned",
    name: "Ticket assegnato",
    subject: "Ticket {{ticket_code}} assegnato",
    body: "Ciao {{assignee_name}}, il ticket {{ticket_code}} per {{client_name}} ti e' stato assegnato.",
  },
  {
    id: "device-ready",
    name: "Dispositivo pronto",
    subject: "Dispositivo {{serial}} pronto",
    body: "Il dispositivo {{model}} ({{serial}}) e' pronto per {{client_name}}.",
  },
];

export function getTemplates(): EmailTemplate[] {
  return EMAIL_TEMPLATES.map((template) => ({ ...template }));
}

export function renderTemplate(template: EmailTemplate, variables: Record<string, unknown>) {
  return {
    subject: renderString(template.subject, variables),
    body: renderString(template.body, variables),
  };
}

function renderString(input: string, variables: Record<string, unknown>) {
  return input.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value === null || value === undefined ? "" : String(value);
  });
}
