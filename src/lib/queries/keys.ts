export const QUERY_KEYS = {
  tickets: ["tickets"] as const,
  ticket: (id: string) => ["tickets", id] as const,
  clients: ["clients"] as const,
  clientContacts: (clientId: string) => ["clients", clientId, "contacts"] as const,
  devices: (clientId: string) => ["clients", clientId, "devices"] as const,
  checklistTemplates: ["checklist_templates"] as const,
  scripts: ["scripts"] as const,
  inventory: ["inventory"] as const,
  dashboard: ["dashboard"] as const,
  automationFlows: ["automation_flows"] as const,
} as const;

export type QueryKeys = typeof QUERY_KEYS;
