// ─── Tipi e costanti condivisi per template email legacy ──────────
// Usato sia da email-templates.ts (client/server-fn wrapper)
// che da email-templates.server.ts (logica Supabase).

export type LegacyEmailTemplate = {
  id: string;
  subject: string;
  body: string;
};

export const LEGACY_TEMPLATES: LegacyEmailTemplate[] = [
  {
    id: "ticket-assigned",
    subject: "Ticket {{ticket_code}} assegnato",
    body: "Ciao {{assignee_name}}, il ticket {{ticket_code}} per {{client_name}} ti e' stato assegnato.",
  },
];

/**
 * Restituisce i template legacy (pre-DB) usati come fallback.
 */
export function getTemplates() {
  return LEGACY_TEMPLATES;
}

export function renderTemplate(template: string, values: Record<string, string>): string;
export function renderTemplate(
  template: LegacyEmailTemplate,
  values: Record<string, string>,
): { subject: string; body: string };
/**
 * Sostituisce le variabili {{nome}} in un template stringa o in un
 * LegacyEmailTemplate (subject + body).
 */
export function renderTemplate(
  template: string | LegacyEmailTemplate,
  values: Record<string, string>,
) {
  if (typeof template === "string") {
    return replaceVariables(template, values);
  }

  return {
    subject: replaceVariables(template.subject, values),
    body: replaceVariables(template.body, values),
  };
}

function replaceVariables(template: string, values: Record<string, string>) {
  return template.replace(/\{\{[a-z0-9_]+\}\}/gi, (token) => {
    const bareToken = token.slice(2, -2);
    return values[token] ?? values[bareToken] ?? token;
  });
}
