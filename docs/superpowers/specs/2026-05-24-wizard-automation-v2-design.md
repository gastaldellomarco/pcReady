# Design: Wizard Automazioni V2 — UX Guidata (Zapier-like)

## 1. Panoramica

### Obiettivo

Migliorare l'UX del wizard automazioni rendendo più veloce la creazione di automazioni reali, riducendo errori e tempo di configurazione per i tecnici.

### Scope

- Solo UI/UX lato frontend e struttura dei dati passati all'API
- Nessuna modifica al motore di esecuzione

### Criteri di Accettazione

- [ ] Wizard con 4 step fissi: Evento, Filtri, Azioni, Riepilogo
- [ ] Ogni step ha titolo orientato al problema + descrizione max 1 riga con esempio
- [ ] Schermata iniziale con elenco di 6 template preconfigurati
- [ ] Selezione template precompila i campi del wizard, sempre modificabili
- [ ] Riepilogo mostra frase naturale "Quando X → fai Y" + JSON tecnico in accordion read-only

---

## 2. Architettura

### Component Tree

```
AutomationWizard (container)
├── TemplateStep          [nuovo] — selezione template
├── EventStep             [refactor TriggerStep] — trigger + config condizionale
├── FiltersStep           [refactor ConditionsStep] — condizioni con copy migliorato
├── ActionsStep           [esistente, minor UI tweaks] — azioni
└── ReviewStep            [refactor] — human-friendly summary + JSON accordion
```

### Principio Chiave

Ogni step ha un **titolo orientato al problema** (es. "Quando deve partire questa automazione?") e una **descrizione max 1 riga con esempio concreto**.

---

## 3. Struttura Dati

### 3.1 Template Library

File: `src/lib/automations/templates.ts`

```typescript
export type TemplateCategory = "notification" | "status" | "schedule" | "urgency";

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIconName;
  category: TemplateCategory;
  defaultPayload: Partial<WizardFlowPayload>;
}
```

### 3.2 I 6 Template Base

| #   | Nome                             | Trigger                    | Filtri                         | Azioni                | Config Speciale                 |
| --- | -------------------------------- | -------------------------- | ------------------------------ | --------------------- | ------------------------------- |
| 1   | Notifica email nuovo ticket      | `ticket_created`           | —                              | `send_email`          | subject: "Nuovo ticket #{{id}}" |
| 2   | Ticket urgente → avvisa tecnico  | `ticket_created`           | `priority_high`                | `create_notification` | title: "Ticket urgente!"        |
| 3   | Ticket in scadenza SLA           | `sla_warning`              | —                              | `send_email`          | subject: "SLA in scadenza"      |
| 4   | Dispositivo in scadenza garanzia | `warranty_expiring_soon`   | —                              | `send_email`          | config.days = 30                |
| 5   | Ticket inattivo da N giorni      | `scheduled` (cron: daily)  | `field_last_activity > N days` | `send_email`          | cron: `0 9 * * *`               |
| 6   | Report settimanale ticket        | `scheduled` (cron: weekly) | —                              | `send_email`          | cron: `0 9 * * 1`               |

---

## 4. UI Dettagliata per Step

### 4.1 Step 0: Scegli un modello

**Header dello step:**

- Titolo: _"Scegli un modello"_
- Descrizione: _"Seleziona un template preconfigurato o inizia da zero. Puoi modificare tutto nei prossimi passaggi."_

**Layout:** Grid 2 colonne, card cliccabili con:

- Icona a sinistra (40×40, colore accent)
- Titolo (bold, 14px)
- Descrizione (text-text3, 12px, max 2 righe)
- Badge categoria in alto a destra

**Card "Inizia da zero"** — ultima posizione, stile outline tratteggiato, icona Plus.

**Comportamento:**

- Click su template → precompila stato wizard → avanza a Step 1
- Click "Inizia da zero" → wizard vuoto → avanza a Step 1
- Se editing automazione esistente → salta questo step, inizia da Step 1 con dati caricati

---

### 4.2 Step 1: Evento (refactor TriggerStep)

**Header orientato:**

- Titolo: _"Quando deve partire questa automazione?"_
- Descrizione: _"Scegli l'evento che attiva questa regola. Esempio: quando arriva un nuovo ticket urgente."_

**Layout:** Griglia 3 colonne (desktop) / 2 (tablet) / 1 (mobile)

**Card trigger:**

- Icona colorata (esistente, migliorata)
- Nome trigger (bold)
- Frase esempio concreto (es. _"Quando un ticket viene contrassegnato come urgente"_)

**Configurazione condizionale inline:**

- Trigger = `scheduled` → input cron appare sotto la card
- Trigger = `warranty_expiring_soon` → input "Giorni prima" (default 30)
- Altri trigger → solo selezione card

---

### 4.3 Step 2: Filtri (refactor ConditionsStep)

**Header orientato:**

- Titolo: _"Sotto quali condizioni?"_
- Descrizione: _"Opzionale — filtra solo i casi che corrispondono ai criteri. Esempio: solo ticket con priorità alta."_

**Layout:** Lista verticale di "chip condizione" espandibili

**Chip condizione:**

- Icona operatore (≈, ≠, >, <, etc.)
- Testo leggibile: _"Priorità è alta"_ invece di `priority_high`
- Azioni: modifica (espande), elimina, drag per riordino

**Stato vuoto:**

- Box tratteggiato con icona FilterX
- Testo: _"Nessun filtro — l'automazione si attiva per ogni {{triggerName}}"_

**Aggiungi condizione:** Button outline con dropdown tipo condizione

---

### 4.4 Step 3: Azioni (ActionsStep con tweaks minori)

**Header orientato:**

- Titolo: _"Cosa deve succedere?"_
- Descrizione: _"Scegli le azioni da eseguire quando il trigger e i filtri sono soddisfatti."_

**Layout:** Lista azioni verticali con card espandibili

**Card azione:**

- Header: Icona azione + nome leggibile + badge tipo
- Body: form specifico per tipo
- Preview inline: per email mostra subject, per notifica mostra title/body

**Azione send_email:**

- Preview immediata subject line
- Toggle "Visualizza in HTML"

**Aggiungi azione:** Button primario outline con dropdown tipi

---

### 4.5 Step 4: Riepilogo (refactor ReviewStep)

**Header:**

- Titolo: _"Controlla prima di salvare"_
- Descrizione: _"Verifica che tutto sia corretto. Puoi tornare indietro per modificare."_

**Human-friendly summary card:**

```
┌─────────────────────────────────────────────────────────┐
│  🔵 Quando arriva un NUOVO TICKET con priorità ALTA     │
│     → Invia EMAIL al responsabile                       │
│     → Crea NOTIFICA in-app                              │
│                                                         │
│  [Modifica]  → torna allo step corrispondente           │
└─────────────────────────────────────────────────────────┘
```

**Formato frase naturale:**

- Quando + [trigger descrittivo] + (opzionale: con [filtri])
- → [azione 1]
- → [azione 2] (se multiple)

**Accordions:**

- "📝 Dettagli tecnici (JSON)" — collassato by default
- "⏱️ Schedulazione" — visibile solo se trigger schedulato
- "🔧 Configurazione avanzata" — changeNote, versione, categoria

**Form finali:**

- Nome regola (required)
- Descrizione (optional)
- Categoria (dropdown)
- Nota modifica (textarea)

---

## 5. Flusso Dati e Navigazione

### 5.1 Stato Wizard

```typescript
interface WizardState {
  step: 0 | 1 | 2 | 3 | 4;
  // Dati automazione
  name: string;
  description: string;
  category: string | null;
  trigger: TriggerDef | null;
  conditions: ConditionDef[];
  actions: ActionDef[];
  // Metadata
  selectedTemplateId: string | null; // traccia template usato
  isFromTemplate: boolean;
  changeNote: string;
}
```

### 5.2 Navigazione Step

| Step | Nome      | Valida prima di proseguire | Pulsante Avanti abilitato |
| ---- | --------- | -------------------------- | ------------------------- |
| 0    | Template  | No (opzionale)             | Sempre                    |
| 1    | Evento    | Sì — trigger required      | trigger !== null          |
| 2    | Filtri    | No                         | Sempre                    |
| 3    | Azioni    | Sì — almeno 1 azione       | actions.length > 0        |
| 4    | Riepilogo | Sì — nome required         | name.trim() !== ''        |

**Validazione inline:** Errori mostrati nel contesto dello step, non solo in Review.

### 5.3 Progress Bar

Barra orizzontale con 5 punti (0-4):

- Completato: checkmark verde
- Corrente: numero evidenziato
- Futuro: grigio
- Click su completati → naviga a quel step

---

## 6. Gestione Template

### 6.1 Selezione Template

```typescript
function selectTemplate(templateId: string | null) {
  if (templateId) {
    const template = AUTOMATION_TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      // Precompila tutti i campi
      setName(template.defaultPayload.name || "");
      setTrigger(template.defaultPayload.trigger_definition || null);
      setConditions(template.defaultPayload.conditions_definition || []);
      setActions(template.defaultPayload.actions_definition || []);
      setSelectedTemplateId(templateId);
    }
  } else {
    // Inizia da zero
    setName("");
    setTrigger(null);
    setConditions([]);
    setActions([]);
    setSelectedTemplateId(null);
  }
  // Avanza allo step Evento
  setStep(1);
}
```

### 6.2 Persistenza Template

- `selectedTemplateId` salvato nel payload wizard (campo opzionale)
- Usato per analytics e future feature "applica template a automazione esistente"

---

## 7. Copy in Italiano

### 7.1 Nuove Chiavi i18n

```json
{
  "templateStep": {
    "title": "Scegli un modello",
    "description": "Seleziona un template preconfigurato o inizia da zero. Puoi modificare tutto nei prossimi passaggi.",
    "startFromScratch": "Inizia da zero",
    "categories": {
      "notification": "Notifica",
      "status": "Stato",
      "schedule": "Schedulazione",
      "urgency": "Urgenza"
    }
  },
  "eventStep": {
    "title": "Quando deve partire questa automazione?",
    "description": "Scegli l'evento che attiva questa regola. Esempio: quando arriva un nuovo ticket urgente."
  },
  "filtersStep": {
    "title": "Sotto quali condizioni?",
    "description": "Opzionale — filtra solo i casi che corrispondono ai criteri. Esempio: solo ticket con priorità alta.",
    "emptyState": "Nessun filtro — l'automazione si attiva per ogni {{triggerName}}"
  },
  "actionsStep": {
    "title": "Cosa deve succedere?",
    "description": "Scegli le azioni da eseguire quando il trigger e i filtri sono soddisfatti."
  },
  "reviewStep": {
    "title": "Controlla prima di salvare",
    "description": "Verifica che tutto sia corretto. Puoi tornare indietro per modificare.",
    "summaryPrefix": "Quando",
    "summaryActionSeparator": "→",
    "technicalDetails": "Dettagli tecnici (JSON)"
  }
}
```

---

## 8. File da Modificare/Creare

### 8.1 Nuovi File

| File                                                | Scopo                         |
| --------------------------------------------------- | ----------------------------- |
| `src/lib/automations/templates.ts`                  | Definizione 6 template + tipi |
| `src/components/automations/steps/TemplateStep.tsx` | UI selezione template         |
| `src/components/automations/steps/EventStep.tsx`    | Refactor TriggerStep          |
| `src/components/automations/steps/FiltersStep.tsx`  | Refactor ConditionsStep       |

### 8.2 File da Modificare

| File                                               | Modifiche                                                 |
| -------------------------------------------------- | --------------------------------------------------------- |
| `src/components/automations/AutomationWizard.tsx`  | Restructure a 5 step, gestione stato template             |
| `src/components/automations/steps/ActionsStep.tsx` | Header orientato + preview inline                         |
| `src/components/automations/steps/ReviewStep.tsx`  | Human-friendly summary + accordion JSON                   |
| `src/i18n/locales/it/automations.json`             | Nuove chiavi copy                                         |
| `src/types/automation.ts`                          | Aggiungere campo `selectedTemplateId` a WizardFlowPayload |

### 8.3 File da Eliminare

| File                                                  | Motivo                             |
| ----------------------------------------------------- | ---------------------------------- |
| `src/components/automations/steps/TriggerStep.tsx`    | Sostituito da EventStep            |
| `src/components/automations/steps/ConditionsStep.tsx` | Sostituito da FiltersStep          |
| `src/components/automations/steps/ScheduleStep.tsx`   | Funzionalità mergiata in EventStep |

---

## 9. Testing Strategy

### 9.1 Test Unitari

- **TemplateStep:** rendering 6 template + card "da zero", click handlers
- **EventStep:** selezione trigger, config condizionale (cron, days)
- **FiltersStep:** aggiunta/rimozione condizioni, human-readable labels
- **ReviewStep:** generazione frase naturale corretta, accordion toggle

### 9.2 Test Integrazione

- Flusso completo: template → evento → filtri → azioni → riepilogo → save
- Validazione step: blocca avanzamento senza trigger/azioni/nome
- Precompilazione template: verifica dati corretti in ogni step

---

## 10. Note Implementative

### 10.1 Backward Compatibility

- Automazioni esistenti si aprono direttamente allo Step 1 (Evento)
- Campo `selectedTemplateId` è optional, non rompe automazioni esistenti
- JSON payload invariato — stessa struttura `WizardFlowPayload`

### 10.2 Performance

- Template sono statici (no API call)
- Lazy load dei componenti step non ancora visitati (opzionale)
- Validazione debounced per input testuali

### 10.3 Accessibilità

- Ogni step ha `aria-label` descrittivo
- Progress bar è navigabile da tastiera
- Accordion JSON ha `aria-expanded` corretto

---

## 11. Checklist Pre-Implementazione

- [ ] Design approvato da utente
- [ ] Piano implementazione scritto
- [ ] File da modificare/creare identificati
- [ ] Copy italiano pronto per review

---

_Design creato: 2026-05-24_  
_Stato: In attesa approvazione_
