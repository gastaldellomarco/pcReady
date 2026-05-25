# Testing Suite Design

**Date:** 2026-05-25
**Status:** Approved
**Author:** AI + Marco

## Overview

Il progetto ha una suite Vitest con 16 file di test e coverage, ma i componenti UI critici (`CreateTicketModal`, `SwimLaneView`, `AdminUsersTab`) non hanno test dedicati. Inoltre, non esistono test end-to-end. Questo design copre l'aggiunta di unit test per i 3 componenti e un setup minimo Playwright per test E2E locali.

## Decisioni chiave

- **Approccio bilanciato:** unit test Vitest + test E2E Playwright (solo locali)
- **E2E solo locali:** i test Playwright NON girano in CI. Richiedono `supabase start` + dev server
- **Ambiente E2E:** Supabase locale con seed, dati reali, flussi autentici
- **CI:** esegue solo `bun run test` (unitari), invariato

---

## 1. Architettura & Setup

### Unit test (Vitest)

Aggiungere `@testing-library/react` e `@testing-library/user-event` (non presenti nel progetto).

I test vivono in `src/__tests__/` con estensione `.test.tsx`.

Il setup Vitest esistente rimane invariato:
- `environment: "node"`
- `globals: true`
- `include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"]`

**Coverage update:** espandere `coverage.include` per includere `src/components/pcready/CreateTicketModal.tsx`, `src/components/kanban/SwimLaneView.tsx`, `src/components/admin/AdminUsersTab.tsx`. Soglie invariate (60% lines/functions, 50% branches). Obiettivo pratico: ≥70% sui tre componenti target.

### E2E (Playwright)

Installare `@playwright/test` come dev dependency. Browser: Chromium only.

I test E2E in directory `e2e/` (root level, fuori da `src/`).

Script `package.json`: `"test:e2e": "playwright test"`

Configurazione `playwright.config.ts`:
- `testDir: "./e2e"`
- `timeout: 30000`
- `baseURL: "http://localhost:8080"`
- `webServer` con `bun run dev`, `reuseExistingServer: true`

**Prerequisiti per eseguire E2E:**
1. `supabase start` attivo
2. Database seedato
3. `bun run dev` (o `reuseExistingServer: true` lo avvia automaticamente)

### CI

Il workflow CI (`.github/workflows/ci.yml`) rimane invariato. Esegue `bun run test` per i soli unit test.

---

## 2. Strategia di test per componente

### 2.1 SwimLaneView (`SwimLaneView.test.tsx`)

**Complessità:** Bassa. Componente puramente presentazionale.

**Mock necessari:**
- `useTranslation` da `react-i18next` → `vi.mock("react-i18next", ...)`
- `SwimLaneRow` (componente figlio) → mock semplice

**Test cases:**

| # | Test | Verifica |
|---|------|----------|
| 1 | Rendering colonne per ogni status | Ogni status ha una `<th>` con conteggio ticket, badge WIP, progress bar |
| 2 | Colonne collassate | Status collassati mostrano solo pallino + abbreviazione |
| 3 | Drag start | `fireEvent.dragStart` su una card → `onDragStart` chiamato con `id` corretto |
| 4 | Drag over cella | `fireEvent.dragOver` su cella target → `onDragOverCell` chiamato con `cellId` |
| 5 | Drag end | `fireEvent.dragEnd` → `onDragEnd` chiamato |
| 6 | WIP over limit | Quando count > limit, badge e progress bar rossi |
| 7 | Lane rendering | Una lane per ogni tecnico + lane "unassigned" |

### 2.2 CreateTicketModal (`CreateTicketModal.test.tsx`)

**Complessità:** Alta. Dipende da `useServerFn`, Supabase, `AsyncAutocomplete`, `useAuth`, `useTickets`.

**Mock necessari:**

| Modulo | Mock strategy |
|--------|---------------|
| `@tanstack/react-start` (`useServerFn`) | `vi.mock` → restituisce una funzione che chiama il mock sottostante |
| `@/integrations/supabase/client` | `vi.mock` → `.from().select().order().then()` |
| `@/lib/use-tickets` | `vi.mock` → `createOpen`, `closeCreate` |
| `@/lib/auth-context` | `vi.mock` → `user`, `session`, `canEdit` |
| `@/components/pcready/AsyncAutocomplete` | `vi.mock` → renderizza un `<select>` semplice |
| `react-i18next` | `vi.mock` → `t(key) => key` |
| `sonner` | `vi.mock` → `toast.error`, `toast.success`, `toast.message` |
| `@/lib/queries/tickets` | `vi.mock` → `loadClientOptions`, `fetchClientById`, etc. |
| `@/lib/notifications` | `vi.mock` → `createNotification` |
| `@/lib/email-events` | `vi.mock` → `sendTicketAssignedEmail` |
| `@/lib/app-settings` | `vi.mock` → `getPublicAppSettings`, `validateTechnicianDeviceLimit` |
| `@/lib/tickets` | `vi.mock` → `createTicket` |
| `@/lib/server-fn-rate-limit-message` | `vi.mock` → `formatServerFnErrorForToast` |
| `@/lib/queries/activity` | `vi.mock` → `insertActivity` |

**Test cases:**

| # | Test | Verifica |
|---|------|----------|
| 1 | Rendering con `createOpen=true` | Modal visibile, titolo corretto, campi vuoti (client, device, requester, priority default "med") |
| 2 | Modal chiusa con `createOpen=false` | Modal non renderizzata |
| 3 | Submit bloccato: nessun cliente | `toast.error` chiamato, `createTicket` NON chiamato |
| 4 | Submit bloccato: nessun richiedente | `toast.error` chiamato, `createTicket` NON chiamato |
| 5 | Submit bloccato: ticket type "device" senza dispositivo | `toast.error` chiamato, `createTicket` NON chiamato |
| 6 | Submit bloccato: `canEdit=false` | `toast.error` permessi insufficienti |
| 7 | Submit riuscito | `createTicket` chiamato con dati corretti, form resettato, `closeCreate` chiamato, `toast.success` |
| 8 | Submit fallito (API error) | `createTicket` reject → `toast.error`, campi preservati (NON resettati), modale ancora aperto |
| 9 | Free requester toggle | Checkbox spuntato → input testo visibile, `requester_contact_id` vuoto |
| 10 | Cambio ticket type | Selezionando "software" → campo device scompare |

### 2.3 AdminUsersTab (`AdminUsersTab.test.tsx`)

**Complessità:** Media. Dipende interamente da `useAdminUsers` hook.

**Mock necessari:**

| Modulo | Mock strategy |
|--------|---------------|
| `@/hooks/useAdminUsers` | `vi.mock` → restituisce `rows`, `filtered`, `inviteForm`, handler functions |
| `@/lib/auth-context` | `vi.mock` → `session`, `user`, `isAdmin` |
| `react-i18next` | `vi.mock` → `t(key) => key` |
| `sonner` | `vi.mock` → `toast.error`, `toast.success` |
| `@/components/admin/AdminUserRoleEditor` | `vi.mock` → renderizza un `<select>` |
| `@/components/admin/AdminUserStatusBadge` | `vi.mock` → renderizza uno `<span>` |
| `@/components/ui/alert-dialog` | `vi.mock` (tutti gli export) |

**Test cases:**

| # | Test | Verifica |
|---|------|----------|
| 1 | Lista utenti renderizzata | `filtered` con 3 utenti → 3 righe nella tabella, nome/email/ruolo visibili |
| 2 | Loading state | `loadingRows=true` → `TableSkeletonRows` visibile |
| 3 | Empty state | `filtered=[]` → messaggio "Nessun utente trovato" |
| 4 | Invito utente: validazione email | `inviteForm` con errore → messaggio errore visibile, submit disabilitato |
| 5 | Invito utente: submit valido | Form compilato correttamente → `inviteSubmit` chiamato |
| 6 | Cambio ruolo | `saveRole` chiamato con `nextRole` corretto quando `AdminUserRoleEditor.onChange` fire |
| 7 | Permessi insufficienti | `isAdmin=false` → tab potrebbe mostrare stato limitato |
| 8 | Bulk select/deselect | Checkbox "select all" → tutti selezionati; uncheck → nessuno selezionato |
| 9 | Ricerca e filtro | `setQ` chiamato on input change; `setRole` on select change |
| 10 | Delete confirmation | Clic delete → `setDeleteTarget` chiamato; conferma → `confirmRemove` chiamato |

---

## 3. Test E2E (Playwright)

### Configurazione

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:8080",
    headless: true,
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:8080",
    reuseExistingServer: true,
  },
});
```

### Test cases

**`e2e/ticket-flow.spec.ts`** — Creazione e chiusura ticket
- Naviga a `/tickets`
- Clicca pulsante "Nuovo ticket"
- Compila campi obbligatori (cliente, richiedente)
- Submit
- Verifica che il ticket appaia nella lista/kandan

**`e2e/auth-flow.spec.ts`** — Login e accesso dashboard
- Visita `/login`
- Inserisci credenziali
- Verifica redirect a `/`
- Verifica elementi dashboard visibili
- Logout

**`e2e/kanban-drag.spec.ts`** — Drag-and-drop Kanban (opzionale)
- Naviga alla vista Kanban
- Drag di una card da "Pending" a "In Progress"
- Verifica che la card appaia nella colonna target

### Prerequisiti

- `supabase start` attivo con database seedato
- `bun run dev` in esecuzione (o `reuseExistingServer: true`)
- File `e2e/README.md` con istruzioni

---

## 4. File da modificare/creare

| File | Azione |
|------|--------|
| `package.json` | Aggiungere `@testing-library/react`, `@testing-library/user-event` (devDep); aggiungere `@playwright/test` (devDep); aggiungere script `test:e2e` |
| `vite.config.ts` | Espandere `test.coverage.include` |
| `playwright.config.ts` | **Nuovo** — configurazione Playwright |
| `src/__tests__/SwimLaneView.test.tsx` | **Nuovo** — 7 test cases |
| `src/__tests__/CreateTicketModal.test.tsx` | **Sostituire** — da 1 test a 10 test cases |
| `src/__tests__/AdminUsersTab.test.tsx` | **Nuovo** — 10 test cases |
| `e2e/ticket-flow.spec.ts` | **Nuovo** — flusso creazione ticket |
| `e2e/auth-flow.spec.ts` | **Nuovo** — flusso login/logout |
| `e2e/kanban-drag.spec.ts` | **Nuovo** — drag-and-drop Kanban |
| `e2e/README.md` | **Nuovo** — istruzioni setup E2E |

---

## 5. Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| `CreateTicketModal` ha troppe dipendenze per testarlo in modo significativo | Mock aggressivi — testiamo il comportamento (chiamate API, reset form, messaggi toast), non l'integrazione interna |
| `AsyncAutocomplete` è complesso da mockare realisticamente | Mock con semplice `<select>` — sufficiente per testare la logica del form |
| `useServerFn` di TanStack Start potrebbe cambiare API in futuro | I mock sono isolati nel file di test, facili da aggiornare |
| Test drag-and-drop in JSDOM sono limitati | Per `SwimLaneView` testiamo solo le callback, non il comportamento nativo del browser. Il vero drag-and-drop è coperto dal test E2E Playwright |
| E2E richiedono Supabase locale | Documentato in `e2e/README.md`; non bloccano la CI |
