# Design: Automation DSL Tipizzato con Validazione Zod

## 1. Panoramica

### Obiettivo

Creare un DSL (Domain Specific Language) tipizzato per automazioni con validazione Zod centralizzata. Migliora la type safety, riusabilità frontend/backoffice/motore, e previene errori runtime.

### Scope

- Nuovi tipi TypeScript fortemente tipizzati in `src/domain/automation.ts`
- Schema Zod per validazione runtime in `src/domain/automation.schema.ts`
- Integrazione con wizard form per validazione schema-based
- Serializzazione/deserializzazione JSON compatibile

### Non-Scope (accettato)

- Runtime di esecuzione automazioni (motore)
- Cambi DB schema
- Breaking changes API esistente

### Acceptance Criteria

- [ ] `AutomationTrigger` union type con 5 trigger tipizzati
- [ ] `AutomationCondition` con campi, operatori, valori validati
- [ ] `AutomationAction` discriminated union con 4+ azioni
- [ ] `AutomationFlow` rappresenta automazione completa
- [ ] Schema Zod `AutomationFlowInput` per validazione form
- [ ] Wizard rifiuta salvataggi non validi con errori specifici
- [ ] JSON output compatibile con tipi definiti (test serializzazione)

---

## 2. Architettura Dati

### 2.1 Trigger DSL

**File:** `src/domain/automation.ts` (estensione)

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION TRIGGER DSL
// ═══════════════════════════════════════════════════════════════════════════════

export type AutomationTriggerType =
  | "ticket_created"
  | "ticket_updated"
  | "sla_due" // alias for sla_warning
  | "warranty_due" // alias for warranty_expiring_soon
  | "scheduled";

// Base trigger interface
export interface AutomationTriggerBase {
  type: AutomationTriggerType;
}

// Ticket Created
export interface TicketCreatedTrigger extends AutomationTriggerBase {
  type: "ticket_created";
  config: {
    // No additional config needed
  };
}

// Ticket Updated
export interface TicketUpdatedTrigger extends AutomationTriggerBase {
  type: "ticket_updated";
  config: {
    fields?: string[]; // Optional: trigger only when specific fields change
  };
}

// SLA Due (warning)
export interface SlaDueTrigger extends AutomationTriggerBase {
  type: "sla_due";
  config: {
    hours_before: number; // Hours before SLA deadline to trigger
  };
}

// Warranty Due (expiring soon)
export interface WarrantyDueTrigger extends AutomationTriggerBase {
  type: "warranty_due";
  config: {
    days_before: number; // Days before warranty expiry to trigger
  };
}

// Scheduled
export interface ScheduledTrigger extends AutomationTriggerBase {
  type: "scheduled";
  config: {
    cron: string; // Cron expression
    timezone?: string; // Optional timezone, defaults to system
  };
}

// Union type
export type AutomationTrigger =
  | TicketCreatedTrigger
  | TicketUpdatedTrigger
  | SlaDueTrigger
  | WarrantyDueTrigger
  | ScheduledTrigger;

// Default configs
export const DEFAULT_TRIGGER_CONFIGS: Record<AutomationTriggerType, Record<string, unknown>> = {
  ticket_created: {},
  ticket_updated: {},
  sla_due: { hours_before: 24 },
  warranty_due: { days_before: 30 },
  scheduled: { cron: "0 8 * * *", timezone: "Europe/Rome" },
};

// Create default trigger
export function createDefaultTrigger(type: AutomationTriggerType): AutomationTrigger {
  const base = { type, config: DEFAULT_TRIGGER_CONFIGS[type] };

  switch (type) {
    case "ticket_created":
      return { ...base, type: "ticket_created", config: {} };
    case "ticket_updated":
      return { ...base, type: "ticket_updated", config: {} };
    case "sla_due":
      return { ...base, type: "sla_due", config: { hours_before: 24 } };
    case "warranty_due":
      return { ...base, type: "warranty_due", config: { days_before: 30 } };
    case "scheduled":
      return { ...base, type: "scheduled", config: { cron: "0 8 * * *" } };
    default:
      return { ...base, type: "ticket_created", config: {} };
  }
}
```

### 2.2 Conditions DSL (estensione esistente)

**Già presente in:** `src/domain/automation.ts`

Miglioramenti da aggiungere:

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION CONDITIONS DSL (Enhanced)
// ═══════════════════════════════════════════════════════════════════════════════

// Zod schema per validazione condition
export const AutomationConditionSchema = z.object({
  id: z.string(),
  field: z.string(),
  operator: z.enum(["eq", "neq", "contains", "gt", "lt", "in"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  valueType: z.enum(["string", "number", "list", "reference"]),
  label: z.string().optional(),
});

export const ConditionsGroupSchema = z.object({
  conditions: z.array(AutomationConditionSchema),
  logic: z.enum(["AND", "OR"]),
});

// Validation helper
export function validateCondition(condition: unknown): { valid: boolean; errors: string[] } {
  const result = AutomationConditionSchema.safeParse(condition);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}
```

### 2.3 Actions DSL (estensione esistente)

**Già presente in:** `src/domain/automation.ts`

Miglioramenti schema Zod:

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION ACTIONS DSL (Enhanced with Zod)
// ═══════════════════════════════════════════════════════════════════════════════

// Zod schemas per ogni action type
const SendEmailConfigSchema = z.object({
  to: z.string().optional(),
  subject: z.string().min(1, "Oggetto richiesto"),
  body: z.string().min(1, "Corpo richiesto"),
  is_html: z.boolean().default(false),
});

const UpdateTicketConfigSchema = z
  .object({
    ticket_id: z.string().optional(),
    status: z.enum(["pending", "in-progress", "testing", "ready"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    assignee_id: z.string().optional(),
  })
  .refine((data) => data.status || data.priority || data.assignee_id, {
    message: "Almeno un campo da aggiornare (stato, priorità o assegnatario)",
  });

const AddCommentConfigSchema = z.object({
  ticket_id: z.string().optional(),
  content: z.string().min(1, "Contenuto del commento richiesto"),
  is_internal: z.boolean().default(true),
});

const CreateTicketConfigSchema = z.object({
  title: z.string().min(1, "Titolo richiesto"),
  description: z.string().min(1, "Descrizione richiesta"),
  customer_id: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignee_id: z.string().optional(),
});

// Discriminated union schema
export const AutomationActionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("send_email"),
    order: z.number(),
    config: SendEmailConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("update_ticket"),
    order: z.number(),
    config: UpdateTicketConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("add_comment"),
    order: z.number(),
    config: AddCommentConfigSchema,
  }),
  z.object({
    id: z.string(),
    type: z.literal("create_ticket"),
    order: z.number(),
    config: CreateTicketConfigSchema,
  }),
]);

export const ActionsListSchema = z.object({
  actions: z.array(AutomationActionSchema),
});
```

### 2.4 Automation Flow DSL

**File:** `src/domain/automation.ts` (nuova sezione)

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION FLOW DSL
// ═══════════════════════════════════════════════════════════════════════════════

export interface AutomationFlow {
  id?: string; // Optional: set when editing existing
  name: string;
  description?: string;
  category?: string;
  trigger: AutomationTrigger;
  conditions: ConditionsGroup;
  actions: AutomationAction[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Input type for forms (without auto-generated fields)
export interface AutomationFlowInput {
  name: string;
  description?: string;
  category?: string;
  trigger: AutomationTrigger;
  conditions: ConditionsGroup;
  actions: AutomationAction[];
}

// Serialize to JSON-compatible format for API
export function serializeFlow(flow: AutomationFlow): Record<string, unknown> {
  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    category: flow.category,
    trigger_definition: serializeTrigger(flow.trigger),
    conditions_definition: serializeConditions(flow.conditions),
    actions_definition: serializeActions(flow.actions),
    is_active: flow.is_active,
    created_at: flow.created_at,
    updated_at: flow.updated_at,
  };
}

// Deserialize from API response
export function deserializeFlow(data: Record<string, unknown>): AutomationFlow {
  return {
    id: data.id as string | undefined,
    name: data.name as string,
    description: data.description as string | undefined,
    category: data.category as string | undefined,
    trigger: deserializeTrigger(data.trigger_definition as Record<string, unknown>),
    conditions: deserializeConditions(data.conditions_definition as Record<string, unknown>[]),
    actions: deserializeActions(data.actions_definition as Record<string, unknown>[]),
    is_active: (data.is_active as boolean) ?? true,
    created_at: data.created_at as string | undefined,
    updated_at: data.updated_at as string | undefined,
  };
}

// Helper serializers
function serializeTrigger(trigger: AutomationTrigger): Record<string, unknown> {
  return {
    type: mapTriggerTypeToLegacy(trigger.type),
    config: trigger.config,
  };
}

function deserializeTrigger(def: Record<string, unknown>): AutomationTrigger {
  const type = mapLegacyTriggerType(def.type as string);
  return createDefaultTrigger(type); // Simplified - would merge with actual config
}

// Type mappers for backward compatibility
function mapTriggerTypeToLegacy(type: AutomationTriggerType): string {
  const mapping: Record<AutomationTriggerType, string> = {
    ticket_created: "ticket_created",
    ticket_updated: "ticket_updated",
    sla_due: "sla_warning",
    warranty_due: "warranty_expiring_soon",
    scheduled: "scheduled",
  };
  return mapping[type];
}

function mapLegacyTriggerType(type: string): AutomationTriggerType {
  const mapping: Record<string, AutomationTriggerType> = {
    ticket_created: "ticket_created",
    ticket_updated: "ticket_updated",
    sla_warning: "sla_due",
    warranty_expiring_soon: "warranty_due",
    scheduled: "scheduled",
  };
  return mapping[type] || "ticket_created";
}
```

---

## 3. Schema Zod per Validazione

### 3.1 File: `src/domain/automation.schema.ts`

```typescript
import { z } from "zod";
import type {
  AutomationFlowInput,
  AutomationTrigger,
  AutomationCondition,
  AutomationAction,
} from "./automation";

// ═══════════════════════════════════════════════════════════════════════════════
// TRIGGER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const TicketCreatedTriggerSchema = z.object({
  type: z.literal("ticket_created"),
  config: z.object({}),
});

export const TicketUpdatedTriggerSchema = z.object({
  type: z.literal("ticket_updated"),
  config: z.object({
    fields: z.array(z.string()).optional(),
  }),
});

export const SlaDueTriggerSchema = z.object({
  type: z.literal("sla_due"),
  config: z.object({
    hours_before: z.number().min(1).max(168).default(24),
  }),
});

export const WarrantyDueTriggerSchema = z.object({
  type: z.literal("warranty_due"),
  config: z.object({
    days_before: z.number().min(1).max(365).default(30),
  }),
});

export const ScheduledTriggerSchema = z.object({
  type: z.literal("scheduled"),
  config: z.object({
    cron: z.string().min(1, "Espressione cron richiesta"),
    timezone: z.string().optional(),
  }),
});

export const AutomationTriggerSchema = z.discriminatedUnion("type", [
  TicketCreatedTriggerSchema,
  TicketUpdatedTriggerSchema,
  SlaDueTriggerSchema,
  WarrantyDueTriggerSchema,
  ScheduledTriggerSchema,
]);

// ═══════════════════════════════════════════════════════════════════════════════
// CONDITION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const AutomationConditionSchema = z.object({
  id: z.string(),
  field: z.string().min(1, "Campo richiesto"),
  operator: z.enum(["eq", "neq", "contains", "gt", "lt", "in"]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  valueType: z.enum(["string", "number", "list", "reference"]),
  label: z.string().optional(),
});

export const ConditionsGroupSchema = z.object({
  conditions: z.array(AutomationConditionSchema),
  logic: z.enum(["AND", "OR"]),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

const SendEmailActionSchema = z.object({
  id: z.string(),
  type: z.literal("send_email"),
  order: z.number(),
  config: z.object({
    to: z.string().optional(),
    subject: z.string().min(1, "Oggetto email richiesto"),
    body: z.string().min(1, "Corpo email richiesto"),
    is_html: z.boolean().default(false),
  }),
});

const UpdateTicketActionSchema = z.object({
  id: z.string(),
  type: z.literal("update_ticket"),
  order: z.number(),
  config: z
    .object({
      ticket_id: z.string().optional(),
      status: z.enum(["pending", "in-progress", "testing", "ready"]).optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      assignee_id: z.string().optional(),
    })
    .refine((data) => data.status || data.priority || data.assignee_id, {
      message: "Almeno un campo da aggiornare (stato, priorità o assegnatario)",
    }),
});

const AddCommentActionSchema = z.object({
  id: z.string(),
  type: z.literal("add_comment"),
  order: z.number(),
  config: z.object({
    ticket_id: z.string().optional(),
    content: z.string().min(1, "Contenuto del commento richiesto"),
    is_internal: z.boolean().default(true),
  }),
});

const CreateTicketActionSchema = z.object({
  id: z.string(),
  type: z.literal("create_ticket"),
  order: z.number(),
  config: z.object({
    title: z.string().min(1, "Titolo ticket richiesto"),
    description: z.string().min(1, "Descrizione ticket richiesta"),
    customer_id: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    assignee_id: z.string().optional(),
  }),
});

export const AutomationActionSchema = z.discriminatedUnion("type", [
  SendEmailActionSchema,
  UpdateTicketActionSchema,
  AddCommentActionSchema,
  CreateTicketActionSchema,
]);

// ═══════════════════════════════════════════════════════════════════════════════
// FLOW INPUT SCHEMA (for form validation)
// ═══════════════════════════════════════════════════════════════════════════════

export const AutomationFlowInputSchema = z.object({
  name: z.string().min(1, "Nome automazione richiesto").max(200),
  description: z.string().max(1000).optional(),
  category: z.string().optional(),
  trigger: AutomationTriggerSchema,
  conditions: ConditionsGroupSchema,
  actions: z.array(AutomationActionSchema).min(1, "Almeno un'azione richiesta"),
});

// Type export for form usage
export type AutomationFlowInputSchemaType = z.infer<typeof AutomationFlowInputSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export function validateFlowInput(input: unknown): ValidationResult {
  const result = AutomationFlowInputSchema.safeParse(input);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  };
}

export function validateTrigger(trigger: unknown): ValidationResult {
  const result = AutomationTriggerSchema.safeParse(trigger);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  };
}

export function validateActions(actions: unknown): ValidationResult {
  const result = z.array(AutomationActionSchema).min(1).safeParse(actions);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    })),
  };
}

// Format errors for display
export function formatValidationErrors(errors: ValidationError[]): Record<string, string> {
  return errors.reduce(
    (acc, error) => {
      acc[error.path] = error.message;
      return acc;
    },
    {} as Record<string, string>,
  );
}
```

---

## 4. Integrazione Wizard Form

### 4.1 Hook per Validazione Form

**File:** `src/hooks/useAutomationForm.ts` (nuovo)

```typescript
import { useState, useCallback } from "react";
import type { AutomationFlowInput } from "@/domain/automation";
import {
  validateFlowInput,
  formatValidationErrors,
  type ValidationError,
} from "@/domain/automation.schema";

interface UseAutomationFormResult {
  data: AutomationFlowInput;
  errors: Record<string, string>;
  isValid: boolean;
  validate: () => boolean;
  updateField: <K extends keyof AutomationFlowInput>(
    field: K,
    value: AutomationFlowInput[K],
  ) => void;
  setErrors: (errors: Record<string, string>) => void;
  clearErrors: () => void;
}

export function useAutomationForm(
  initialData: Partial<AutomationFlowInput> = {},
): UseAutomationFormResult {
  const [data, setData] = useState<AutomationFlowInput>({
    name: initialData.name || "",
    description: initialData.description,
    category: initialData.category,
    trigger: initialData.trigger || { type: "ticket_created", config: {} },
    conditions: initialData.conditions || { conditions: [], logic: "AND" },
    actions: initialData.actions || [],
  });

  const [errors, setErrorsState] = useState<Record<string, string>>({});

  const validate = useCallback((): boolean => {
    const result = validateFlowInput(data);

    if (!result.valid) {
      setErrorsState(formatValidationErrors(result.errors));
    } else {
      setErrorsState({});
    }

    return result.valid;
  }, [data]);

  const updateField = useCallback(
    <K extends keyof AutomationFlowInput>(field: K, value: AutomationFlowInput[K]) => {
      setData((prev) => ({ ...prev, [field]: value }));
      // Clear error for this field when user updates it
      setErrorsState((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        // Also clear nested errors
        Object.keys(newErrors).forEach((key) => {
          if (key.startsWith(`${field}.`) || key.startsWith(`${field}[`)) {
            delete newErrors[key];
          }
        });
        return newErrors;
      });
    },
    [],
  );

  const setErrors = useCallback((newErrors: Record<string, string>) => {
    setErrorsState(newErrors);
  }, []);

  const clearErrors = useCallback(() => {
    setErrorsState({});
  }, []);

  return {
    data,
    errors,
    isValid: Object.keys(errors).length === 0,
    validate,
    updateField,
    setErrors,
    clearErrors,
  };
}
```

### 4.2 Validazione Step-by-Step nel Wizard

**Modifica a:** `src/components/automations/AutomationWizard.tsx`

```typescript
// Import validation
import { validateTrigger, validateActions, type ValidationError } from "@/domain/automation.schema";

// Aggiungi stato per errori validazione
const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

// Validazione prima di avanzare step
function validateCurrentStep(): boolean {
  switch (currentStep) {
    case "event":
      const triggerResult = validateTrigger(trigger);
      if (!triggerResult.valid) {
        setValidationErrors(formatValidationErrors(triggerResult.errors));
        return false;
      }
      break;

    case "actions":
      const actionsResult = validateActions(actions);
      if (!actionsResult.valid) {
        setValidationErrors(formatValidationErrors(actionsResult.errors));
        return false;
      }
      break;

    case "review":
      const flowResult = validateFlowInput({
        name,
        description,
        category,
        trigger,
        conditions,
        actions,
      });
      if (!flowResult.valid) {
        setValidationErrors(formatValidationErrors(flowResult.errors));
        return false;
      }
      break;
  }

  setValidationErrors({});
  return true;
}

// Previeni avanzamento se non valido
function nextStep() {
  if (!validateCurrentStep()) {
    return; // Block navigation
  }
  // ... proceed to next step
}
```

---

## 5. Test Unitari

### 5.1 File: `src/domain/automation.spec.ts` (nuovo)

```typescript
import { describe, it, expect } from "vitest";
import {
  createDefaultTrigger,
  createDefaultCondition,
  createDefaultAction,
  serializeFlow,
  deserializeFlow,
  type AutomationFlow,
} from "./automation";
import { validateFlowInput, AutomationFlowInputSchema } from "./automation.schema";

describe("Automation DSL", () => {
  describe("Trigger DSL", () => {
    it("should create valid ticket_created trigger", () => {
      const trigger = createDefaultTrigger("ticket_created");
      expect(trigger.type).toBe("ticket_created");
      expect(
        validateFlowInput({
          name: "Test",
          trigger,
          conditions: { conditions: [], logic: "AND" },
          actions: [createDefaultAction("send_email")],
        }).valid,
      ).toBe(true);
    });

    it("should create valid scheduled trigger with cron", () => {
      const trigger = createDefaultTrigger("scheduled");
      expect(trigger.config.cron).toBe("0 8 * * *");
    });
  });

  describe("Serialization", () => {
    it("should serialize and deserialize flow preserving data", () => {
      const flow: AutomationFlow = {
        name: "Test Flow",
        description: "Test description",
        trigger: createDefaultTrigger("ticket_created"),
        conditions: {
          conditions: [createDefaultCondition()],
          logic: "AND",
        },
        actions: [createDefaultAction("send_email")],
        is_active: true,
      };

      const serialized = serializeFlow(flow);
      const deserialized = deserializeFlow(serialized);

      expect(deserialized.name).toBe(flow.name);
      expect(deserialized.trigger.type).toBe(flow.trigger.type);
      expect(deserialized.actions[0].type).toBe(flow.actions[0].type);
    });

    it("should produce JSON compatible with legacy API", () => {
      const flow: AutomationFlow = {
        name: "Test",
        trigger: createDefaultTrigger("sla_due"),
        conditions: { conditions: [], logic: "AND" },
        actions: [createDefaultAction("send_email")],
        is_active: true,
      };

      const serialized = serializeFlow(flow);

      // Check legacy field names
      expect(serialized).toHaveProperty("trigger_definition");
      expect(serialized).toHaveProperty("conditions_definition");
      expect(serialized).toHaveProperty("actions_definition");

      // Check trigger type mapping
      expect(serialized.trigger_definition).toEqual({
        type: "sla_warning", // mapped from sla_due
        config: { hours_before: 24 },
      });
    });
  });

  describe("Validation", () => {
    it("should reject flow without name", () => {
      const result = validateFlowInput({
        name: "",
        trigger: createDefaultTrigger("ticket_created"),
        conditions: { conditions: [], logic: "AND" },
        actions: [createDefaultAction("send_email")],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "name")).toBe(true);
    });

    it("should reject flow without actions", () => {
      const result = validateFlowInput({
        name: "Test",
        trigger: createDefaultTrigger("ticket_created"),
        conditions: { conditions: [], logic: "AND" },
        actions: [],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "actions")).toBe(true);
    });

    it("should reject send_email without subject", () => {
      const action = createDefaultAction("send_email");
      action.config.subject = "";

      const result = validateFlowInput({
        name: "Test",
        trigger: createDefaultTrigger("ticket_created"),
        conditions: { conditions: [], logic: "AND" },
        actions: [action],
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes("subject"))).toBe(true);
    });
  });
});
```

---

## 6. File da Creare/Modificare

### 6.1 Nuovi File

| File                              | Scopo                      |
| --------------------------------- | -------------------------- |
| `src/domain/automation.schema.ts` | Schemi Zod per validazione |
| `src/hooks/useAutomationForm.ts`  | Hook per form validation   |
| `src/domain/automation.spec.ts`   | Test unitari DSL           |

### 6.2 File da Modificare

| File                                               | Modifiche                                     |
| -------------------------------------------------- | --------------------------------------------- |
| `src/domain/automation.ts`                         | Aggiungere Trigger DSL, Flow DSL, serializers |
| `src/components/automations/AutomationWizard.tsx`  | Integrare validazione step-by-step            |
| `src/components/automations/steps/EventStep.tsx`   | Usare tipi Trigger DSL                        |
| `src/components/automations/steps/ActionsStep.tsx` | Validazione actions con Zod                   |
| `vitest.config.ts`                                 | Aggiungere test domain se non presente        |

---

## 7. Mappatura Tipi Legacy ↔ DSL

| Legacy Type                  | DSL Type              | Note                                   |
| ---------------------------- | --------------------- | -------------------------------------- |
| `TriggerDef`                 | `AutomationTrigger`   | DSL più specifico con config tipizzato |
| `ConditionDef`               | `AutomationCondition` | DSL simile, operatori rinominati       |
| `ActionDef`                  | `AutomationAction`    | DSL discriminated union                |
| `trigger_definition` (jsonb) | `serializeTrigger()`  | Funzione conversione                   |
| `actions_definition` (jsonb) | `serializeActions()`  | Funzione conversione                   |

---

## 8. Note Implementative

### 8.1 Backward Compatibility

- DSL mantiene compatibilità JSON con legacy
- Adapter functions per conversione in entrambe le direzioni
- Nuovi campi DSL ignorati da API legacy

### 8.2 Validazione Graduale

- Ogni step wizard valida indipendentemente
- Review step valida flow completo
- Errori mostrati per campo specifico

### 8.3 Type Safety

- Nessun `any` nei nuovi tipi
- Discriminated unions per azioni e trigger
- Config tipizzato per ogni variante

---

_Design creato: 2026-05-24_  
_Stato: In attesa approvazione_
