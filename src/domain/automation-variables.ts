// Automation variables available for interpolation in action fields
// Variables are scoped by trigger type - only relevant variables are shown

export interface AutomationVariable {
  name: string; // {{ticket.id}}
  label: string; // "ID Ticket"
  description?: string;
  type: "string" | "number" | "date" | "email";
  category: "ticket" | "device" | "customer" | "assignee" | "checklist" | "automation" | "user";
}

// Variables available by trigger type
export const VARIABLES_BY_TRIGGER: Record<string, AutomationVariable[]> = {
  ticket_created: [
    { name: "ticket.id", label: "ID Ticket", type: "string", category: "ticket" },
    { name: "ticket.code", label: "Codice Ticket", type: "string", category: "ticket" },
    { name: "ticket.title", label: "Titolo", type: "string", category: "ticket" },
    { name: "ticket.description", label: "Descrizione", type: "string", category: "ticket" },
    { name: "ticket.status", label: "Stato", type: "string", category: "ticket" },
    { name: "ticket.priority", label: "Priorità", type: "string", category: "ticket" },
    { name: "ticket.requester_email", label: "Email Richiedente", type: "email", category: "ticket" },
    { name: "ticket.requester_name", label: "Nome Richiedente", type: "string", category: "ticket" },
    { name: "customer.id", label: "ID Cliente", type: "string", category: "customer" },
    { name: "customer.name", label: "Nome Cliente", type: "string", category: "customer" },
    { name: "customer.email", label: "Email Cliente", type: "email", category: "customer" },
    { name: "assignee.id", label: "ID Assegnatario", type: "string", category: "assignee" },
    { name: "assignee.name", label: "Nome Assegnatario", type: "string", category: "assignee" },
    { name: "assignee.email", label: "Email Assegnatario", type: "email", category: "assignee" },
    { name: "ticket.created_at", label: "Data Creazione", type: "date", category: "ticket" },
    { name: "ticket.url", label: "URL Ticket", type: "string", category: "ticket" },
  ],
  ticket_updated: [
    { name: "ticket.id", label: "ID Ticket", type: "string", category: "ticket" },
    { name: "ticket.code", label: "Codice Ticket", type: "string", category: "ticket" },
    { name: "ticket.title", label: "Titolo", type: "string", category: "ticket" },
    { name: "ticket.status", label: "Stato", type: "string", category: "ticket" },
    { name: "ticket.priority", label: "Priorità", type: "string", category: "ticket" },
    { name: "ticket.requester_email", label: "Email Richiedente", type: "email", category: "ticket" },
    { name: "customer.name", label: "Nome Cliente", type: "string", category: "customer" },
    { name: "assignee.name", label: "Nome Assegnatario", type: "string", category: "assignee" },
    { name: "ticket.updated_at", label: "Data Aggiornamento", type: "date", category: "ticket" },
    { name: "ticket.changes", label: "Campi Modificati", type: "string", category: "ticket" },
    { name: "ticket.url", label: "URL Ticket", type: "string", category: "ticket" },
  ],
  checklist_completed: [
    { name: "ticket.id", label: "ID Ticket", type: "string", category: "ticket" },
    { name: "ticket.title", label: "Titolo", type: "string", category: "ticket" },
    { name: "checklist.name", label: "Nome Checklist", type: "string", category: "checklist" },
    { name: "checklist.completed_at", label: "Data Completamento", type: "date", category: "checklist" },
    { name: "customer.name", label: "Nome Cliente", type: "string", category: "customer" },
    { name: "ticket.url", label: "URL Ticket", type: "string", category: "ticket" },
  ],
  sla_warning: [
    { name: "ticket.id", label: "ID Ticket", type: "string", category: "ticket" },
    { name: "ticket.title", label: "Titolo", type: "string", category: "ticket" },
    { name: "ticket.sla_deadline", label: "Scadenza SLA", type: "date", category: "ticket" },
    { name: "ticket.sla_remaining_hours", label: "Ore Rimanenti SLA", type: "number", category: "ticket" },
    { name: "customer.name", label: "Nome Cliente", type: "string", category: "customer" },
    { name: "assignee.name", label: "Nome Assegnatario", type: "string", category: "assignee" },
    { name: "ticket.url", label: "URL Ticket", type: "string", category: "ticket" },
  ],
  sla_breached: [
    { name: "ticket.id", label: "ID Ticket", type: "string", category: "ticket" },
    { name: "ticket.title", label: "Titolo", type: "string", category: "ticket" },
    { name: "ticket.sla_deadline", label: "Scadenza SLA", type: "date", category: "ticket" },
    { name: "ticket.sla_overdue_hours", label: "Ore di Ritardo SLA", type: "number", category: "ticket" },
    { name: "customer.name", label: "Nome Cliente", type: "string", category: "customer" },
    { name: "assignee.name", label: "Nome Assegnatario", type: "string", category: "assignee" },
    { name: "ticket.url", label: "URL Ticket", type: "string", category: "ticket" },
  ],
  warranty_expiring_soon: [
    { name: "device.id", label: "ID Dispositivo", type: "string", category: "device" },
    { name: "device.name", label: "Nome Dispositivo", type: "string", category: "device" },
    { name: "device.serial", label: "Numero Seriale", type: "string", category: "device" },
    { name: "device.warranty_expiry", label: "Scadenza Garanzia", type: "date", category: "device" },
    { name: "device.warranty_days_remaining", label: "Giorni Rimanenti Garanzia", type: "number", category: "device" },
    { name: "customer.id", label: "ID Cliente", type: "string", category: "customer" },
    { name: "customer.name", label: "Nome Cliente", type: "string", category: "customer" },
    { name: "customer.email", label: "Email Cliente", type: "email", category: "customer" },
  ],
  warranty_expired: [
    { name: "device.id", label: "ID Dispositivo", type: "string", category: "device" },
    { name: "device.name", label: "Nome Dispositivo", type: "string", category: "device" },
    { name: "device.serial", label: "Numero Seriale", type: "string", category: "device" },
    { name: "device.warranty_expiry", label: "Scadenza Garanzia", type: "date", category: "device" },
    { name: "device.warranty_days_overdue", label: "Giorni di Ritardo Garanzia", type: "number", category: "device" },
    { name: "customer.id", label: "ID Cliente", type: "string", category: "customer" },
    { name: "customer.name", label: "Nome Cliente", type: "string", category: "customer" },
  ],
  scheduled: [
    { name: "automation.run_date", label: "Data Esecuzione", type: "date", category: "automation" },
    { name: "automation.run_time", label: "Ora Esecuzione", type: "string", category: "automation" },
  ],
  manual: [
    { name: "user.id", label: "ID Utente che ha avviato", type: "string", category: "user" },
    { name: "user.name", label: "Nome Utente che ha avviato", type: "string", category: "user" },
    { name: "automation.run_date", label: "Data Esecuzione", type: "date", category: "automation" },
  ],
};

// Category labels for UI
export const VARIABLE_CATEGORIES: Record<AutomationVariable["category"], string> = {
  ticket: "Ticket",
  device: "Dispositivo",
  customer: "Cliente",
  assignee: "Assegnatario",
  checklist: "Checklist",
  automation: "Automazione",
  user: "Utente",
};

// Get available variables for a trigger
export function getVariablesForTrigger(triggerType: string): AutomationVariable[] {
  return VARIABLES_BY_TRIGGER[triggerType] || VARIABLES_BY_TRIGGER["ticket_created"] || [];
}

// Group variables by category
export function groupVariablesByCategory(
  variables: AutomationVariable[]
): Record<string, AutomationVariable[]> {
  return variables.reduce((groups, variable) => {
    const category = VARIABLE_CATEGORIES[variable.category];
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(variable);
    return groups;
  }, {} as Record<string, AutomationVariable[]>);
}

// Insert variable placeholder into text at cursor position
export function insertVariable(
  text: string,
  variableName: string,
  cursorPosition: number
): { newText: string; newCursorPosition: number } {
  const placeholder = `{{${variableName}}}`;
  const before = text.slice(0, cursorPosition);
  const after = text.slice(cursorPosition);
  const newText = `${before}${placeholder}${after}`;
  const newCursorPosition = cursorPosition + placeholder.length;
  return { newText, newCursorPosition };
}

// Search variables by query
export function searchVariables(
  variables: AutomationVariable[],
  query: string
): AutomationVariable[] {
  const lowerQuery = query.toLowerCase();
  return variables.filter(
    (v) =>
      v.name.toLowerCase().includes(lowerQuery) ||
      v.label.toLowerCase().includes(lowerQuery)
  );
}
