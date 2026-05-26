export function getEntityLabel(entityType?: string | null): string {
  if (!entityType) return "N/A";

  const map: Record<string, string> = {
    // core entities
    ticket: "Ticket",
    tickets: "Ticket",
    client: "Cliente",
    client_contact: "Contatto cliente",
    device: "Dispositivo",
    user: "Utente",
    technician: "Tecnico",
    automation: "Automazione",
    system: "Sistema",
    oauth: "OAuth",
    oauth_client: "Client OAuth",
    oauth_clients: "Client OAuth",
    setting: "Impostazione",
    settings: "Impostazioni",
    email_template: "Template email",
    checklist: "Checklist",
    ticket_checklist_instance: "Istanza checklist",
    bundle: "Bundle",
    attachment: "Allegato",
    invoice: "Fattura",
    payment: "Pagamento",
    mfa: "MFA",
    license: "Licenza",
    // legacy / alternate
    client_contact_request: "Richiesta contatto cliente",
  };

  if (map[entityType]) return map[entityType];

  // Fallback: humanize snake_case / kebab-case identifiers
  const tokenMap: Record<string, string> = {
    client: "Cliente",
    contact: "Contatto",
    contacts: "Contatti",
    ticket: "Ticket",
    tickets: "Ticket",
    device: "Dispositivo",
    user: "Utente",
    users: "Utenti",
    technician: "Tecnico",
    automation: "Automazione",
    oauth: "OAuth",
    setting: "Impostazione",
    settings: "Impostazioni",
    email: "Email",
    template: "Template",
    checklist: "Checklist",
    bundle: "Bundle",
    attachment: "Allegato",
    invoice: "Fattura",
    payment: "Pagamento",
    mfa: "MFA",
    license: "Licenza",
  };

  const parts = entityType.split(/[_\-\s]+/).filter(Boolean);
  const translated = parts.map((p) => tokenMap[p.toLowerCase()] ?? capitalize(p));
  return translated.join(" ");
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default getEntityLabel;
