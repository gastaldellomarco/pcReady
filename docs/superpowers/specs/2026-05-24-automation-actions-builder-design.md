# Design: Automation Actions Builder

## 1. Panoramica

### Obiettivo
Introdurre una UI a blocchi per le azioni delle automazioni e un selettore di variabili contestuali per compilare i campi dinamici. Sostituisce `ActionsStep.tsx` esistente.

### Scope
- Solo frontend: builder per `actions_definition`
- Nuovi tipi azione: aggiungi commento, crea ticket
- Variabili filtrate per trigger selezionato

### Acceptance Criteria
- [ ] Step "Azioni" mostra elenco di blocchi azione
- [ ] Pulsante "Aggiungi azione" apre menu con 7 tipi: invia email, aggiorna ticket, aggiungi commento, crea ticket, crea notifica, assegna ticket, aggiorna dispositivo
- [ ] Ogni blocco mostra campi specifici (es. per email: A, Oggetto, Corpo)
- [ ] Pulsante "Inserisci variabile" su campi testo con menu variabili per trigger
- [ ] Variabili disponibili filtrate per trigger selezionato
- [ ] Reorder azioni con drag o frecce

---

## 2. Architettura Dati

### 2.1 Nuovi Tipi TypeScript

**File:** `src/domain/automation.ts` (estensione)

```typescript
// Action types as discriminated union
export type AutomationActionType =
  | "send_email"
  | "update_ticket"
  | "add_comment"
  | "create_ticket"
  | "create_notification"
  | "assign_ticket"
  | "update_device";

// Base action interface
export interface AutomationActionBase {
  id: string;
  type: AutomationActionType;
  order: number;
}

// Send Email
export interface SendEmailAction extends AutomationActionBase {
  type: "send_email";
  config: {
    to: string;
    subject: string;
    body: string;
    is_html: boolean;
  };
}

// Update Ticket (consolidated: status, priority, assignee)
export interface UpdateTicketAction extends AutomationActionBase {
  type: "update_ticket";
  config: {
    ticket_id?: string;  // optional - uses trigger context
    status?: "pending" | "in-progress" | "testing" | "ready";
    priority?: "low" | "medium" | "high" | "urgent";
    assignee_id?: string;
  };
}

// Add Comment
export interface AddCommentAction extends AutomationActionBase {
  type: "add_comment";
  config: {
    ticket_id?: string;
    content: string;
    is_internal: boolean;  // true = internal note, false = customer visible
  };
}

// Create Ticket (for scheduled automations)
export interface CreateTicketAction extends AutomationActionBase {
  type: "create_ticket";
  config: {
    title: string;
    description: string;
    customer_id?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    assignee_id?: string;
  };
}

// Create Notification
export interface CreateNotificationAction extends AutomationActionBase {
  type: "create_notification";
  config: {
    user_id?: string;
    type: string;
    title: string;
    body: string;
    link?: string;
  };
}

// Assign Ticket
export interface AssignTicketAction extends AutomationActionBase {
  type: "assign_ticket";
  config: {
    ticket_id?: string;
    assignee_id: string;
  };
}

// Update Device
export interface UpdateDeviceAction extends AutomationActionBase {
  type: "update_device";
  config: {
    device_id?: string;
    status?: "available" | "assigned" | "maintenance" | "retired";
    location_id?: string;
  };
}

// Union type
export type AutomationAction =
  | SendEmailAction
  | UpdateTicketAction
  | AddCommentAction
  | CreateTicketAction
  | CreateNotificationAction
  | AssignTicketAction
  | UpdateDeviceAction;

// Actions container
export interface ActionsList {
  actions: AutomationAction[];
}
```

### 2.2 Variabili Contestuali per Trigger

**File:** `src/domain/automation-variables.ts`

```typescript
export interface AutomationVariable {
  name: string;           // {{ticket.id}}
  label: string;          // "ID Ticket"
  description?: string;   // "Identificativo univoco del ticket"
  type: "string" | "number" | "date" | "email";
}

// Variables available by trigger type
export const VARIABLES_BY_TRIGGER: Record<string, AutomationVariable[]> = {
  ticket_created: [
    { name: "ticket.id", label: "ID Ticket", type: "string" },
    { name: "ticket.code", label: "Codice Ticket", type: "string" },
    { name: "ticket.title", label: "Titolo", type: "string" },
    { name: "ticket.description", label: "Descrizione", type: "string" },
    { name: "ticket.status", label: "Stato", type: "string" },
    { name: "ticket.priority", label: "Priorità", type: "string" },
    { name: "ticket.requester_email", label: "Email Richiedente", type: "email" },
    { name: "ticket.requester_name", label: "Nome Richiedente", type: "string" },
    { name: "customer.id", label: "ID Cliente", type: "string" },
    { name: "customer.name", label: "Nome Cliente", type: "string" },
    { name: "customer.email", label: "Email Cliente", type: "email" },
    { name: "assignee.id", label: "ID Assegnatario", type: "string" },
    { name: "assignee.name", label: "Nome Assegnatario", type: "string" },
    { name: "assignee.email", label: "Email Assegnatario", type: "email" },
    { name: "ticket.created_at", label: "Data Creazione", type: "date" },
    { name: "ticket.url", label: "URL Ticket", type: "string" },
  ],
  ticket_updated: [
    { name: "ticket.id", label: "ID Ticket", type: "string" },
    { name: "ticket.code", label: "Codice Ticket", type: "string" },
    { name: "ticket.title", label: "Titolo", type: "string" },
    { name: "ticket.status", label: "Stato", type: "string" },
    { name: "ticket.priority", label: "Priorità", type: "string" },
    { name: "ticket.requester_email", label: "Email Richiedente", type: "email" },
    { name: "customer.name", label: "Nome Cliente", type: "string" },
    { name: "assignee.name", label: "Nome Assegnatario", type: "string" },
    { name: "ticket.updated_at", label: "Data Aggiornamento", type: "date" },
    { name: "ticket.changes", label: "Campi Modificati", type: "string" },
    { name: "ticket.url", label: "URL Ticket", type: "string" },
  ],
  checklist_completed: [
    { name: "ticket.id", label: "ID Ticket", type: "string" },
    { name: "ticket.title", label: "Titolo", type: "string" },
    { name: "checklist.name", label: "Nome Checklist", type: "string" },
    { name: "checklist.completed_at", label: "Data Completamento", type: "date" },
    { name: "customer.name", label: "Nome Cliente", type: "string" },
    { name: "ticket.url", label: "URL Ticket", type: "string" },
  ],
  sla_warning: [
    { name: "ticket.id", label: "ID Ticket", type: "string" },
    { name: "ticket.title", label: "Titolo", type: "string" },
    { name: "ticket.sla_deadline", label: "Scadenza SLA", type: "date" },
    { name: "ticket.sla_remaining_hours", label: "Ore Rimanenti SLA", type: "number" },
    { name: "customer.name", label: "Nome Cliente", type: "string" },
    { name: "assignee.name", label: "Nome Assegnatario", type: "string" },
    { name: "ticket.url", label: "URL Ticket", type: "string" },
  ],
  sla_breached: [
    { name: "ticket.id", label: "ID Ticket", type: "string" },
    { name: "ticket.title", label: "Titolo", type: "string" },
    { name: "ticket.sla_deadline", label: "Scadenza SLA", type: "date" },
    { name: "ticket.sla_overdue_hours", label: "Ore di Ritardo SLA", type: "number" },
    { name: "customer.name", label: "Nome Cliente", type: "string" },
    { name: "assignee.name", label: "Nome Assegnatario", type: "string" },
    { name: "ticket.url", label: "URL Ticket", type: "string" },
  ],
  warranty_expiring_soon: [
    { name: "device.id", label: "ID Dispositivo", type: "string" },
    { name: "device.name", label: "Nome Dispositivo", type: "string" },
    { name: "device.serial", label: "Numero Seriale", type: "string" },
    { name: "device.warranty_expiry", label: "Scadenza Garanzia", type: "date" },
    { name: "device.warranty_days_remaining", label: "Giorni Rimanenti Garanzia", type: "number" },
    { name: "customer.id", label: "ID Cliente", type: "string" },
    { name: "customer.name", label: "Nome Cliente", type: "string" },
    { name: "customer.email", label: "Email Cliente", type: "email" },
  ],
  warranty_expired: [
    { name: "device.id", label: "ID Dispositivo", type: "string" },
    { name: "device.name", label: "Nome Dispositivo", type: "string" },
    { name: "device.serial", label: "Numero Seriale", type: "string" },
    { name: "device.warranty_expiry", label: "Scadenza Garanzia", type: "date" },
    { name: "device.warranty_days_overdue", label: "Giorni di Ritardo Garanzia", type: "number" },
    { name: "customer.id", label: "ID Cliente", type: "string" },
    { name: "customer.name", label: "Nome Cliente", type: "string" },
  ],
  scheduled: [
    { name: "automation.run_date", label: "Data Esecuzione", type: "date" },
    { name: "automation.run_time", label: "Ora Esecuzione", type: "string" },
  ],
  manual: [
    { name: "user.id", label: "ID Utente che ha avviato", type: "string" },
    { name: "user.name", label: "Nome Utente che ha avviato", type: "string" },
    { name: "automation.run_date", label: "Data Esecuzione", type: "date" },
  ],
};

// Get available variables for a trigger
export function getVariablesForTrigger(triggerType: string): AutomationVariable[] {
  return VARIABLES_BY_TRIGGER[triggerType] || VARIABLES_BY_TRIGGER["ticket_created"] || [];
}

// Insert variable placeholder into text
export function insertVariable(text: string, variable: string, cursorPosition: number): string {
  const before = text.slice(0, cursorPosition);
  const after = text.slice(cursorPosition);
  return `${before}{{${variable}}}${after}`;
}
```

### 2.3 Adattatori (Backward Compatibility)

**File:** `src/lib/automations/action-adapter.ts`

```typescript
import type { ActionDef } from "@/types/automation";
import type { AutomationAction } from "@/domain/automation";

// Convert legacy ActionDef to new AutomationAction
export function fromActionDef(def: ActionDef): AutomationAction {
  const base = {
    id: def.id,
    order: 0,
  };

  switch (def.type) {
    case "send_email":
      return {
        ...base,
        type: "send_email",
        config: {
          to: (def.config?.to as string) || "",
          subject: (def.config?.subject as string) || "",
          body: (def.config?.body as string) || "",
          is_html: (def.config?.is_html as boolean) || false,
        },
      };

    case "update_ticket_status":
      return {
        ...base,
        type: "update_ticket",
        config: {
          ticket_id: (def.config?.ticket_id as string) || "",
          status: (def.config?.status as UpdateTicketAction["config"]["status"]) || undefined,
        },
      };

    case "create_notification":
      return {
        ...base,
        type: "create_notification",
        config: {
          user_id: (def.config?.user_id as string) || "",
          type: (def.config?.type as string) || "ticket_status_changed",
          title: (def.config?.title as string) || "",
          body: (def.config?.body as string) || "",
          link: (def.config?.link as string) || "",
        },
      };

    case "update_device_status":
      return {
        ...base,
        type: "update_device",
        config: {
          device_id: (def.config?.device_id as string) || "",
          status: (def.config?.status as UpdateDeviceAction["config"]["status"]) || undefined,
        },
      };

    case "assign_ticket":
      return {
        ...base,
        type: "assign_ticket",
        config: {
          ticket_id: (def.config?.ticket_id as string) || "",
          assignee_id: (def.config?.assignee_id as string) || "",
        },
      };

    default:
      // Fallback to send_email for unknown types
      return {
        ...base,
        type: "send_email",
        config: { to: "", subject: "", body: "", is_html: false },
      };
  }
}

// Convert new AutomationAction to legacy ActionDef for API
export function toActionDef(action: AutomationAction): ActionDef {
  const base = {
    id: action.id,
  };

  switch (action.type) {
    case "send_email":
      return {
        ...base,
        type: "send_email",
        config: action.config,
      };

    case "update_ticket":
      return {
        ...base,
        type: "update_ticket_status",
        config: {
          ticket_id: action.config.ticket_id,
          status: action.config.status,
          // priority and assignee are stored in extended fields or ignored by API
        },
      };

    case "add_comment":
      // Map to create_notification as fallback for API
      return {
        ...base,
        type: "create_notification",
        config: {
          type: "ticket_comment",
          title: "Nuovo commento",
          body: action.config.content,
        },
      };

    case "create_ticket":
      // This is a new action type - API may not support it yet
      // Store as special notification for now
      return {
        ...base,
        type: "create_notification",
        config: {
          type: "auto_create_ticket",
          title: action.config.title,
          body: action.config.description,
        },
      };

    case "create_notification":
      return {
        ...base,
        type: "create_notification",
        config: action.config,
      };

    case "assign_ticket":
      return {
        ...base,
        type: "assign_ticket",
        config: action.config,
      };

    case "update_device":
      return {
        ...base,
        type: "update_device_status",
        config: {
          device_id: action.config.device_id,
          status: action.config.status,
        },
      };

    default:
      return {
        ...base,
        type: "send_email",
        config: { to: "", subject: "", body: "" },
      };
  }
}

// Convert array
export function fromActionDefs(defs: ActionDef[]): AutomationAction[] {
  return defs.map((def, index) => ({
    ...fromActionDef(def),
    order: index,
  }));
}

export function toActionDefs(actions: AutomationAction[]): ActionDef[] {
  return actions.sort((a, b) => a.order - b.order).map(toActionDef);
}
```

---

## 3. UI Componenti

### 3.1 `AutomationActionsBuilder`

**File:** `src/components/automations/AutomationActionsBuilder.tsx`

```typescript
interface AutomationActionsBuilderProps {
  value: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
  triggerType?: string;  // For filtering available variables
}
```

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Cosa deve succedere?                                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │ 📧 Invia Email                                   │   │
│  │ ─────────────────────────────────────────────── │   │
│  │ A:           [                         ] [🔣]     │   │
│  │ Oggetto:     [                         ] [🔣]     │   │
│  │ Corpo:       [                         ] [🔣]     │   │
│  │ ☑ Corpo è HTML                                    │   │
│  │                                           [🗑️]     │   │
│  └─────────────────────────────────────────────────┘   │
│                      ⬇️                                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🎫 Aggiorna Ticket                               │   │
│  │ ─────────────────────────────────────────────── │   │
│  │ Stato:     [In corso ▼]                          │   │
│  │ Priorità:  [Alta ▼]                              │   │
│  │ Assegnatario: [                         ]        │   │
│  │                                           [🗑️]     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [+ Aggiungi azione]                                    │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Blocchi Azione Specifici

**File:** `src/components/automations/blocks/SendEmailBlock.tsx`
```typescript
interface SendEmailBlockProps {
  action: SendEmailAction;
  onChange: (action: SendEmailAction) => void;
  onRemove: () => void;
  availableVariables: AutomationVariable[];
  isFirst: boolean;
}
```

**File:** `src/components/automations/blocks/UpdateTicketBlock.tsx`
```typescript
interface UpdateTicketBlockProps {
  action: UpdateTicketAction;
  onChange: (action: UpdateTicketAction) => void;
  onRemove: () => void;
  availableVariables: AutomationVariable[];
}
```

**Altri blocchi:**
- `AddCommentBlock.tsx`
- `CreateTicketBlock.tsx`
- `CreateNotificationBlock.tsx`
- `AssignTicketBlock.tsx`
- `UpdateDeviceBlock.tsx`

### 3.3 Selettore Variabili

**File:** `src/components/automations/VariablePicker.tsx`

```typescript
interface VariablePickerProps {
  variables: AutomationVariable[];
  onSelect: (variable: string) => void;
  children: React.ReactNode;  // Trigger button
}
```

**UI:**
- Dropdown/popover con search
- Raggruppate per entità (Ticket, Device, Customer, Assignee)
- Preview: `{{ticket.requester_email}}`
- Click inserisce nel campo attivo

### 3.4 Campo Testo con Variabile

**File:** `src/components/automations/VariableTextField.tsx`

```typescript
interface VariableTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  availableVariables: AutomationVariable[];
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}
```

**UI:**
```
┌─────────────────────────────────────────────────────────┐
│  Oggetto:                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Nuovo ticket da {{customer.name}}              🔣 │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.5 Menu Aggiungi Azione

**Dropdown con icone:**
- 📧 Invia email
- 🎫 Aggiorna ticket
- 💬 Aggiungi commento
- ➕ Crea ticket
- 🔔 Crea notifica
- 👤 Assegna ticket
- 💻 Aggiorna dispositivo

---

## 4. Integrazione Wizard

### 4.1 Sostituzione ActionsStep

**File:** `src/components/automations/steps/ActionsStep.tsx` (completamente sostituito)

```typescript
import { useTranslation } from "react-i18next";
import type { ActionDef } from "@/types/automation";
import type { AutomationAction } from "@/domain/automation";
import { AutomationActionsBuilder } from "../AutomationActionsBuilder";
import { fromActionDefs, toActionDefs } from "@/lib/automations/action-adapter";

interface ActionsStepProps {
  value: ActionDef[];
  onChange: (v: ActionDef[]) => void;
  triggerType?: string;
}

export default function ActionsStep({
  value,
  onChange,
  triggerType,
}: ActionsStepProps) {
  const { t } = useTranslation("automations");

  // Convert legacy to new format
  const actions: AutomationAction[] = fromActionDefs(value || []);

  const handleChange = (newActions: AutomationAction[]) => {
    onChange(toActionDefs(newActions));
  };

  return (
    <div>
      <h3 className="text-lg font-semibold">
        {t("actionsStep.title", "Cosa deve succedere?")}
      </h3>
      <p className="text-sm text-text3">
        {t("actionsStep.description", "Scegli le azioni da eseguire.")}
      </p>

      <div className="mt-4">
        <AutomationActionsBuilder
          value={actions}
          onChange={handleChange}
          triggerType={triggerType}
        />
      </div>
    </div>
  );
}
```

### 4.2 Passaggio Trigger Type

`AutomationWizard` passa `trigger?.type` a `ActionsStep`.

---

## 5. Reorder Azioni

### 5.1 UI Reorder

**Opzioni:**
A) **Drag and drop** — react-beautiful-dnd o @dnd-kit
B) **Frecce su/giù** — più semplice, meno dipendenze
C) **Entrambi** — drag per reorder veloce, frecce per precisione

**Decisione:** Implementare frecce su/giù per semplicità. Drag opzionale futuro.

### 5.2 Implementazione Frecce

```typescript
function moveActionUp(index: number) {
  if (index === 0) return;
  const newActions = [...actions];
  [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
  // Update order property
  newActions.forEach((a, i) => (a.order = i));
  onChange(newActions);
}

function moveActionDown(index: number) {
  if (index >= actions.length - 1) return;
  const newActions = [...actions];
  [newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]];
  newActions.forEach((a, i) => (a.order = i));
  onChange(newActions);
}
```

---

## 6. Copy i18n

### 6.1 Nuove Chiavi

```json
{
  "actionsBuilder": {
    "title": "Cosa deve succedere?",
    "description": "Scegli le azioni da eseguire quando il trigger e i filtri sono soddisfatti.",
    "addAction": "+ Aggiungi azione",
    "noActions": "Nessuna azione configurata. Aggiungi almeno un'azione.",
    "reorder": {
      "up": "Sposta su",
      "down": "Sposta giù",
      "order": "Ordine"
    },
    "actionTypes": {
      "send_email": "Invia email",
      "update_ticket": "Aggiorna ticket",
      "add_comment": "Aggiungi commento",
      "create_ticket": "Crea ticket",
      "create_notification": "Crea notifica",
      "assign_ticket": "Assegna ticket",
      "update_device": "Aggiorna dispositivo"
    },
    "blocks": {
      "send_email": {
        "title": "Invia email",
        "to": "A",
        "subject": "Oggetto",
        "body": "Corpo",
        "isHtml": "Corpo è HTML"
      },
      "update_ticket": {
        "title": "Aggiorna ticket",
        "ticketId": "ID Ticket (opzionale)",
        "status": "Stato",
        "priority": "Priorità",
        "assignee": "Assegnatario"
      },
      "add_comment": {
        "title": "Aggiungi commento",
        "ticketId": "ID Ticket (opzionale)",
        "content": "Contenuto",
        "isInternal": "Nota interna (non visibile al cliente)"
      },
      "create_ticket": {
        "title": "Crea ticket",
        "titleField": "Titolo",
        "description": "Descrizione",
        "customer": "Cliente",
        "priority": "Priorità",
        "assignee": "Assegnatario"
      },
      "create_notification": {
        "title": "Crea notifica",
        "user": "Utente",
        "type": "Tipo",
        "titleField": "Titolo",
        "body": "Messaggio",
        "link": "Link (opzionale)"
      },
      "assign_ticket": {
        "title": "Assegna ticket",
        "ticketId": "ID Ticket (opzionale)",
        "assignee": "Assegnatario"
      },
      "update_device": {
        "title": "Aggiorna dispositivo",
        "deviceId": "ID Dispositivo (opzionale)",
        "status": "Stato",
        "location": "Sede"
      }
    },
    "variablePicker": {
      "title": "Inserisci variabile",
      "search": "Cerca variabili...",
      "groups": {
        "ticket": "Ticket",
        "device": "Dispositivo",
        "customer": "Cliente",
        "assignee": "Assegnatario",
        "automation": "Automazione"
      },
      "insert": "Inserisci {{variable}}"
    }
  }
}
```

---

## 7. File da Creare/Modificare

### 7.1 Nuovi File

| File | Scopo |
|------|-------|
| `src/domain/automation.ts` | Estendere con tipi `AutomationAction` |
| `src/domain/automation-variables.ts` | Definizione variabili per trigger |
| `src/lib/automations/action-adapter.ts` | Adattatori da/verso `ActionDef` |
| `src/components/automations/AutomationActionsBuilder.tsx` | Componente builder principale |
| `src/components/automations/VariablePicker.tsx` | Selettore variabili |
| `src/components/automations/VariableTextField.tsx` | Campo testo con picker |
| `src/components/automations/blocks/SendEmailBlock.tsx` | Blocco invia email |
| `src/components/automations/blocks/UpdateTicketBlock.tsx` | Blocco aggiorna ticket |
| `src/components/automations/blocks/AddCommentBlock.tsx` | Blocco aggiungi commento |
| `src/components/automations/blocks/CreateTicketBlock.tsx` | Blocco crea ticket |
| `src/components/automations/blocks/CreateNotificationBlock.tsx` | Blocco crea notifica |
| `src/components/automations/blocks/AssignTicketBlock.tsx` | Blocco assegna ticket |
| `src/components/automations/blocks/UpdateDeviceBlock.tsx` | Blocco aggiorna dispositivo |
| `src/components/automations/ActionTypeSelector.tsx` | Menu selezione tipo azione |

### 7.2 File da Modificare

| File | Modifiche |
|------|-----------|
| `src/components/automations/steps/ActionsStep.tsx` | Sostituire con nuova implementazione |
| `src/components/automations/AutomationWizard.tsx` | Passare `trigger?.type` a `ActionsStep` |
| `src/i18n/locales/it/automations.json` | Aggiungere chiavi `actionsBuilder.*` |
| `src/types/automation.ts` | Nessuna modifica (backward compat) |

---

## 8. Note Implementative

### 8.1 Variabili nei Campi

- Il picker si apre con click su 🔣 o shortcut `/`
- Inserisce `{{variable.name}}` alla posizione cursore
- Evidenzia variabili inserite con stile speciale (opzionale)

### 8.2 Campi Opzionali (ticket_id, device_id)

- Label include "(opzionale)"
- Vuoto = usa contesto dal trigger
- Placeholder: "Lascia vuoto per usare il ticket dal trigger"

### 8.3 Nuove Azioni vs API

- `add_comment` e `create_ticket` sono nuovi — API potrebbe non supportarli ancora
- Gli adattatori mappano su `create_notification` come fallback
- Quando API supporta, aggiornare solo gli adattatori

---

## 9. Checklist Pre-Implementazione

- [ ] Design approvato da utente
- [ ] Piano implementazione scritto
- [ ] File da creare/modificare identificati
- [ ] Copy italiano pronto per review

---

*Design creato: 2026-05-24*  
*Stato: In attesa approvazione*
