# PCReady

[![CI](https://github.com/gastaldellomarco/pcReady/actions/workflows/ci.yml/badge.svg)](https://github.com/gastaldellomarco/pcReady/actions/workflows/ci.yml)

Applicazione web per gestire preparazione PC, ticket operativi, checklist, inventario dispositivi e utenti in ambiente aziendale.

## Stack Tecnologico

- React + TypeScript
- TanStack Router / TanStack Start con file-based routing
- Supabase per auth, database, storage logico e RLS
- Vite
- shadcn/ui + Tailwind CSS
- jsPDF + jspdf-autotable per export PDF
- Cloudflare Workers con Wrangler

## Funzionalita Principali

- Dashboard con riepilogo operativo dei ticket PC
- Lista ticket con filtri server-side, paginazione e dettaglio modale
- Kanban per avanzamento stati: `pending`, `in-progress`, `testing`, `ready`
- Checklist configurabili tramite template
- Inventario dispositivi con flusso dedicato di aggiunta dispositivo
- Export PDF formattati per Ticket e Inventario
- Script di preparazione PC generabili dai dati del ticket
- Gestione utenti e ruoli da sezione Admin
- Log attivita per azioni utente e automazioni
- Sezione Admin per Backup & Disaster Recovery con export ZIP dei dati principali

## Flussi Importanti

### Ticket PC

Il pulsante `Nuovo Ticket` apre `CreateTicketModal`, pensato per il workflow di preparazione PC. Il modal include campi come richiedente, priorita, assegnatario, OS richiesto, software e template checklist.

Il codice ticket non viene generato dal client. La migration `supabase/migrations/20260430154500_ticket_code_sequence_trigger.sql` crea/usa la sequenza PostgreSQL `ticket_seq` e assegna `ticket_code` con trigger DB prima dell'insert, evitando collisioni tra utenti concorrenti.

### Inventario

Il pulsante `Aggiungi dispositivo` apre `AddDeviceModal`, separato dal flusso ticket. Il modal raccoglie solo dati da inventario: modello, seriale, cliente, utente finale, OS e note, e salva il record nella tabella `devices`.

I ticket possono essere associati a un dispositivo esistente tramite `tickets.device_id`, mentre l'inventario legge da `devices`.

### Liste e Paginazione

Le pagine Ticket e Inventario non caricano piu tutti i record in memoria. Usano paginazione server-side con `PAGE_SIZE = 50`, `count: "exact"` e filtri applicati nella query Supabase.

La ricerca e i filtri resettano la pagina corrente alla prima pagina. I PDF esportano i record della pagina filtrata corrente, evitando generazioni enormi nel browser.

## Setup Locale

### Prerequisiti

- Bun >= 1.x
- Account Supabase
- Progetto Supabase configurato con le migration in `supabase/migrations`

### Installazione

```bash
bun install
```

### Variabili D'Ambiente

Copiare `.env.example` in `.env.local` e compilare i valori Supabase:

```bash
cp .env.example .env.local
```

Le variabili `SUPABASE_*` sono usate lato server. Le variabili `VITE_SUPABASE_*` sono esposte al client e devono contenere solo URL e publishable/anon key, mai la service role key.

### Avvio

```bash
bun run dev
```

### Build

```bash
bun run build
```

### Qualita e Test

```bash
bun run lint
bun run typecheck
bun run test
bun run migrations:check
```

La CI usa GitHub Actions su pull request verso `main` e `develop`, eseguendo lint, type-check, controllo migration Supabase e build. Il workflow `Tests` esegue la suite Vitest su push e pull request.

Configurare in GitHub Secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Database e Migration

Le migration Supabase sono in `supabase/migrations`.

Prima di usare l'app in un ambiente condiviso, applicare tutte le migration, inclusa quella per la generazione server-side del `ticket_code`.

La tabella `tickets` ha `ticket_code` unico. Il client deve omettere `ticket_code` durante la creazione dei ticket standard: il valore viene assegnato dal trigger database.

Il modello dati separa le responsabilita principali:

- `clients`: anagrafica cliente
- `client_contacts`: contatti associati al cliente
- `devices`: asset fisici e inventario
- `tickets`: workflow operativo e checklist, con FK opzionali verso cliente, dispositivo e contatto richiedente

## Backup & Recovery

PCReady usa Supabase hosted per backup automatici giornalieri, retention in base al piano e procedure di restore coordinate tramite supporto. La pagina `Admin -> Impostazioni App` mostra la policy operativa con RPO, RTO, retention, contatto di emergenza e pulsante di export manuale ZIP dei dati principali.

La procedura completa è documentata in [`docs/BACKUP.md`](docs/BACKUP.md).

## Struttura Del Progetto

```
.
├── src/                          # Codice sorgente dell'applicazione
│   ├── routes/                   # Route file-based (TanStack Router)
│   ├── components/               # Componenti React
│   │   ├── ui/                   #   shadcn/ui primitives
│   │   ├── layout/               #   Layout: AppShell, Sidebar, TopBar
│   │   ├── [domain]/             #   Componenti per dominio (admin, tickets, automations, …)
│   │   └── pcready/              #   Componenti specifici PCReady (CreateTicketModal, …)
│   ├── lib/                      # Business logic, utility, client Supabase, schemi — unica fonte
│   │   ├── schemas/              #   Zod schemas (settings, admin, clients, devices, …)
│   │   ├── queries/              #   Query e hook TanStack Query (tickets, automations, …)
│   │   ├── admin/                #   Admin utilities
│   │   ├── automations/          #   Automazione logica (adapter, validazione, template)
│   │   ├── server/               #   Server-only modules
│   │   └── README.md             #   Convenzioni della directory
│   ├── hooks/                    # React hooks custom
│   ├── domain/                   # Domain layer (tipi business, serializzazione)
│   ├── types/                    # TypeScript types e Zod schemas condivisi
│   ├── integrations/             # Integrazioni terze parti
│   │   └── supabase/             #   Client Supabase e tipi DB generati
│   ├── __tests__/                # Test unitari Vitest
│   ├── styles.css                # Stili globali (Tailwind)
│   ├── router.tsx                # Configurazione router
│   └── routeTree.gen.ts          # Albero route auto-generato (non modificare)
├── supabase/                     # Configurazione e migrazioni Supabase
│   ├── migrations/               #   Migration SQL (una per file, ordinate per data)
│   ├── seed.sql                  #   Seed dati base
│   ├── seed_demo_full.sql        #   Seed dati demo completi
│   └── config.toml               #   Config Supabase CLI
├── e2e/                          # Test end-to-end Playwright
│   ├── auth-flow.spec.ts         #   Flusso autenticazione
│   ├── kanban-drag.spec.ts       #   Drag & drop kanban
│   └── ticket-flow.spec.ts       #   Flusso ticket
├── scripts/                      # Script Node.js standalone (tooling, backup, codegen)
│   └── ci/                       #   Script CI (healthcheck)
├── docs/                         # Documentazione
│   ├── deployment.md             #   Istruzioni deployment
│   ├── BACKUP.md                 #   Procedure backup & recovery
│   ├── architecture.md           #   Architettura software
│   ├── design-system.md          #   Sistema di design
│   ├── domain-model.md           #   Modello dati
│   ├── database-reset.md         #   Reset database
│   ├── barcode-inventory.md      #   Barcode inventory
│   ├── lighthouse-budgets.md     #   Lighthouse budgets
│   └── mobile-audit.md           #   Mobile audit
├── public/                       # Asset statici (favicon, logo, …)
│   └── openapi/                  #   Specifica OpenAPI
├── backups/                      # Backup SQL locali (ignorati da git)
├── dist/                         # Build output (ignorato da git)
├── coverage/                     # Report copertura test (ignorato da git)
│
├── package.json                  # Dipendenze e script
├── tsconfig.json                 # TypeScript config — alias @/ → ./src/*, @root/ → ./*
├── vite.config.ts                # Vite config — alias @/ → src/, @root/ → root progetto
├── tailwind.config.ts            # Tailwind CSS config
├── eslint.config.js              # ESLint flat config
├── playwright.config.ts          # Playwright config
├── wrangler.jsonc                # Cloudflare Workers config
├── components.json               # shadcn/ui config
├── bunfig.toml                   # Bun config
├── .node-version / .nvmrc        # Versione Node.js
└── .env.example                  # Template variabili d'ambiente
```

### Convenzioni

| Directory         | Cosa contiene                          | Cosa NON deve contenere                    |
| ----------------- | -------------------------------------- | ------------------------------------------ |
| `src/lib/`        | Business logic, utility, schemi, query | Componenti React, route, script standalone |
| `src/components/` | Componenti React UI e di dominio       | Logica di business, route                  |
| `src/routes/`     | File route TanStack Router             | Componenti non-route, logica di business   |
| `src/hooks/`      | React hooks custom                     | Componenti, utility pure                   |
| `scripts/`        | Script Node.js standalone (tooling)    | Logica importata dall'app                  |

- Gli import interni usano sempre l'alias `@/` che punta a `src/`.
- L'alias `@root/` punta alla root del progetto (es. `@root/package.json`).
- I test seguono i file sorgente: `src/__tests__/` con mirror della struttura.
- Le migration Supabase sono ordinate per data nel nome file.

## Deployment & Maintenance

See the deployment and maintenance instructions in [`docs/deployment.md`](docs/deployment.md). It explains how to toggle maintenance mode using `VITE_MAINTENANCE_MODE` and `VITE_MAINTENANCE_END`, the required ISO 8601 format, and the difference between build-time `VITE_*` variables and runtime environment variables.

## Ruoli Utente

- `admin`: accesso completo, gestione utenti e configurazioni
- `tech`: creazione e modifica di ticket, checklist e risorse operative
- `viewer`: accesso in sola lettura

La registrazione pubblica e' disabilitata. I nuovi utenti vengono invitati dagli amministratori dalla sezione `Admin / Utenti`.

## Package Manager

Il progetto usa Bun. Il lockfile di riferimento e' `bun.lockb`; non usare `npm install` per aggiornare le dipendenze.

In ambiente Windows alcuni comandi di verifica possono essere eseguiti anche con `npm.cmd run build`, ma la gestione delle dipendenze resta affidata a Bun.

## Seeding the database

To populate a local/dev database with rich sample data (clients, contacts, devices, checklists, scripts, tickets) run the SQL seed file added in this repo:

```bash
# Using psql (adjust connection string as needed)
psql "postgresql://<db_user>:<db_password>@<db_host>:<db_port>/<db_name>" -f supabase/seed_data.sql
```

If you use the Supabase CLI, you can also apply `supabase/seed_data.sql` against your local project database. The seed is idempotent and safe to re-run; it uses `ON CONFLICT` checks and backfill updates.
