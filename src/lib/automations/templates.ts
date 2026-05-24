import type { WizardFlowPayload } from "@/types/automation";

export type TemplateCategory = "notification" | "status" | "schedule" | "urgency";

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: TemplateCategory;
  defaultPayload: Partial<WizardFlowPayload>;
}

function uid(prefix = "t"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "new-ticket-email",
    name: "Notifica email nuovo ticket",
    description: "Invia una email ogni volta che viene creato un nuovo ticket",
    icon: "Mail",
    category: "notification",
    defaultPayload: {
      name: "Notifica nuovo ticket",
      description: "Invia email al team quando viene creato un nuovo ticket",
      category: "Notifica",
      trigger_definition: { type: "ticket_created", config: {} },
      conditions_definition: [],
      actions_definition: [
        {
          id: uid("a"),
          type: "send_email",
          config: {
            to: "",
            subject: "Nuovo ticket creato: {{ticket_title}}",
            body: "È stato creato un nuovo ticket.\n\nTitolo: {{ticket_title}}\nID: {{ticket_id}}\n\nVisualizza il ticket nella dashboard.",
            is_html: false,
          },
        },
      ],
    },
  },
  {
    id: "urgent-ticket-alert",
    name: "Ticket urgente → avvisa tecnico",
    description: "Notifica immediata quando arriva un ticket con priorità alta",
    icon: "AlertTriangle",
    category: "urgency",
    defaultPayload: {
      name: "Alert ticket urgente",
      description: "Avvisa il team quando arriva un ticket urgente",
      category: "Notifica",
      trigger_definition: { type: "ticket_created", config: {} },
      conditions_definition: [
        {
          id: uid("c"),
          type: "priority_high",
          config: {},
        },
      ],
      actions_definition: [
        {
          id: uid("a"),
          type: "create_notification",
          config: {
            type: "ticket_urgent",
            title: "🚨 Ticket urgente!",
            body: "È stato creato un ticket con priorità alta: {{ticket_title}}",
            link: "/tickets/{{ticket_id}}",
          },
        },
      ],
    },
  },
  {
    id: "sla-warning",
    name: "Ticket in scadenza SLA",
    description: "Avviso quando un ticket si avvicina alla scadenza SLA",
    icon: "Clock",
    category: "schedule",
    defaultPayload: {
      name: "Alert scadenza SLA",
      description: "Notifica quando un ticket sta per violare lo SLA",
      category: "Notifica",
      trigger_definition: { type: "sla_warning", config: {} },
      conditions_definition: [],
      actions_definition: [
        {
          id: uid("a"),
          type: "send_email",
          config: {
            to: "",
            subject: "⚠️ SLA in scadenza: {{ticket_title}}",
            body: "Il ticket {{ticket_title}} sta per superare il limite SLA.\n\nIntervieni prima della scadenza.",
            is_html: false,
          },
        },
      ],
    },
  },
  {
    id: "warranty-expiring",
    name: "Dispositivo in scadenza garanzia",
    description: "Notifica 30 giorni prima della scadenza garanzia dispositivo",
    icon: "ShieldAlert",
    category: "schedule",
    defaultPayload: {
      name: "Alert scadenza garanzia",
      description: "Avvisa quando la garanzia di un dispositivo sta per scadere",
      category: "Notifica",
      trigger_definition: { type: "warranty_expiring_soon", config: { days: 30 } },
      conditions_definition: [],
      actions_definition: [
        {
          id: uid("a"),
          type: "send_email",
          config: {
            to: "",
            subject: "🔔 Garanzia in scadenza: {{device_name}}",
            body: "La garanzia del dispositivo {{device_name}} scade tra 30 giorni.\n\nVerifica lo stato e valuta un eventuale rinnovo.",
            is_html: false,
          },
        },
      ],
    },
  },
  {
    id: "inactive-ticket",
    name: "Ticket inattivo da N giorni",
    description: "Controlla giornalmente e notifica i ticket senza attività",
    icon: "Timer",
    category: "schedule",
    defaultPayload: {
      name: "Reminder ticket inattivo",
      description: "Notifica i ticket senza attività da più di 7 giorni",
      category: "Schedulazione",
      trigger_definition: { type: "scheduled", config: { cron: "0 9 * * *" } },
      conditions_definition: [
        {
          id: uid("c"),
          type: "field_greater_than",
          config: { field: "days_since_last_activity", value: "7" },
        },
      ],
      actions_definition: [
        {
          id: uid("a"),
          type: "send_email",
          config: {
            to: "",
            subject: "⏸️ Ticket inattivo: {{ticket_title}}",
            body: "Il ticket {{ticket_title}} è inattivo da più di 7 giorni.\n\nConsidera di aggiornare lo stato o chiuderlo.",
            is_html: false,
          },
        },
      ],
    },
  },
  {
    id: "weekly-report",
    name: "Report settimanale ticket",
    description: "Invia un riepilogo settimanale dei ticket aperti",
    icon: "BarChart3",
    category: "schedule",
    defaultPayload: {
      name: "Report settimanale",
      description: "Invia report riepilogativo dei ticket ogni lunedì mattina",
      category: "Schedulazione",
      trigger_definition: { type: "scheduled", config: { cron: "0 9 * * 1" } },
      conditions_definition: [],
      actions_definition: [
        {
          id: uid("a"),
          type: "send_email",
          config: {
            to: "",
            subject: "📊 Report settimanale ticket - {{date}}",
            body: "Ecco il riepilogo settimanale dei ticket:\n\n- Ticket aperti: {{open_count}}\n- Ticket chiusi: {{closed_count}}\n- Ticket urgenti: {{urgent_count}}\n\nAccedi alla dashboard per i dettagli.",
            is_html: false,
          },
        },
      ],
    },
  },
];

export const TEMPLATE_CATEGORIES: Record<TemplateCategory, { label: string; color: string }> = {
  notification: { label: "Notifica", color: "bg-blue-100 text-blue-700" },
  status: { label: "Stato", color: "bg-green-100 text-green-700" },
  schedule: { label: "Schedulazione", color: "bg-purple-100 text-purple-700" },
  urgency: { label: "Urgenza", color: "bg-red-100 text-red-700" },
};

export function getTemplateById(id: string): AutomationTemplate | undefined {
  return AUTOMATION_TEMPLATES.find((t) => t.id === id);
}
