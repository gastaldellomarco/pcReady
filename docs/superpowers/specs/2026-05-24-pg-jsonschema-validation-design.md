# Design: JSON Schema Validation with pg_jsonschema

## 1. Panoramica

### Obiettivo

Abilitare l'estensione `pg_jsonschema` di Supabase per validare i campi JSONB delle automazioni a livello database, prevenendo corruzione dati da script, bug o richieste dirette.

### Scope

- Abilitare estensione `pg_jsonschema` nel database Supabase
- Aggiungere check constraints su `automation_flows` per validare JSON Schema
- Validare `trigger_definition` e `actions_definition`

### Non-Scope

- Cambiamenti alla logica runtime (frontend/backend)
- Validazione di tutti i campi (fase 1: trigger type e action type)

### Acceptance Criteria

- [ ] Estensione `pg_jsonschema` abilitata nel progetto
- [ ] Check constraint su `trigger_definition` che valida `type`
- [ ] Check constraint su `actions_definition` che valida `type` per ogni azione
- [ ] Salvataggi con JSON non valido falliscono con errore chiaro

---

## 2. Architettura

### 2.1 Estensione pg_jsonschema

**Documentazione**: https://supabase.com/docs/guides/database/extensions/pg_jsonschema

L'estensione fornisce la funzione `jsonb_matches_schema(schema jsonb, data jsonb)` per validare JSON contro uno schema.

### 2.2 JSON Schemas

#### Trigger Schema

```json
{
  "type": "object",
  "required": ["type"],
  "properties": {
    "type": {
      "type": "string",
      "enum": ["ticket_created", "ticket_updated", "sla_due", "warranty_due", "scheduled"]
    },
    "config": {
      "type": "object"
    }
  }
}
```

#### Action Schema (per singola azione)

```json
{
  "type": "object",
  "required": ["type"],
  "properties": {
    "type": {
      "type": "string",
      "enum": [
        "send_email",
        "update_ticket",
        "add_comment",
        "create_ticket",
        "create_notification",
        "assign_ticket",
        "update_device"
      ]
    },
    "id": { "type": "string" },
    "order": { "type": "number" },
    "config": {
      "type": "object"
    }
  }
}
```

#### Actions Array Schema

```json
{
  "type": "array",
  "minItems": 1,
  "items": {
    "$ref": "#/definitions/action"
  },
  "definitions": {
    "action": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "send_email",
            "update_ticket",
            "add_comment",
            "create_ticket",
            "create_notification",
            "assign_ticket",
            "update_device"
          ]
        },
        "id": { "type": "string" },
        "order": { "type": "number" },
        "config": { "type": "object" }
      }
    }
  }
}
```

### 2.3 Check Constraints

```sql
-- Abilita estensione
CREATE EXTENSION IF NOT EXISTS pg_jsonschema;

-- Constraint per trigger_definition
ALTER TABLE automation_flows
ADD CONSTRAINT chk_trigger_definition_type
CHECK (
  trigger_definition IS NULL OR
  jsonb_matches_schema(
    '{
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["ticket_created", "ticket_updated", "sla_due", "warranty_due", "scheduled"]
        }
      }
    }'::jsonb,
    trigger_definition
  )
);

-- Constraint per actions_definition
ALTER TABLE automation_flows
ADD CONSTRAINT chk_actions_definition_types
CHECK (
  actions_definition IS NULL OR
  jsonb_matches_schema(
    '{
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["type"],
        "properties": {
          "type": {
            "type": "string",
            "enum": ["send_email", "update_ticket", "add_comment", "create_ticket", "create_notification", "assign_ticket", "update_device"]
          }
        }
      }
    }'::jsonb,
    actions_definition
  )
);
```

---

## 3. Migrazione SQL

### 3.1 File: `supabase/migrations/20260524230000_add_pg_jsonschema_constraints.sql`

```sql
-- Migration: Add pg_jsonschema validation to automation_flows
-- Created: 2026-05-24

-- Enable pg_jsonschema extension
CREATE EXTENSION IF NOT EXISTS pg_jsonschema;

-- Add check constraint for trigger_definition type validation
ALTER TABLE automation_flows
ADD CONSTRAINT IF NOT EXISTS chk_trigger_definition_type
CHECK (
  trigger_definition IS NULL OR
  jsonb_matches_schema(
    '{
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "ticket_created",
            "ticket_updated",
            "sla_warning",
            "sla_due",
            "warranty_expiring_soon",
            "warranty_due",
            "scheduled"
          ]
        }
      }
    }'::jsonb,
    trigger_definition
  )
);

-- Add check constraint for actions_definition type validation
ALTER TABLE automation_flows
ADD CONSTRAINT IF NOT EXISTS chk_actions_definition_types
CHECK (
  actions_definition IS NULL OR
  jsonb_matches_schema(
    '{
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["type"],
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "send_email",
              "update_ticket_status",
              "update_ticket",
              "add_comment",
              "create_ticket",
              "create_notification",
              "assign_ticket",
              "update_device_status",
              "update_device"
            ]
          }
        }
      }
    }'::jsonb,
    actions_definition
  )
);

-- Add helpful comment explaining constraints
COMMENT ON CONSTRAINT chk_trigger_definition_type ON automation_flows IS
  'Validates that trigger_definition.type is one of the allowed DSL trigger types';

COMMENT ON CONSTRAINT chk_actions_definition_types ON automation_flows IS
  'Validates that all actions in actions_definition have valid DSL action types';
```

---

## 4. Verifica Constraints

### 4.1 Test Valid

```sql
-- Should succeed
INSERT INTO automation_flows (name, trigger_definition, actions_definition)
VALUES (
  'Test Valid',
  '{"type": "ticket_created"}'::jsonb,
  '[{"type": "send_email", "id": "a1", "order": 0}]'::jsonb
);
```

### 4.2 Test Invalid Trigger

```sql
-- Should fail with check constraint violation
INSERT INTO automation_flows (name, trigger_definition, actions_definition)
VALUES (
  'Test Invalid Trigger',
  '{"type": "invalid_trigger"}'::jsonb,
  '[{"type": "send_email", "id": "a1", "order": 0}]'::jsonb
);
-- ERROR: new row for relation "automation_flows" violates check constraint "chk_trigger_definition_type"
```

### 4.3 Test Invalid Action

```sql
-- Should fail with check constraint violation
INSERT INTO automation_flows (name, trigger_definition, actions_definition)
VALUES (
  'Test Invalid Action',
  '{"type": "ticket_created"}'::jsonb,
  '[{"type": "invalid_action", "id": "a1", "order": 0}]'::jsonb
);
-- ERROR: new row for relation "automation_flows" violates check constraint "chk_actions_definition_types"
```

---

## 5. Error Handling Backend

### 5.1 Intercettare Errori Constraint

Quando il backend riceve un errore di constraint dal database, dovrebbe:

1. Riconoscere il tipo di errore (check constraint violation)
2. Estrarre il nome del constraint
3. Mappare a un messaggio user-friendly

```typescript
// Esempio di mapping errori
const CONSTRAINT_ERROR_MESSAGES: Record<string, string> = {
  chk_trigger_definition_type: "Tipo trigger non valido. Usa uno dei tipi DSL supportati.",
  chk_actions_definition_types: "Tipo azione non valido. Controlla le azioni configurate.",
};

function handleDatabaseError(error: PostgrestError): string {
  if (error.code === "23514") {
    // check_violation
    const constraint = error.message.match(/constraint "([^"]+)"/)?.[1];
    return CONSTRAINT_ERROR_MESSAGES[constraint] || "Dati non validi per il campo JSON.";
  }
  return error.message;
}
```

### 5.2 Messaggi Comprensibili nel Wizard

L'errore dovrebbe essere mostrato all'utente nel contesto appropriato:

- `chk_trigger_definition_type` → Mostra errore nello step "Evento"
- `chk_actions_definition_types` → Mostra errore nello step "Azioni"

---

## 6. File da Creare

| File                                                                   | Scopo                                   |
| ---------------------------------------------------------------------- | --------------------------------------- |
| `supabase/migrations/20260524230000_add_pg_jsonschema_constraints.sql` | Migrazione con estensione e constraints |

---

## 7. Deployment Steps

1. **Abilitare estensione** (via dashboard o SQL):

   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_jsonschema;
   ```

2. **Applicare migrazione**:

   ```bash
   supabase db push
   ```

3. **Verificare**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_jsonschema';
   \d automation_flows  -- controlla constraints
   ```

---

## 8. Note Implementative

### 8.1 Backward Compatibility

- I constraints accettano `NULL` (per record esistenti senza dati)
- I tipi legacy (es. `sla_warning`) sono inclusi nell'enum per compatibilità
- La migrazione usa `IF NOT EXISTS` per essere idempotente

### 8.2 Performance

- `jsonb_matches_schema` ha overhead minimo per validazione semplice
- I constraints sono check constraints (validati solo su INSERT/UPDATE)
- Considerare l'aggiunta di indici GIN se necessario per query JSON

### 8.3 Estensione Futura

- Aggiungere validazione più profonda del config (es. `cron` formato)
- Validare `conditions_definition` con schema conditions
- Aggiungere trigger per validazione automatica su update

---

_Design creato: 2026-05-24_  
_Stato: In attesa approvazione_
