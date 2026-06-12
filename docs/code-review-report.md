# Code Review Report — PCReady

> **Data:** 9 Giugno 2026 (aggiornato)
> **Repo:** `github.com/gastaldellomarco/pcReady`
> **Lingua:** Italiano
> **Stime:** S/M/L/XL

---

## Top 10 Problemi più Critici (per Impatto)

| # | Problema | Area | Rischio | Effort | Stato |
|---|---------|------|---------|--------|-------|
| 1 | `document_signatures` — RLS abilitata ma nessuna policy definita | Sicurezza | 🔴 Alto | S | ✅ **Fix applicato** |
| 2 | `noImplicitAny: false` in tsconfig + centinaia di `as any` | TypeScript | 🔴 Alto | XL | 🔄 **In corso** — `useState<any>`, `catch (err: any)` e interfacce locali eliminate dai componenti UI; `any` parametrizzati nelle handler server; rimangono `as any` su query/server |
| 3 | Errori utente nascosti via `console.error()` → toast | Architettura | 🟡 Medio | M | ✅ **20 componenti fixati** (6 widget + 4 modali + 5 intermedi + 5 finali) |
| 4 | 19 vulnerabilità note → risolte 16/19 (3 moderate uuid in Storybook devDeps). Vite vulnerability risolta con Storybook 10.4.2 | Sicurezza | 🟡 Medio | M | ✅ **16 risolte, Storybook 10.4.2** |
| 6 | Chiamate Supabase dirette in componenti e route (bypass RLS lato server) | Architettura | 🟡 Medio | L | ⏳ Da fare |
| 7 | `useDashboardData.ts` — hook orchestratore con 6+ responsabilità (SRP) | Architettura | 🟡 Medio | L |
| 8 | Solo 1 file `.stories.tsx` su 30+ componenti — no visual regression testing | Testing | 🟡 Medio | M |
| 9 | Nessun workflow di deploy automatico (Wrangler/Cloudflare assente) | CI/CD | 🟡 Medio | L |
| 10 | Duplicazione logica serializzazione: `domain/automation.ts` vs `lib/automations/*-adapter.ts` | DRY | 🟢 Basso | M |
| 11 | Componenti dashboard con `useState<any[]>([])` — type safety nulla | TypeScript | 🟡 Medio | M | ✅ **Tutti i `useState<any>` eliminati** da widget dashboard + componenti non-dashboard (TicketNotes, TicketRelations, EventModal, NewTicketForm, PortalLayout) |

---

## 1. TypeScript & Type Safety

### 1.1 🟡 `noImplicitAny: false` indebolisce significativamente lo strict mode

- File: `tsconfig.json` (riga 20)
- Rischio: 🟡 Medio
- Problema: `"strict": true` è attivo (quindi `strictNullChecks`, `strictFunctionTypes`, etc. sono operativi), ma `"noImplicitAny": false` permette parametri di funzione senza tipo esplicito. Questo indebolisce il controllo dei tipi senza rimuoverlo completamente.
- Soluzione:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    // rimuovere o impostare a true
  }
}
```

### 1.2 🔴 `@typescript-eslint/no-explicit-any: off` — 200+ match di `as any`

- File: `eslint.config.js` (righe 123-136)
- Rischio: 🔴 Alto
- Problema: ESLint ha `no-explicit-any` disabilitato per quasi tutti i path. Questo permette centinaia di `as any` casting che bypassano il type system. Il commento `#58` indica che è una scelta voluta in attesa di un refactoring graduale.
- Pattern comuni trovati:
  - `(queries as any).useXxx()` — 20+ occorrenze in componenti client/contacts/inventory
  - `(supabaseAdmin as any).rpc(...)` — `src/lib/admin-permissions.ts`, `src/lib/audit-log.ts`
  - `(supabaseAdmin as any).from(...)` — `src/lib/app-settings.ts`
  - `useState<any[]>([])` — ✅ **ELIMINATI** da tutti i componenti UI (6 widget dashboard + 5 non-dashboard tipizzati il 9 Giugno)
  - `catch (err: any)` — ✅ **ELIMINATI** dai componenti UI fixati oggi (8 sostituzioni con `catch (err: unknown)` + `instanceof Error` in TicketDetailModal, kanban.lazy, TicketNotes, TicketRelations); rimangono in file server/query non toccati
  - `(globalThis as any).__APP_SETTINGS__` — `src/lib/app-settings.ts`, `src/hooks/useAuthGuard.ts`
- Soluzione:
```typescript
// Invece di:
const [tickets, setTickets] = useState<any[]>([]);

// Usare:
import type { DashboardTicketRow } from "@/lib/queries/dashboard";
const [tickets, setTickets] = useState<DashboardTicketRow[]>([]);
```

### 1.3 🟢 Tipi `any` in componenti dashboard e non-dashboard — ✅ RISOLTO

- File: `src/components/dashboard/*.tsx`, `src/components/tickets/*.tsx`, `src/components/calendar/EventModal.tsx`, `src/components/portal/*.tsx`
- Rischio: 🟡 Medio → 🟢 Basso (dopo fix)
- **Fix applicato (9 Giugno):** Tutti i `useState<any>` / `useState<any[]>` nei componenti UI sono stati eliminati:
  - **6 widget dashboard:** `CriticalEventsWidget` (`OverdueTicketRow[]`), `OverdueTicketsWidget` (`OverdueTicketRow[]`), `TechnicianStatsWidget` (`TechnicianStatRow[]`), `TechnicianHeatmapWidget` (`WeeklyActivityResponse | null`), `TechnicianRadarWidget` (`TechnicianRadarRow[]`), `TeamActivityWidget` (`TechnicianStatRow[]`)
  - **5 componenti non-dashboard:** `TicketNotes` (`TechnicianOption[]`), `TicketRelations` (`RelatedTicketLite[]`), `EventModal` (tipi inline per `clientOptions`/`ticketOptions`), `NewTicketForm` (`PortalDeviceRow[]`), `PortalLayout` (`PortalBranding | null`)
- **Deduplicazione:** `TechnicianStatRow` era definito due volte → estratto in `src/lib/dashboard-analytics.ts` come `export interface`.
- **Interfacce locali estratte in file condivisi (9 Giugno):**
  - `CalendarClientOption` da `EventModal.tsx` (inline) → `src/lib/queries/calendar.ts` (export)
  - `CalendarTicketLink` già esistente in `queries/calendar.ts`, ora importato da `EventModal.tsx`
  - `WeeklyActivityTechnician`, `WeeklyActivityResponse` da `TechnicianHeatmapWidget.tsx` → `src/lib/dashboard-analytics.ts` (export)
  - `NormalizedMetrics`, `TechnicianRadarRow` da `TechnicianRadarWidget.tsx` → `src/lib/dashboard-analytics.ts` (export)
  - `TicketDetailRow`, `TicketDeviceAssignmentRow`, `TicketMaterialItem`, `TicketMaterialDraft`, `DetailTab`, `TicketTimelineItem` da `TicketDetailModal.tsx` → `src/lib/queries/tickets.ts` (export)
- **Server function return types tipizzati:**
  - `getTechnicianWeeklyActivity`: `Promise<any>` → `Promise<WeeklyActivityResponse>`
  - `getTechnicianRadarMetrics`: `Promise<any>` → `Promise<{ dateFrom?: string; dateTo?: string; rows: TechnicianRadarRow[] }>`
  - `fetchCalendarClientOptions`: cast allineato a `CalendarClientOption[]`
  - Handler `getTechnicianWeeklyActivity`: parametri `any` tipizzati con `TechRoleRow`, `TechProfileRow`, `WeeklyActivityTechnician[]`
  - Handler `getTechnicianRadarMetrics`: `r: any` → `TechRoleRow`, `notes`/`history`/`rows` tipizzati con tipi espliciti
  - Handler `getTechnicianStats`: `r: any` → `TechRoleRow`
- **Parametri `computeTechnicianStats`:** Tipizzati con interfacce esplicite (`TechRoleRow`, `TechProfileRow`, `OpenTicketRow`); rimossi cast interni `Map<any>` e `out: any[]`.
- **Test aggiornati:** 8 asserzioni `!` non-null su `rows.find()` in `dashboard-analytics.test.ts`.
- **Unici `any` rimasti nei componenti UI:** `navigate({...} as any)` / `search={{} as any}` per TanStack Router. (`catch (err: any)` → `catch (err: unknown)` completato con 8+21 sostituzioni in tutti i componenti UI; interfacce locali tutte estratte in file condivisi).

### 1.4 🟡 `Record<string, any>` in componenti ExportPdf

- File: `src/components/ExportPdf.tsx` (righe 29, 33, 46)
- Rischio: 🟡 Medio
- Problema: `fetchAll: (filters: Record<string, any>) => ...` e `activeFilters: Record<string, any>`. Generics non tipizzati.
- Soluzione:
```typescript
type FetchAllFn<TData> = (filters: Record<string, unknown>) => Promise<{ data: TData[]; count: number }>;
```
- **Nota (9 Giugno):** Il pattern di estrazione delle interfacce locali in file condivisi è stato applicato a:
  - `queries/calendar.ts` (1 interfaccia da EventModal)
  - `dashboard-analytics.ts` (4 interfacce da TechnicianHeatmapWidget e TechnicianRadarWidget)
  - `queries/tickets.ts` (6 interfacce da TicketDetailModal)
  Lo stesso pattern andrebbe esteso a `ExportPdf.tsx` per eliminare `Record<string, any>` e a `DeviceDetailModal.tsx` per le sue interfacce duplicate.

### 1.5 🟢 Casting `as any` su navigate/search di TanStack Router

- File: `src/components/dashboard/TechnicianStatsWidget.tsx`, `TeamActivityWidget.tsx`, `CriticalEventsWidget.tsx`
- Rischio: 🟢 Basso
- Problema: `navigate({ to: "/_app/tickets", search: { technician: tech.id } } as any)` — il type-safe di TanStack Router viene bypassato. I `useState<any>` sono stati tutti tipizzati, ma i cast su `navigate` rimangono.
- **Nota:** Dopo i fix di tipizzazione, gli unici `as any` rimasti nei widget dashboard sono i cast su `navigate`/`search` di TanStack Router. Tutti gli `useState<any>` sono stati eliminati.

---

## 2. Architettura & Separation of Concerns

### 2.1 🟡 Errori utente nascosti via `console.error()` — ✅ QUASI COMPLETAMENTE RISOLTO (20/20+)

- File: Multipli (~50+ match di `console.error` e `.catch(() => {})` silenziosi)
- Rischio: 🟡 Medio → 🟢 Basso (dopo fix)
- **Fix applicato (9 Giugno):** 20 componenti fixati con pattern `console.error` + `toast.error`:
  - **6 widget dashboard:** `OverdueTicketsWidget`, `CriticalEventsWidget`, `TechnicianStatsWidget`, `TechnicianHeatmapWidget`, `TechnicianRadarWidget`, `TeamActivityWidget`
  - **4 modali/route:** `TicketDetailModal` (5 catch block), `CreateTicketModal` (2 catch block), `kanban.lazy.tsx` (1 catch block), `tickets.lazy.tsx` (2 catch block)
  - **5 componenti intermedi:** `EventModal` (2 catch), `TicketRelations` (1 catch), `TicketNotes` (1 catch + toast), `NewTicketForm` (1 catch + toast + useTranslation), `PortalLayout` (1 catch + toast + useTranslation)
  - **5 componenti finali:** `VersionBadge` (1 catch), `ScriptShareDialog` (2 catch + toast + rimosso dead code), `SupportContact` (1 catch), `CodeBlock` (1 catch), `MaintenanceSchedulePanel` (2 catch)
- **Pattern applicato:**
  - Catch critici (flussi utente principali): `console.error` + `toast.error` + fallback (es. `setTechnicians([])`)
  - Catch background (caricamenti silenziosi, device search): solo `console.error` senza toast
  - `.catch(() => {})` vuoti: ora almeno loggano `console.error` per debugging
- **Rimangono:** Solo file server-side (`lib/`, `integrations/`, `routes/auth.tsx`) dove `toast` non è applicabile. Tutti i componenti UI/client-side sono stati fixati.
- **Pattern raccomandato:**
```typescript
import { toast } from "sonner";

try {
  const data = await fetcher({ data: { accessToken, thresholdDays: 5 } });
  setTickets(data ?? []);
} catch (err) {
  console.error("Failed to load overdue tickets", err);
  toast.error(t("widgets.loadError", "Errore caricamento ticket scaduti"));
  setTickets([]);
}
```

### 2.2 🟡 `useDashboardData.ts` — hook orchestratore (violazione SRP)

- File: `src/hooks/useDashboardData.ts`
- Rischio: 🟡 Medio
- Problema: L'hook gestisce **6+ responsabilità**:
  1. Date range management (delegato a `useDashboardDateRange`)
  2. Analytics fetching (delegato a `useDashboardAnalytics`)
  3. Snapshot data fetching (delegato a `useDashboardSnapshot`)
  4. Real-time subscriptions a 5 tabelle
  5. Deduplication logic per logs
  6. Counts computation per stato ticket
  7. Gestione errori con toast
  8. `setPendingCount` side-effect
- Soluzione: Estrarre in hook più piccoli:
  - `useDashboardTicketsSnapshot()` — solo fetching ticket
  - `useDashboardRealtimeSync()` — solo realtime subscriptions
  - `useTicketStatusCounts(tickets)` — puro, senza side-effect

### 2.3 🟡 Chiamate Supabase dirette fuori da `src/integrations/`

- File: `src/routes/_app/dashboard.lazy.tsx`, `src/routes/_app/costs.lazy.tsx`, `src/routes/_app/clients.lazy.tsx`, `src/lib/app-settings.ts`, `src/lib/admin-permissions.ts`, `src/lib/audit-log.ts`
- Rischio: 🟡 Medio
- Problema: Chiamate `(supabase as any).from(...)` e `supabaseAdmin.rpc(... as any)` sparse in route component e librerie invece di passare attraverso il domain layer o integration layer. Questo bypassa l'astrazione e rende difficile testare e manutenere.
- Soluzione: Centralizzare le query Supabase in `src/lib/queries/` usando i pattern già esistenti (es. `src/lib/queries/dashboard.ts`), mai chiamare Supabase direttamente dai componenti.

### 2.4 🟢 Domain layer delle automazioni ben strutturato

- File: `src/domain/automation.ts`, `src/domain/automation-variables.ts`, `src/domain/automation.schema.ts`
- Rischio: 🟢 Basso (positivo)
- Nota: Il domain layer delle automazioni è ben fatto: tipi DSL dedicati, funzioni di serializzazione/deserializzazione, factory functions, validation. È effettivamente importato da 20+ file in `src/components/automations/`, `src/hooks/`, `src/lib/`. **Questa è una buona pratica che va estesa ad altri domini.**

### 2.5 🟢 Validazione input con Zod — presente ma non uniforme

- File: `src/domain/automation.schema.ts`, `src/routes/_app/scripts.tsx` (riga 937)
- Rischio: 🟢 Basso
- Nota: Zod è usato per la validazione nel modulo automazioni (`automation.schema.ts`). Tuttavia, in `scripts.tsx` si trova `zodResolver(ScriptSchema as any)` — il `as any` annulla completamente la validazione Zod. Questo pattern è rischioso: se la validazione è aggirabile con un cast, allora non è vera validazione.

### 2.6 🟢 Lazy loading delle route già implementato

- File: `src/router.tsx`, `src/routes/*.lazy.tsx`
- Rischio: 🟢 Basso (positivo)
- Nota: Tutte le route usano lazy loading (`*.lazy.tsx`), TanStack Router con `defaultPendingComponent` e `defaultErrorComponent`. Code splitting funzionante.

---

## 3. Performance

### 3.1 🟡 Bundle splitting ben configurato ma mancano chunk per moduli grandi

- File: `vite.config.ts` (righe 78-101)
- Rischio: 🟡 Medio
- Problema: `manualChunks` separa vendor, supabase, pdf, charts, dnd, flow, swagger, radix. Tuttavia `chunkSizeWarningLimit: 500KB` potrebbe essere troppo alto per alcuni moduli:
  - `swagger-ui-react` — pacchetto large (~2MB) ma già isolato in `vendor-swagger`
  - `@react-pdf/renderer` — ~1MB, già in `vendor-pdf`
  - `recharts` — già in `vendor-charts`
- Suggerimento: Abbassare `chunkSizeWarningLimit` a 300KB e verificare con `VITE_ANALYZE=true` se ci sono chunk oltre soglia.

### 3.2 🟡 Dashboard widget — potenziali re-render a catena

- File: `src/components/dashboard/TechnicianStatsWidget.tsx`, `OverdueTicketsWidget.tsx`, `CriticalEventsWidget.tsx`
- Rischio: 🟡 Medio
- Problema: I widget dashboard usano `useState<any[]>([])` + `useCallback` + `useEffect` con polling (`setInterval` 30s-60s). Ogni polling refresh causa re-render di tutti i widget dashboard. Inoltre:
  - `setInterval` anche quando il componente non è visibile (es. in background tab)
  - Manca `React.memo` sui widget per evitare re-render quando i props non cambiano
- Soluzione:
```typescript
// Aggiungere React.memo ai widget
export const CriticalEventsWidget = React.memo(function CriticalEventsWidget({
  accessToken,
}: CriticalEventsWidgetProps) {
  // ...
});

// Usare visibility API per fermare polling quando non visibile
useEffect(() => {
  const handleVisibility = () => {
    if (document.visibilityState === "visible") void load();
  };
  document.addEventListener("visibilitychange", handleVisibility);
  return () => document.removeEventListener("visibilitychange", handleVisibility);
}, [load]);
```

### 3.3 🟢 ViteImageOptimizer già configurato

- File: `vite.config.ts` (righe 33-41)
- Rischio: 🟢 Basso (positivo)
- Nota: `ViteImageOptimizer` attivo in build con qualità 80% per png/jpeg/webp, 70% per avif. SVG con `removeViewBox: false`.

### 3.4 🟢 CSS Code Splitting e lazy loading delle route

- File: `vite.config.ts` (riga 67: `cssCodeSplit: true`)
- Rischio: 🟢 Basso (positivo)
- Nota: CSS split abilitato, route tutte lazy-loaded. Buona configurazione di base.

---

## 4. Sicurezza

### 4.1 🔴 `document_signatures` — RLS abilitata ma NESSUNA POLICY DEFINITA

- File: `supabase/migrations/20260603130000_document_signatures.sql`
- Rischio: 🔴 Alto
- Problema: La tabella `document_signatures` ha `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` ma **nessuna `CREATE POLICY`** corrispondente. Con RLS abilitata senza policy, TUTTE le operazioni vengono bloccate (default deny), ma:
  - Se un utente ha bypassato RLS (es. service_role key), i dati sono completamente accessibili
  - La mancanza di policy esplicite può causare bug silenziosi (nessuno può leggere/scrivere)
- Soluzione:
```sql
-- Aggiungere policy per la tabella document_signatures
CREATE POLICY "Clients can view own signatures"
  ON public.document_signatures FOR SELECT
  USING (client_id IN (
    SELECT client_id FROM public.client_contacts WHERE id = auth.uid()
  ));

CREATE POLICY "Clients can insert own signatures"
  ON public.document_signatures FOR INSERT
  WITH CHECK (client_id IN (
    SELECT client_id FROM public.client_contacts WHERE id = auth.uid()
  ));
```

### 4.2 🔴 19 vulnerabilità note (4 high)

- File: `package.json`
- Rischio: 🔴 Alto
- Problema: `npm audit` ha rilevato 19 vulnerabilità:
  - **High** (4): `axios`, `lodash`, `picomatch`, `vite`
  - **Moderate** (15): `@tanstack/start-server-core`, `brace-expansion`, `h3`, `postcss`, `srvx`, `uuid`, `ws`
  - La maggior parte risolvibile con `npm audit fix`, alcune richiedono `--force`
- Soluzione: Eseguire `npm audit fix` e verificare breaking changes con `--force` dove necessario. Per `axios` e `lodash`, valutare la sostituzione con alternative più sicure (fetch nativo, native Node APIs).

### 4.3 🟡 Variabili d'ambiente VITE_ embeddate nel bundle client

- File: `.env.example`, `.env`
- Rischio: 🟡 Medio
- Problema: `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` sono embeddate nel bundle client. La `SUPABASE_PUBLISHABLE_KEY` è **pubblica per design** (anon key), ma la presenza di `SUPABASE_SERVICE_ROLE_KEY` in `.env.example` suggerisce che potrebbe essere esposta accidentalmente.
- Nota: Il codice gestisce correttamente sia `import.meta.env.VITE_*` (client) che `process.env.*` (SSR). **Non ci sono VITE_ che espongono secrets.**

### 4.4 🟢 Auth storage: sessionStorage invece di localStorage

- File: `src/integrations/supabase/client.ts` (riga 74)
- Rischio: 🟢 Basso (positivo)
- Nota: Uso di `sessionStorage` per auth tokens — riduce l'impatto di vulnerabilità XSS. Documentato chiaramente nel codice.

### 4.5 🟢 Rate limiting già implementato per admin operations

- File: `src/lib/rate-limit-config.ts`, `src/lib/admin-users.ts`
- Rischio: 🟢 Basso (positivo)
- Nota: Rate limiting presente per `INVITE_ADMIN_USER` con soglia `3/10min`. Supporto Upstash Redis per multi-instance.

### 4.6 🟢 Maggior parte delle tabelle con RLS policy

- File: `supabase/migrations/*.sql`
- Rischio: 🟢 Basso (positivo)
- Nota: Delle 50+ migration, quasi tutte le tabelle hanno `CREATE POLICY` corrispondente. Solo `document_signatures` è il caso critico (RLS sì, policy no). Alcune tabelle hanno rapporto 1:1 (tabelle:policy) — protezione minimalista ma funzionale (es. `client_portal.sql`, `audit_log_retention_archived.sql`, `widget_annotations.sql`).

---

## 5. Testing

### 5.1 🟡 Solo 1 file Storybook su 30+ componenti

- File: `src/components/ui/DatePickerInput.stories.tsx` (unico file *.stories.tsx)
- Rischio: 🟡 Medio
- Problema: Storybook è configurato con addon-a11y, addon-themes, addon-interactions, ma solo 1 file di storie. Non c'è visual regression testing né documentazione interattiva per i componenti. Add-on a11y presente ma non utilizzato.

### 5.2 🟡 3 soli test E2E per flussi critici

- File: `e2e/auth-flow.spec.ts`, `e2e/kanban-drag.spec.ts`, `e2e/ticket-flow.spec.ts`
- Rischio: 🟡 Medio
- Problema: I test E2E coprono solo auth, kanban drag, e ticket flow. **Flussi NON coperti:**
  - CRUD clienti
  - CRUD inventario/dispositivi
  - Gestione checklist
  - Automazioni
  - Cost management
  - Portal client
  - Calendario
- Soluzione: Aggiungere test E2E per i flussi CRUD principali mancanti.

### 5.3 🟢 Buona copertura unit test per hooks e domain logic

- File: `src/__tests__/` (15+ file di test)
- Rischio: 🟢 Basso (positivo)
- Nota: Test presenti per:
  - `useDashboardLayout`, `useWidgetAnnotations`, `useAdminSettingsForm`, `useAutomationBuilder`, `useAutomationLogs`
  - `automation.spec.ts` (domain)
  - `queries.mutations.test.ts`
  - `inventory-import.test.ts`, `dashboard-analytics.test.ts`
  - `app-settings.test.ts`
  - `AdminUsersTab.test.tsx`, `CreateTicketModal.test.tsx`
  - Coverage thresholds: lines 60%, functions 60%, branches 50%

### 5.4 🟢 A11y testing configurato

- File: `src/__tests__/setup.ts`
- Rischio: 🟢 Basso (positivo)
- Nota: `vitest-axe` con `toHaveNoViolations` matcher già configurato. Pronto per l'uso.

---

## 6. i18n & Accessibilità

### 6.1 🟢 Stringhe hardcoded in italiano eliminate

- File: Multipli
- Rischio: 🟡 Medio → 🟢 Basso (dopo fix)
- **Fix applicato (9 Giugno):**
  - `NewTicketForm.tsx`: Aggiunto `useTranslation("common")`, toast usa `t("portal.devicesLoadError", ...)` invece di hardcoded
  - `PortalLayout.tsx`: Aggiunto `useTranslation("common")`, toast usa `t("portal.sessionValidationError", ...)` invece di hardcoded
  - `docs.lazy.tsx`: `aria-label="Clear search"` → `t("docs.clearSearch", ...)`, `+n more articles` → `t("docs.moreArticles", ...)` con interpolazione
  - Aggiunte 14 nuove chiavi i18n complessive in `tickets.json`, `kanban.json`, `common.json` (IT/EN) per supportare i toast degli errori e i label
- **Audit route _app (9 Giugno):** Tutte le 17+ route esaminate — toast, placeholder, aria-label, testo JSX già tutti i18n-izzati. Solo 2 stringhe hardcoded in `docs.lazy.tsx` (ora fixate).
- **Pattern:** I componenti che avevano solo `console.error` ora hanno `toast.error(t("namespace.key", "fallback"))`.

### 6.2 🟢 Ottima struttura i18n: 17 namespace per it e en

- File: `src/i18n/index.ts`, `src/i18n/locales/{it,en}/`
- Rischio: 🟢 Basso (positivo)
- Nota: 17 namespace (common, tickets, dashboard, inventory, kanban, clients, contacts, costs, checklist, automations, bundles, scripts, notifications, calendar, admin, profile, warehouse) con traduzioni complete per italiano e inglese. Fallback lingua IT.

### 6.3 🟡 Attributi aria-* presenti ma non sistematici

- File: `src/components/dashboard/` (21 match di aria)
- Rischio: 🟡 Medio
- Problema: Gli attributi `aria-*` sono presenti in molti componenti dashboard (`aria-label`, `aria-hidden`, `aria-pressed`) ma non tutti gli elementi interattivi hanno label. Elementi critici mancanti:
  - Bottoni refresh nei widget dashboard (es. `CriticalEventsWidget.tsx`) hanno solo icona `RefreshCw` senza `aria-label`
  - Pulsanti period (Oggi/Settimana/Mese) in `TechnicianStatsWidget.tsx` non hanno `aria-pressed`
  - Navigazione con `<button>` senza testo (solo icona)

### 6.4 🟢 WCAG color contrast — CSS variables ben strutturate

- File: `src/styles.css`
- Rischio: 🟢 Basso (positivo)
- Nota: Design system v2 con CSS variables per light/dark mode. Contrasti base adeguati:
  - Primary `#2563eb` su background `#ffffff` — rapporto 4.6:1 (AA per testo normale)
  - Testo primario `#0f172a` su background `#f8fafc` — rapporto 15.2:1 (AAA)
  - Dark mode contrasti adeguati (testo `#f1f5f9` su sfondo `#0f172a` — rapporto 14.7:1)

---

## 7. CI/CD & DevOps

### 7.1 🟡 Nessun deploy automation — Wrangler/Cloudflare assente

- File: `.github/workflows/` (nessun workflow di deploy)
- Rischio: 🟡 Medio
- Problema: Il prompt originale menziona Cloudflare Workers / Wrangler, ma:
  - **Nessun file `wrangler.toml`** trovato nella repo
  - **Nessun workflow di deploy** in `.github/workflows/`
  - Il deploy è probabilmente manuale o in un repository separato
  - Nessuna separazione staging/production

### 7.2 🟡 Workflow CI completo ma mancano quality gate

- File: `.github/workflows/ci.yml`
- Rischio: 🟡 Medio
- Problema: Il workflow CI esegue `typecheck → lint → test → migrations:check → build`. Manca:
  - **Coverage threshold check** nel workflow (il `coverage.thresholds` in vite.config.ts non è vincolante nel CI)
  - **Bundle size check / Lighthouse performance budget** non integrato come fail gate
  - **Dependency audit** (`bun audit` / `npm audit`) non eseguito nel CI
- Soluzione:
```yaml
# Aggiungere step nel workflow CI
- run: bun run lint
- run: bun run typecheck
- run: bun run test -- --coverage.thresholds.lines=60
- run: bun run build
- run: npm audit --audit-level=high  # fallisce CI se vulnerabilità high
```

### 7.3 🟢 Secrets management via GitHub Secrets

- File: `.github/workflows/ci.yml` (env section)
- Rischio: 🟢 Basso (positivo)
- Nota: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_URL` sono tutti in `${{ secrets.* }}`. Buona práctica.

### 7.4 🟢 Workflow di Release con versionamento semver

- File: `.github/workflows/release.yml`
- Rischio: 🟢 Basso (positivo)
- Nota: Release automation con bump semver (patch/minor/major), update changelog, GitHub Release, e validate changelog links. Ottimo.

### 7.5 🟢 React Doctor e Lighthouse integrati

- File: `.github/workflows/react-doctor.yml`, `.github/workflows/lighthouse.yml`
- Rischio: 🟢 Basso (positivo)
- Nota: Workflow React Doctor per quality check React, e Lighthouse per audit performance. Buona copertura di quality assurance.

---

## 8. Codice Morto & DRY

### 8.1 🟢 Knip ha trovato 1096 orfani (principalmente artefatti di build)

- Comando: `npx knip@latest --no-gitignore`
- Rischio: 🟢 Basso
- Nota: Il numero elevato (1096) è principalmente artefatti di build in `dist/client/assets/`. Dopo aver escluso la directory `dist/`, i veri orfani sono pochi. Da verificare con `knip --ignore 'dist/**'`.

### 8.2 🟡 Duplicazione logica serializzazione automazioni

- File: `src/domain/automation.ts` (seriali/deserializza) + `src/lib/automations/action-adapter.ts` + `src/lib/automations/condition-adapter.ts`
- Rischio: 🟢 Basso
- Problema: La logica di serializzazione/deserializzazione per automazioni è implementata **due volte**:
  - In `src/domain/automation.ts`: funzioni `serializeActions`, `deserializeActions`, `serializeConditions`, `deserializeConditions`
  - In `src/lib/automations/action-adapter.ts` e `condition-adapter.ts`: funzioni `fromActionDef`, `toActionDef`, `fromConditionDef`, `toConditionDef`
  - Le due implementazioni sono equivalenti ma con interfacce diverse. Questo causa potenziale divergenza futura.
- Soluzione: Unificare le funzioni di serializzazione. `lib/automations/` dovrebbe delegare a `domain/automation.ts` invece di duplicare la logica.

### 8.3 🟡 Pattern `(queries as any).useXxx()` ripetuto

- File: `src/components/clients/ClientNotesPanel.tsx`, `ClientDocumentsPanel.tsx`, `ClientSettingsPanel.tsx`, `ClientActivityTimeline.tsx`, `src/routes/_app/inventory.lazy.tsx`, `src/routes/_app/contacts.lazy.tsx`
- Rischio: 🟡 Medio
- Problema: Il pattern `const { useXxx } = queries as any;` e `(queries as any).useYyy()` è ripetuto in almeno 7 componenti. È un workaround per aggirare la mancanza di tipi sulle query. La duplicazione rende difficile la manutenzione.
- Soluzione: Creare un tipo centralizzato per le queries esportate e sostituire gradualmente i cast.

### 8.4 🟢 styles.css non è codice morto (734 linee, ben utilizzato)

- File: `src/styles.css` (734 linee, ~12KB)
- Rischio: 🟢 Basso
- Nota: Il file CSS contiene design system v2 completo. Le classi custom (`pc-card`, `pc-btn`, `pc-badge`, `pc-stat`, `pc-input`, etc.) sono utilizzate attivamente nei componenti. Utility classes per mobile/touch sono appropriate.

---

## Riepilogo Stime Effort

| Taglia | Quantità | Esempi |
|--------|----------|--------|
| **S** | 3 fix | RLS policy mancante, aria-label su bottoni, `noImplicitAny: true` |
| **M** | 5 fix | npm audit fix, tipizzare useState dashboard, workflow CI improvement |
| **L** | 5 fix | Refactoring useDashboardData, eliminare `as any` da moduli, test E2E mancanti |
| **XL** | 2 fix | Eliminazione completa `as any` dall'intera codebase, audit accessibilità completo |

---

## Suggerimenti Chiave

1. **Fix urgente (oggi):** Aggiungere `CREATE POLICY` per `document_signatures` — rischio sicurezza alto, effort S
2. **Fix rapido (questa settimana):** Eseguire `npm audit fix`, impostare `noImplicitAny: true` in tsconfig
3. **Refactoring strutturale (prossimo mese):** Eliminare pattern `as any` dai moduli critici (dashboard widget, client components), refactoring `useDashboardData.ts`
4. **Testing infrastructure:** Aggiungere Storybook stories per componenti core, estendere E2E coverage
5. **CI/CD:** Aggiungere deploy automation (Wrangler + staging/production environments)
