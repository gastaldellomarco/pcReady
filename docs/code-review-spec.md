# Code Review Specification — PCReady

> **Data creazione:** 8 Giugno 2026
> **Repo:** `github.com/gastaldellomarco/pcReady`
> **Branch target:** `main`
> **Lingua report:** Italiano
> **Stime effort:** S/M/L/XL (Small, Medium, Large, eXtra Large)

---

## 1. Obiettivi della Review

Analisi completa e strutturata dell'intera codebase su 8 aree chiave:

| # | Area | Priorità |
|---|------|----------|
| 1 | **TypeScript & Type Safety** | Alta |
| 2 | **Architettura & Separation of Concerns** | Alta |
| 3 | **Performance** | Media |
| 4 | **Sicurezza** | Alta |
| 5 | **Testing** | Media |
| 6 | **i18n & Accessibilità** | Media |
| 7 | **CI/CD & DevOps** | Media |
| 8 | **Codice Morto & DRY** | Bassa |

Output richiesto: file `.md` nella repo (`docs/code-review-spec.md`), con priorità ordinata per impatto (sicurezza > performance > manutenibilità).

---

## 2. Stack Rilevato

| Layer | Tecnologia | File / Path |
|-------|-----------|-------------|
| **Runtime** | Bun 1.3.13 + Node >=22.12 | `package.json` |
| **Framework** | React 19 + TypeScript 5.9 + Vite 7.3 | `tsconfig.json`, `vite.config.ts` |
| **Router** | TanStack Router (file-based, lazy-loaded) | `src/router.tsx`, `src/routes/` |
| **State/Data** | TanStack React Query 5 + server functions | `src/lib/queries/` |
| **Database** | Supabase (PostgreSQL) + Row Level Security | `src/integrations/supabase/`, `supabase/migrations/` |
| **Auth** | Supabase Auth (sessionStorage, non localStorage) | `src/integrations/supabase/client.ts` |
| **UI** | shadcn/ui (New York style) + Tailwind CSS 4 | `components.json`, `src/styles.css` |
| **i18n** | react-i18next + i18next | `src/i18n/` |
| **Domain** | Domain layer con entità, repositories, use-cases | `src/domain/` |
| **Testing** | Vitest (unit) + Playwright (E2E) + axe-core (a11y) | `src/__tests__/`, `e2e/` |
| **Storybook** | Storybook 8.6 + addon-a11y + addon-themes | `.storybook/` |
| **CI/CD** | GitHub Actions (CI, Test, Release, Lighthouse, React Doctor) | `.github/workflows/` |

---

## 3. Aree di Analisi — Dettaglio

### 3.1 TypeScript & Type Safety

**Stato attuale rilevato:**
- `tsconfig.json`: `"strict": true` MA `"noImplicitAny": false` — contraddizione che disabilita il controllo più importante
- Centinaia di `as any` casting sparsi in tutta la codebase (196+ match per `any`, 208+ match per `as any`)
- ESLint: `"@typescript-eslint/no-explicit-any": "off"` in quasi tutti i path (volutamente disabilitato, vedi commento `#58`)
- Uso frequente di `(queries as any).useXxx()` per aggirare i tipi delle query
- `(globalThis as any).__APP_SETTINGS__` per variabili globali
- Generics mal definiti: `useState<any[]>([])`, `Record<string, any>`

**Cosa produrre:**
- Report dettagliato con esempi di fix per ogni pattern problematico
- NON si richiedono fix completi, solo esempi rappresentativi
- Strategia di eliminazione graduale degli `any`

**File chiave da analizzare:**
| File | Problematica attesa |
|------|-------------------|
| `tsconfig.json` | `noImplicitAny: false` |
| `eslint.config.js` | `no-explicit-any: off` |
| `src/lib/app-settings.ts` | `(supabaseAdmin.from("app_settings" as any)` |
| `src/lib/admin-permissions.ts` | `(supabaseAdmin as any).rpc(...)` |
| `src/lib/audit-log.ts` | `supabaseAdmin.from(... as any)` |
| `src/components/dashboard/CriticalEventsWidget.tsx` | `useState<any[]>([])` |
| `src/components/dashboard/TechnicianStatsWidget.tsx` | `useState<any[]>([])` |
| `src/components/clients/Client*Panel.tsx` | `(queries as any).use*()` |
| `src/routes/_app/inventory.lazy.tsx` | `(queries as any)` |
| `src/routes/_app/contacts.lazy.tsx` | `(queries as any)` |
| `src/routes/_app/dashboard.lazy.tsx` | `(supabase as any)` |

### 3.2 Architettura & Separation of Concerns

**Stato attuale rilevato:**
- Domain layer presente (`src/domain/` con `entity.ts`, `repository.ts`, `use-cases/`) ma sembra sottoutilizzato
- Molte chiamate Supabase dirette nei componenti e route (es. `src/routes/_app/dashboard.lazy.tsx`, `src/routes/_app/costs.lazy.tsx`)
- Hook orchestratore `useDashboardData.ts` gestisce: fetching snapshot, realtime subscriptions, counts calculation, analytics, date range — chiara violazione SRP
- Chiamate dirette a Supabase in `src/lib/` fuori da `src/integrations/` (es. `app-settings.ts`, `admin-permissions.ts`, `audit-log.ts`)
- Route di TanStack Router già lazy-loaded (`*.lazy.tsx`) — buona pratica
- Provider pattern: `QueryProvider`, `AuthProvider`, `ThemeProvider` in `__root.tsx`

**Cosa produrre:**
- Identificare hook che violano SRP
- Trovare chiamate Supabase fuori da `src/integrations/` e `src/domain/`
- Valutare se il domain layer è effettivamente utilizzato o è boilerplate
- Suggerire pattern di astrazione (repository pattern, service layer)
- **Error handling:** analizzare pattern `catch (err: any) { console.error(...) }` nei componenti UI — molti componenti dashboard nascondono errori all'utente (es. `TechnicianStatsWidget.tsx`, `OverdueTicketsWidget.tsx`). Suggerire feedback UI via toast o error boundary.

**File chiave da analizzare:**
| File | Problematica attesa |
|------|-------------------|
| `src/hooks/useDashboardData.ts` | Hook orchestratore (6+ responsabilità) |
| `src/routes/_app/dashboard.lazy.tsx` | Chiamate Supabase dirette nel componente |
| `src/routes/_app/costs.lazy.tsx` | 5 chiamate Supabase inline |
| `src/routes/_app/clients.lazy.tsx` | `(supabase as any).from(...)` inline |
| `src/lib/app-settings.ts` | Logica fuori da integrations/domain |
| `src/lib/admin-permissions.ts` | Logica fuori da integrations/domain |
| `src/domain/` | Tutti i file — verificare se effettivamente importati |

### 3.3 Performance

**Stato attuale rilevato:**
- **Bundle splitting:** Vite già configurato con `manualChunks` che separa vendor, supabase, pdf, charts, dnd, flow, swagger, radix
- **Image optimization:** `ViteImageOptimizer` plugin attivo in build (png/jpeg/webp/avif/svg)
- **CSS code splitting:** `cssCodeSplit: true`
- **Lazy loading:** Route già lazy-loaded (`*.lazy.tsx`)
- **Re-render:** Dashboard widget con `useState<any[]>([])` + `useEffect` senza `useMemo`/`React.memo` — potenziali re-render a catena
- **Import:** recharts importato come default, `swagger-ui-react` intero, `reactflow` intero

**Cosa produrre:**
- Verificare componenti che mancano di `React.memo`, `useMemo`, `useCallback`
- Identificare import non tree-shakeable (recharts, swagger-ui, reactflow)
- Verificare se bundle analyzer è usabile (rollup-plugin-visualizer già configurato con `VITE_ANALYZE=true`)
- Valutare `chunkSizeWarningLimit: 500KB`

**File chiave da analizzare:**
| File | Problematica attesa |
|------|-------------------|
| `vite.config.ts` | manualChunks, chunkSizeWarningLimit |
| `src/components/dashboard/TechnicianHeatmapWidget.tsx` | `useState<any>`, useEffect con setInterval |
| `src/components/dashboard/OverdueTicketsWidget.tsx` | `useState<any[]>([])` |
| `src/components/dashboard/CriticalEventsWidget.tsx` | `useState<any[]>([])` |
| `src/components/dashboard/TechnicianRadarWidget.tsx` | recharts import |
| `src/hooks/useDashboardData.ts` | useEffect con dipendenze large |

### 3.4 Sicurezza

**Stato attuale rilevato:**
- **Env vars:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` embeddate nel bundle client (necessario per Supabase, ma da verificare se ci sono altri VITE_ sensibili)
- **Auth storage:** `sessionStorage` usato invece di `localStorage` (buona pratica, documentato nel codice)
- **RLS:** 50+ migration files in `supabase/migrations/` — serve audit per verificare policy RLS su TUTTE le tabelle
- **Input sanitization:** Zod schemas in `src/domain/automation.schema.ts` ma verificare se tutti gli input utente passano attraverso validazione
- **Dependency audit:** Da eseguire `bun audit` o equivalente per vulnerabilità note

**Cosa produrre:**
- Audit completo RLS: scansionare tutte le migration per identificare CREATE TABLE senza CREATE POLICY corrispondente
- Verificare se gli input non-Supabase (server functions) sono validati con Zod
- Controllare `VITE_` env vars per secrets che non dovrebbero essere client-side
- Eseguire dependency audit

**File chiave da analizzare:**
| Path | Problematica attesa |
|------|-------------------|
| `supabase/migrations/*.sql` | Cerca tabelle senza policy RLS |
| `.env.example` | VITE_ vars embeddate nel client |
| `src/integrations/supabase/client.ts` | sessionStorage vs localStorage |
| `src/lib/rate-limit-config.ts` | Rate limiting esistente |
| `src/lib/server-utils.ts` | Server-side validation |

### 3.5 Testing

**Stato attuale rilevato:**
- **E2E (Playwright):** 3 test files: `auth-flow.spec.ts`, `kanban-drag.spec.ts`, `ticket-flow.spec.ts`
- **Unit test (Vitest):** Test in `src/__tests__/` per: AdminUsersTab, CreateTicketModal, app-settings, hooks vari (useDashboardLayout, useWidgetAnnotations, useAdminSettingsForm, useAutomationBuilder/Logs), domain (automation.spec.ts), lib (flow-builder, template-params, server-utils, inventory-import, dashboard-analytics)
- **Coverage:** Configurato con soglie: lines 60%, functions 60%, branches 50%
- **Storybook:** Solo 1 file `.stories.tsx` trovato (`DatePickerInput.stories.tsx`)
- **A11y testing:** vitest-axe configurato in test setup

**Cosa produrre:**
- Valutare copertura E2E: flussi critici coperti vs mancanti (CRUD clienti, inventario, checklist)
- Valutare copertura unit test: quali moduli NON hanno test
- Verificare se gli snapshot test Storybook esistono o servono
- Analizzare i test hooks esistenti per qualità e manutenibilità

**File chiave da analizzare:**
| File | Problematica attesa |
|------|-------------------|
| `e2e/auth-flow.spec.ts` | Copertura login/logout/registrazione |
| `e2e/ticket-flow.spec.ts` | Copertura CRUD ticket |
| `e2e/kanban-drag.spec.ts` | Copertura drag & drop |
| `src/__tests__/` | Coverage report |
| `vite.config.ts` (test section) | Thresholds coverage |
| `src/components/ui/DatePickerInput.stories.tsx` | Unico storybook test esistente |

### 3.6 i18n & Accessibilità

**Stato attuale rilevato:**
- **i18n:** react-i18next con file di traduzione in `src/i18n/`. I componenti principali usano `useTranslation("dashboard")` con fallback string
- **Potenziali hardcoded:** Componenti dashboard, modali, e pagine potrebbero avere stringhe hardcoded in italiano
- **Accessibilità:** Storybook ha addon-a11y configurato. `axe-core` e `vitest-axe` presenti. Setup test include `toHaveNoViolations`.
- **Contrasto:** CSS variables definite per light/dark mode. Da verificare conformità WCAG 2.1 AA.
- **Aria-*:** Da verificare attributi mancanti su elementi interattivi (bottoni, link, form)

**Cosa produrre:**
- Report di stringhe hardcoded nei componenti (non approfondire fix completi)
- Audit attributi aria-* mancanti
- Verifica contrasto colore con tool automatici

**File chiave da analizzare:**
| File | Problematica attesa |
|------|-------------------|
| `src/i18n/` | File di traduzione esistenti |
| `src/components/dashboard/*.tsx` | Verifica uso corretto di useTranslation |
| `src/components/pcready/*.tsx` | Potenziali stringhe hardcoded |
| `src/styles.css` | Colori e contrasto WCAG |

### 3.7 CI/CD & DevOps

**Stato attuale rilevato:**
- **Workflow CI:** `.github/workflows/ci.yml` — esegue typecheck, lint, test, migrations:check, build. Usa Bun con caching.
- **Workflow Test:** `.github/workflows/test.yml` — Supabase CLI per db push + test. Gestisce IPv4 resolution per DB connection.
- **Workflow Release:** `.github/workflows/release.yml` — Bump semver, update changelog, GitHub Release
- **Lighthouse:** `.github/workflows/lighthouse.yml` — Audit performance
- **React Doctor:** `.github/workflows/react-doctor.yml` — Quality check
- **Mancante:**
- **Deploy su Cloudflare/Wrangler:** Il prompt originale menziona Cloudflare Workers / Wrangler, ma **nessun workflow di deploy** è presente in `.github/workflows/`. Non ci sono file `wrangler.toml` o configurazioni di deploy. Necessario verificare se il deploy è manuale o se la configurazione è in un altro repository.
- **Separazione staging/production:** Nessun workflow separato per staging vs production.

**Cosa produrre:**
- Suggerire migliorie per CI/CD (separazione staging/production, deploy automation con Wrangler)
- Verificare secrets management (env vars in GitHub Secrets)
- Valutare se mancano code quality gate (coverage threshold check, bundle size check)

**File chiave da analizzare:**
| File | Problematica attesa |
|------|-------------------|
| `.github/workflows/ci.yml` | Pipeline esistente |
| `.github/workflows/test.yml` | Supabase db push |
| `.github/workflows/release.yml` | Release automation |
| `.github/workflows/lighthouse.yml` | Performance budget |

### 3.8 Codice Morto & DRY

**Stato attuale rilevato:**
- **CSS:** `src/styles.css` è ~500 linee. Contiene classi custom (`pc-card`, `pc-btn`, `pc-badge`, etc.) e utility classes.
- **Potenziale dead code:** Classi CSS non utilizzate, componenti orfani, exports non importati
- **DRY:** Possibile duplicazione tra hook (`useDashboardData` vs `useDashboardAnalytics` + `useDashboardDateRange`), pattern `(queries as any).useXxx()` ripetuto in molti componenti

**Cosa produrre:**
- Eseguire `knip` o simile per trovare exports inutilizzati
- Identificare classi CSS inutilizzate
- Trovare pattern duplicati tra hooks e utilities

**File chiave da analizzare:**
| File | Problematica attesa |
|------|-------------------|
| `src/styles.css` | Classi custom non utilizzate |
| `src/hooks/useDashboardData.ts` | Duplicazione logica |
| `src/components/dashboard/*.tsx` | Pattern duplicati |

---

Il report includerà:
1. **Top 10 problemi più critici** ordinati per impatto
2. **Stima effort** per ciascuno (S/M/L/XL)
3. **Categorizzazione per area** con tutti i problemi trovati

---

## 5. Priorità di Refactoring (Criteri)

L'ordinamento per impatto segue questa gerarchia:

| Priorità | Criterio |
|----------|----------|
| 🔴 Alta | Violazioni di sicurezza, bug in produzione, dati a rischio |
| 🟡 Media | Performance, manutenibilità, debito tecnico significativo |
| 🟢 Bassa | Refactoring estetici, codice morto, best practice minori |

---

## 6. Stime Effort (S/M/L/XL)

| Taglia | Descrizione | Esempio |
|--------|------------|---------|
| **S** (Small) | Fix rapido, 1 file, < 30 min | Rimuovere `noImplicitAny: false` |
| **M** (Medium) | 2-5 file, 1-2 ore | Aggiungere React.memo a componenti dashboard |
| **L** (Large) | 5-15 file, 3-6 ore | Eliminare `as any` da un modulo |
| **XL** (eXtra Large) | 15+ file, > 1 giorno | Refactoring hook orchestratore, audit RLS completo |

---

## 7. Strumenti da Utilizzare

| Strumento | Scopo | Modalità |
|-----------|-------|----------|
| `knip` | Trovare exports inutilizzati | Automatico |
| `bun audit` | Vulnerability scan | Automatico |
| `axe-core` / `vitest-axe` | Audit accessibilità | Automatico + Manuale |
| Lighthouse CI | Performance budget | Workflow esistente |
| `rollup-plugin-visualizer` | Bundle analysis | Con `VITE_ANALYZE=true` |
| React Doctor | Quality check React | Workflow esistente |
| ESLint (`--report-unused-disable-directives`) | Trovare direttive eslint inutilizzate (codice morto) | Script npm esistente |

---

## 8. Vincoli e Note

- **Nessuna modifica al codice** durante la fase di review — solo report
- Il report verrà salvato in `docs/code-review-spec.md`
- Dopo il report, eventuali fix saranno discussi separatamente
- La lingua del report è italiano, con termini tecnici in inglese dove appropriato
- **Ambiente host:** Lo sviluppo è su Windows (bash), ma i workflow CI girano su Ubuntu. Questo potrebbe causare discrepanze in script shell (`scripts/bump.sh`, `scripts/update-changelog.sh`) che non sono compatibili con Windows nativo.
- **Dimensione styles.css:** Il prompt originale menziona 17KB, ma il file reale è ~500 linee (~10-12KB). La differenza è probabilmente dovuta a versioni precedenti o inclusione di commenti. La dimensione attuale è adeguata per un design system custom.
