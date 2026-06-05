# Design: Automation Conditions Builder Avanzato

## 1. Panoramica

### Obiettivo

Introdurre una UI esplicita per i filtri delle automazioni: righe di condizioni con campo, operatore e valore, e scelta tra combinazione AND/OR. Sostituisce il `FiltersStep.tsx` esistente nel wizard.

### Scope

- Solo lato frontend
- Genera `conditions_definition` coerente con il nuovo tipo `AutomationCondition`
- Backward compatibility con automazioni esistenti

### Acceptance Criteria

- [ ] Step "Filtri" mostra elenco condizioni: [Campo] [Operatore] [Valore] [X]
- [ ] Campi disponibili: ticket.status, ticket.priority, ticket.customer_id, ticket.assignee_id, device.customer_id, device.location_id
- [ ] Operatori: eq, neq, contains, gt, lt, in
- [ ] Toggle AND/OR globale
- [ ] Salvataggio produce `conditions_definition` tipizzato

---

## 2. Architettura Dati

### 2.1 Nuovi Tipi TypeScript

**File:** `src/domain/automation.ts` (nuovo)

```typescript
export type ConditionOperator = "eq" | "neq" | "contains" | "gt" | "lt" | "in";
export type ConditionLogic = "AND" | "OR";
export type ValueType = "string" | "number" | "list" | "reference";

export interface AutomationCondition {
  id: string;
  field: string; // ticket.status, ticket.priority, ecc.
  operator: ConditionOperator;
  value: string | number | string[];
  valueType: ValueType;
  label?: string; // label user-friendly (opzionale)
}

export interface ConditionsGroup {
  conditions: AutomationCondition[];
  logic: ConditionLogic;
}
```

### 2.2 Definizione Campi Disponibili

```typescript
export const AUTOMATION_CONDITION_FIELDS = [
  // Ticket fields
  { value: "ticket.status", label: "Stato ticket", type: "select", entity: "ticket" },
  { value: "ticket.priority", label: "Priorità ticket", type: "select", entity: "ticket" },
  { value: "ticket.customer_id", label: "Cliente (ticket)", type: "reference", entity: "ticket" },
  { value: "ticket.assignee_id", label: "Assegnatario", type: "reference", entity: "ticket" },
  // Device fields
  {
    value: "device.customer_id",
    label: "Cliente (dispositivo)",
    type: "reference",
    entity: "device",
  },
  { value: "device.location_id", label: "Sede dispositivo", type: "reference", entity: "device" },
] as const;

export type AutomationConditionField = (typeof AUTOMATION_CONDITION_FIELDS)[number]["value"];
```

### 2.3 Operatori per Tipo Campo

| Tipo Campo  | Operatori disponibili |
| ----------- | --------------------- |
| `string`    | eq, neq, contains     |
| `number`    | eq, neq, gt, lt       |
| `select`    | eq, neq, in           |
| `reference` | eq, neq, in           |

### 2.4 Adattatori (Backward Compatibility)

**File:** `src/lib/automations/condition-adapter.ts`

```typescript
import type { ConditionDef } from "@/types/automation";
import type { AutomationCondition, ConditionsGroup } from "@/domain/automation";

// Mappa ConditionDef legacy → AutomationCondition
export function fromConditionDef(def: ConditionDef): AutomationCondition {
  const operatorMap: Record<string, ConditionOperator> = {
    field_equals: "eq",
    field_not_equals: "neq",
    field_greater_than: "gt",
    field_less_than: "lt",
    field_contains: "contains",
    priority_high: "eq",
    tag_contains: "contains",
  };

  const fieldMap: Record<string, string> = {
    priority_high: "ticket.priority",
    tag_contains: "ticket.tags",
  };

  return {
    id: def.id,
    field: fieldMap[def.type] || def.config?.field || "",
    operator: operatorMap[def.type] || "eq",
    value: def.config?.value || "",
    valueType: "string",
  };
}

// Converte array ConditionDef → ConditionsGroup
export function fromConditionDefs(defs: ConditionDef[]): ConditionsGroup {
  return {
    conditions: defs.map(fromConditionDef),
    logic: "AND", // Legacy assume AND implicito
  };
}

// Mappa AutomationCondition → ConditionDef per API
export function toConditionDef(cond: AutomationCondition): ConditionDef {
  const typeMap: Record<ConditionOperator, string> = {
    eq: "field_equals",
    neq: "field_not_equals",
    gt: "field_greater_than",
    lt: "field_less_than",
    contains: "field_contains",
    in: "field_equals", // "in" viene gestito come multipli field_equals con OR
  };

  return {
    id: cond.id,
    type: typeMap[cond.operator] as ConditionDef["type"],
    config: {
      field: cond.field,
      value: Array.isArray(cond.value) ? cond.value.join(",") : String(cond.value),
    },
  };
}

// Converte ConditionsGroup → array ConditionDef per API
export function toConditionDefs(group: ConditionsGroup): ConditionDef[] {
  // Per "OR", espande condizioni "in" in multiple field_equals
  if (group.logic === "OR" && group.conditions.length > 0) {
    const expanded: ConditionDef[] = [];
    for (const cond of group.conditions) {
      if (cond.operator === "in" && Array.isArray(cond.value)) {
        // Crea una condizione per ogni valore
        for (const val of cond.value) {
          expanded.push({
            id: `${cond.id}-${val}`,
            type: "field_equals",
            config: { field: cond.field, value: val },
          });
        }
      } else {
        expanded.push(toConditionDef(cond));
      }
    }
    return expanded;
  }

  return group.conditions.map(toConditionDef);
}
```

---

## 3. UI Componente

### 3.1 `AutomationConditionsBuilder`

**File:** `src/components/automations/AutomationConditionsBuilder.tsx`

**Props:**

```typescript
interface AutomationConditionsBuilderProps {
  value?: ConditionsGroup;
  onChange: (group: ConditionsGroup) => void;
  triggerName?: string; // Per contestualizzare campi disponibili
}
```

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Quando queste condizioni sono soddisfatte:            │
│                                                         │
│  [● Tutte devono essere vere (AND)]  ○ Basta una (OR) │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Campo ▼] [Operatore ▼] [Valore     ] [🗑️]     │   │
│  │ Stato ticket  |  è  |  in attesa                 │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ [Campo ▼] [Operatore ▼] [Valore     ] [🗑️]     │   │
│  │ Priorità    |  in elenco | [alta ▼] [urgente ▼] │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [+ Aggiungi condizione]                                │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Selettore Campo

- Dropdown con `optgroup` per Ticket e Device
- Mostra label user-friendly, value è il field tecnico
- Filtra campi in base al trigger (es. se trigger è device-related, mostra device fields prima)

### 3.3 Selettore Operatore

- Dropdown dinamico basato sul `type` del campo selezionato
- Disabilita operatori non applicabili

### 3.4 Input Valore

**Per tipo `string`:**

- Text input standard
- Placeholder: "Inserisci valore"

**Per tipo `number`:**

- Number input con step
- Validazione min/max se applicabile

**Per tipo `select` (ticket.status, ticket.priority):**

- Dropdown con opzioni predefinite
- ticket.status: "pending", "in-progress", "testing", "ready"
- ticket.priority: "low", "medium", "high", "urgent"

**Per tipo `reference`:**

- Async select con ricerca
- Per customer_id: ricerca clienti
- Per assignee_id: ricerca tecnici
- Per location_id: ricerca sedi

**Per operatore `in`:**

- Multi-select con chip
- Permette selezione multipla valori

### 3.5 Gestione AND/OR

**Radio group:**

- **AND** (default): Tutte le condizioni devono essere vere
- **OR**: Basta che una condizione sia vera

**Comportamento:**

- Visualizza "E" tra le righe condizione quando AND
- Visualizza "OPPURE" tra le righe quando OR
- Cambio toggle non perde condizioni esistenti

---

## 4. Integrazione Wizard

### 4.1 Sostituzione FiltersStep

`src/components/automations/steps/FiltersStep.tsx` viene completamente sostituito:

```typescript
import { AutomationConditionsBuilder } from "../AutomationConditionsBuilder";
import { fromConditionDefs, toConditionDefs } from "@/lib/automations/condition-adapter";

export default function FiltersStep({
  value,
  onChange,
  triggerName,
}: {
  value: ConditionDef[];
  onChange: (v: ConditionDef[]) => void;
  triggerName?: string;
}) {
  const { t } = useTranslation("automations");

  // Converte da/verso ConditionDef per backward compat
  const group = fromConditionDefs(value || []);

  const handleChange = (newGroup: ConditionsGroup) => {
    onChange(toConditionDefs(newGroup));
  };

  return (
    <div>
      <h3 className="text-lg font-semibold">
        {t("filtersStep.title", "Sotto quali condizioni?")}
      </h3>
      <p className="text-sm text-text3">
        {t("filtersStep.description", "Opzionale — filtra solo i casi che corrispondono ai criteri.")}
      </p>

      <div className="mt-4">
        <AutomationConditionsBuilder
          value={group}
          onChange={handleChange}
          triggerName={triggerName}
        />
      </div>
    </div>
  );
}
```

### 4.2 Prop Drilling

`AutomationWizard` passa `triggerName` a `FiltersStep` per contestualizzare campi disponibili.

---

## 5. Stato Vuoto

Quando non ci sono condizioni:

```
┌─────────────────────────────────────────────────────────┐
│  Quando queste condizioni sono soddisfatte:            │
│  [● Tutte devono essere vere (AND)]                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📝 Nessun filtro configurato                   │   │
│  │                                                 │   │
│  │  L'automazione si attiverà per ogni {{trigger}}│   │
│  │                                                 │   │
│  │  [+ Aggiungi la prima condizione]              │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Copy i18n

### 6.1 Nuove Chiavi

```json
{
  "conditionsBuilder": {
    "title": "Sotto quali condizioni?",
    "description": "Opzionale — filtra solo i casi che corrispondono ai criteri. Esempio: solo ticket urgenti del cliente X.",
    "whenConditions": "Quando queste condizioni sono soddisfatte:",
    "logic": {
      "and": "Tutte devono essere vere (AND)",
      "or": "Basta che una sia vera (OR)"
    },
    "emptyState": {
      "title": "Nessun filtro configurato",
      "description": "L'automazione si attiverà per ogni {{trigger}}",
      "addFirst": "+ Aggiungi la prima condizione"
    },
    "field": {
      "placeholder": "Seleziona campo",
      "groups": {
        "ticket": "Ticket",
        "device": "Dispositivo"
      }
    },
    "operator": {
      "placeholder": "Operatore",
      "eq": "è",
      "neq": "non è",
      "contains": "contiene",
      "gt": "maggiore di",
      "lt": "minore di",
      "in": "in elenco"
    },
    "value": {
      "placeholder": "Valore",
      "placeholderString": "Inserisci testo",
      "placeholderNumber": "Inserisci numero",
      "addItem": "+ Aggiungi",
      "removeItem": "Rimuovi"
    },
    "actions": {
      "addCondition": "+ Aggiungi condizione",
      "removeCondition": "Rimuovi",
      "and": "E",
      "or": "OPPURE"
    },
    "fields": {
      "ticket.status": "Stato ticket",
      "ticket.priority": "Priorità ticket",
      "ticket.customer_id": "Cliente (ticket)",
      "ticket.assignee_id": "Assegnatario",
      "device.customer_id": "Cliente (dispositivo)",
      "device.location_id": "Sede dispositivo"
    },
    "values": {
      "ticket.status": {
        "pending": "In attesa",
        "in-progress": "In corso",
        "testing": "In test",
        "ready": "Pronto"
      },
      "ticket.priority": {
        "low": "Bassa",
        "medium": "Media",
        "high": "Alta",
        "urgent": "Urgente"
      }
    }
  }
}
```

---

## 7. File da Creare/Modificare

### 7.1 Nuovi File

| File                                                         | Scopo                                           |
| ------------------------------------------------------------ | ----------------------------------------------- |
| `src/domain/automation.ts`                                   | Nuovi tipi AutomationCondition, ConditionsGroup |
| `src/lib/automations/condition-adapter.ts`                   | Adattatori da/verso ConditionDef                |
| `src/components/automations/AutomationConditionsBuilder.tsx` | Componente builder principale                   |
| `src/components/automations/ConditionRow.tsx`                | Riga singola condizione (sub-componente)        |
| `src/components/automations/FieldSelector.tsx`               | Selettore campo con optgroup                    |
| `src/components/automations/OperatorSelector.tsx`            | Selettore operatore dinamico                    |
| `src/components/automations/ValueInput.tsx`                  | Input valore adattivo per tipo                  |

### 7.2 File da Modificare

| File                                               | Modifiche                                 |
| -------------------------------------------------- | ----------------------------------------- |
| `src/components/automations/steps/FiltersStep.tsx` | Sostituire implementazione, usare builder |
| `src/i18n/locales/it/automations.json`             | Aggiungere chiavi conditionsBuilder       |
| `src/types/automation.ts`                          | Nessuna modifica (backward compat)        |

### 7.3 File da Rimuovere

Nessuno — `FiltersStep.tsx` rimane come wrapper.

---

## 8. Testing Strategy

### 8.1 Test Unitari

- **condition-adapter.ts:**
  - Converte `field_equals` → `{ operator: "eq" }`
  - Converte `priority_high` → `{ field: "ticket.priority", operator: "eq", value: "high" }`
  - Espande operatore `in` in multiple condizioni per OR

- **AutomationConditionsBuilder:**
  - Renderizzazione stato vuoto
  - Aggiunta/rimozione condizioni
  - Cambio operatore aggiorna input valore
  - Toggle AND/OR cambia visualizzazione

### 8.2 Test Integrazione

- Wizard completo: selezione campo → operatore → valore → salvataggio
- Caricamento automazione esistente: legacy ConditionDef renderizzati correttamente
- Cambio campo resetta operatore se non compatibile

---

## 9. Note Implementative

### 9.1 Serializzazione `in` con OR

Quando logic è OR e un condizione usa operatore `in`:

```typescript
// Input
{ logic: "OR", conditions: [{ field: "status", operator: "in", value: ["ready", "testing"] }] }

// Output (espanso per API)
[
  { type: "field_equals", config: { field: "status", value: "ready" } },
  { type: "field_equals", config: { field: "status", value: "testing" } }
]
```

### 9.2 Campi Reference

Per `customer_id`, `assignee_id`, `location_id`:

- Usare componente `AsyncSelect` con debounce
- Cercare nel database in tempo reale
- Memorizzare solo l'ID, mostrare label nel selettore

### 9.3 Validazione

- Campo obbligatorio
- Operatore obbligatorio
- Valore obbligatorio (tranne per certi casi edge)
- Validazione tipo: numero per gt/lt, stringa per contains

---

## 10. Checklist Pre-Implementazione

- [ ] Design approvato da utente
- [ ] Piano implementazione scritto
- [ ] File da creare/modificare identificati
- [ ] Copy italiano pronto per review

---

_Design creato: 2026-05-24_  
_Stato: In attesa approvazione_
