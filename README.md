# PCReady

![Versione](https://img.shields.io/badge/versione-1.4.0-blue)
![Licenza](https://img.shields.io/badge/licenza-MIT-green)

## Panoramica

PCReady è un'applicazione web per la gestione completa di un'impresa di assistenza IT: ticket operativi, inventario dispositivi, portale clienti, gestione costi e fatturazione, automazioni di workflow e knowledge base tecnica.

L'applicazione è costruita con **React + TypeScript**, utilizza **TanStack Start** per server-side rendering e routing file-based, e si appoggia a **Supabase** per autenticazione, database PostgreSQL, storage e Row-Level Security.

## Stack Tecnologico

### Frontend

- **React 19** — Libreria UI
- **TypeScript** — Tipizzazione statica
- **TanStack Start** — Framework SSR con routing file-based
- **TanStack Router** — Router type-safe con lazy loading e code splitting
- **TanStack React Query** — Gestione stato server, cache, fetching e mutazioni
- **TanStack React Virtual** — Rendering virtualizzato per liste lunghe
- **Tailwind CSS 4** — CSS utility-first
- **shadcn/ui** — Componenti UI accessibili basati su Radix
- **Radix UI** — Primitive UI headless (dialog, tooltip, select, dropdown, accordion e oltre 20 componenti)
- **Lucide React** — Icone
- **Recharts** — Grafici interattivi (barre, linee, radar)
- **ReactFlow / @xyflow** — Editor visuale di flow chart per automazioni
- **Mermaid** — Diagrammi e grafi nella sezione documentazione
- **@uiw/react-codemirror** — Editor di codice con syntax highlighting (JavaScript, Python, SQL)
- **React Day Picker** — Date picker per calendario
- **Embla Carousel** — Carousel accessibile
- **Sonner** — Toast notification
- **i18next + react-i18next** — Internazionalizzazione (italiano / inglese)
- **React Hook Form + Zod** — Gestione form con validazione schema
- **@zxing/browser** — Scanner QR/barcode
- **QRCode** — Generazione QR code per etichette dispositivo
- **date-fns** — Manipolazione e formattazione date
- **@dnd-kit** — Drag and drop (kanban, riordino widget dashboard)
- **class-variance-authority + clsx + tailwind-merge** — Utility per varianti e classi CSS

### Backend / Database

- **Supabase** — Database PostgreSQL, autenticazione, Row-Level Security, realtime, storage
- **@react-pdf/renderer** — Generazione PDF lato client (ticket, inventario, fatture, report costi, audit)
- **Nodemailer** — Invio email transazionali
- **Zod** — Validazione schema lato server per server functions

### Build & Tooling

- **Vite 7** — Bundler e dev server
- **Bun** — Package manager e runtime
- **ESLint + Prettier** — Linting e formattazione
- **Vitest** — Unit testing
- **Playwright** — Test end-to-end
- **vite-plugin-compression** — Pre-compressione Brotli + Gzip degli asset
- **rollup-plugin-visualizer** — Analisi bundle
- **vite-plugin-image-optimizer** — Ottimizzazione immagini al build
- **Storybook** — Documentazione e sviluppo componenti isolati

## Funzionalità

### Gestione Ticket

- Dashboard operativa con riepilogo ticket aperti, scaduti e SLA
- Lista ticket con **paginazione server-side**, filtri multipli e ricerca full-text
- **Kanban** drag-and-drop per avanzamento stati: `pending` → `in-progress` → `testing` → `ready` → `completed`
- **Checklist** configurabili tramite template con tag, assegnabili ai ticket
- **Time tracking** con timer avvio/stop su ogni ticket
- **Relazioni tra ticket** (collegamento, blocco, duplicazione)
- **Note e allegati** multi-file con metadata
- **Versioning** completo delle modifiche con storico e differenza visuale
- **SLA tracking** con monitoraggio tempi di risposta e risoluzione

### Portale Clienti

- Accesso tramite **link token monouso** con scadenza configurabile
- **Autenticazione a due fattori (2FA)** per i contatti portale
- Dashboard personale con stato ticket in tempo reale
- Visualizzazione e download **documenti** (allegati, report di completamento)
- **Firma digitale** dei documenti tramite portale
- Creazione nuovi ticket direttamente dal portale
- Branding personalizzabile per cliente (logo, colore primario, nome portale)
- Multi-lingua con preferenza lingua per contatto

### Gestione Costi e Finanza

- **Dashboard profittabilità** con grafico ricavi vs costi per cliente
- **Contratti SLA ricorrenti** (mensili/annuali) con ore incluse e tariffa extra
- **Fatturazione** con generazione da ticket, calcolo IVA e totali
- **Preventivi extra-contratto** con voce multipla, conversione in ticket o fattura
- **Budget cliente** con soglie di alert percentuali e barra di avanzamento
- **Report mensili** pianificabili e inviabili ai clienti
- **Export CSV contabile** e **XML FatturaPA** per ogni fattura
- Filtri per periodo, cliente e tecnico con persistenza in localStorage

### Inventario Dispositivi

- Registrazione dispositivi con modello, seriale, asset tag, OS, garanzia
- **Ciclo vita completo**: checkout/assegnazione → manutenzione → dismissione
- **Storico lifecycle** con tracciamento di tutte le modifiche
- **Software installato** per dispositivo con versioni
- **Allegati** per dispositivo (manuali, foto, documenti)
- **Codici a barre / QR** con scanner integrato e generazione etichette
- **Garanzie** con date di inizio/fine e monitoraggio scadenze
- **Manutenzioni programmate** ricorrenti con calendario

### Automazioni e Workflow

- **Regole automatiche** con trigger su eventi (creazione ticket, cambio stato, assegnazione)
- **Condizioni configurabili** su campi ticket e dispositivo
- **Azioni multiple**: notifica, email, aggiorna ticket, assegna tecnico, commento
- **Log esecuzione** con dettaglio per ogni esecuzione di regola
- **Dry run** per testare le regole senza effetti collaterali
- **Ordinamento e priorità** tra regole

### Amministrazione

- **Gestione utenti** con invito, ruoli e disattivazione
- **Permessi granulari** per ruolo (migration `role_permissions`)
- **Registrazione pubblica disabilitata** — solo invito admin
- **Impersonation** per assistenza con banner di sola lettura
- **OAuth 2.0** provider configurabili con consenso granulare
- **Backup & Recovery** con policy documentata e export ZIP manuale
- **Log attività** con retention configurabile e export CSV/PDF
- **Template email** personalizzabili con preview
- **Script condivisibili** con parametri, condivisione via link token

### Sicurezza

- **Autenticazione a due fattori (2FA)** TOTP con codici di backup
- **Rate limiting** sui tentativi di login
- **Row-Level Security (RLS)** su tutte le tabelle Supabase
- **Session token** con rotazione e revoca
- **Password policy** con validazione robustezza

### Calendario e Pianificazione

- **Viste multiple**: giorno, settimana, mese e agenda
- Eventi con data/ora, descrizione, link a risorse correlate
- **Eventi ricorrenti** con regole di ripetizione configurabili
- **Manutenzioni programmate** per dispositivi con notifiche
- **Widget annotazioni** sulla dashboard per note e promemoria

### Script e Automazione Codice

- **Editor integrato** con syntax highlighting (JavaScript, Python, SQL, Bash)
- **Parametri configurabili** per ogni script con validazione
- **Condivisione via link token** con scadenza per esecuzione esterna
- **Esecuzione e log** tracciati per ogni run
- **Gestione preferiti** e tagging per organizzazione

### Pacchetti Assistenza

- **Bundle di ore** prepagate per cliente
- Monitoraggio **consumo e scadenza** con riepilogo
- Integrazione con time tracking sui ticket

### Dashboard e Widget

- **Layout configurabile** con widget riordinabili via drag-and-drop
- Widget: statistiche ticket, SLA, tecnici, KPI, eventi critici
- **Annotazioni** sui widget con note contestuali
- **Grafici interattivi** con filtri drill-down
- **Vista team** con carico di lavoro e produttività

### Documentazione e Knowledge Base

- **Knowledge base** in formato MDX con navigazione gerarchica
- **Diagrammi Mermaid** integrati nella documentazione
- **Code block** con syntax highlighting e copia
- Struttura documentale versionata nel repository

## Flussi Principali

### Ticket

Il pulsante **Nuovo Ticket** apre un modal con campi per richiedente, priorità, assegnatario, OS richiesto, software, tipo ticket e template checklist. Il `ticket_code` viene generato lato database tramite sequence PostgreSQL e trigger, evitando collisioni tra utenti concorrenti. I ticket possono essere collegati a clienti, dispositivi e contatti esistenti.

### Portale Clienti

Amministratori e tecnici generano un **link di accesso** per un contatto dalla sezione Clienti. Il contatto riceve il link (via email o manualmente), effettua il login con 2FA opzionale, e accede a una dashboard personalizzata dove può visualizzare i propri ticket, scaricare documenti e firmare report di completamento.

### Gestione Costi

La dashboard **Gestione Costi** offre quattro tab: Dashboard (profittabilità e budget), Contratti (SLA ricorrenti), Fatturazione (generazione fatture e preventivi), Report (costi per cliente/tecnico con drill-down). I filtri per periodo, cliente e tecnico sono persistenti tra le visite. Ogni sezione supporta export CSV e PDF.

### Ciclo Vita Dispositivi

Un dispositivo viene registrato con dati anagrafici, garanzia e specifiche hardware. Durante il suo ciclo vita può essere assegnato a un utente (checkout), messo in manutenzione, e infine dismesso. Ogni transizione viene tracciata nello storico. Il pannello dispositivo mostra tab per hardware, software, storico, allegati e manutenzioni.

### Automazioni

Dalla sezione **Automazioni** si crea una regola scegliendo un evento trigger (es. creazione ticket), aggiungendo condizioni (es. priorità = alta), e configurando azioni (es. notifica admin + assegna tecnico). Le regole possono essere attivate/disattivate, testate in dry run, e il log mostra ogni esecuzione con esito e dettagli.

## Setup Locale

### Prerequisiti

- **Bun** >= 1.3.13
- **Node.js** >= 22.12.0
- Progetto **Supabase** configurato con le migration in `supabase/migrations`
- **Git**

### Installazione

```bash
# Clona il repository
git clone https://github.com/gastaldellomarco/pcReady.git
cd pcready

# Installa le dipendenze
bun install
```

### Variabili d'Ambiente

Copia `.env.example` in `.env` e compila i valori:

```bash
cp .env.example .env
```

| Variabile                   | Descrizione                                             |
| --------------------------- | ------------------------------------------------------- |
| `VITE_SUPABASE_URL`         | URL del progetto Supabase (esposto al client)           |
| `VITE_SUPABASE_ANON_KEY`    | Chiave anonima/publishable Supabase (esposto al client) |
| `SUPABASE_URL`              | URL del progetto Supabase (lato server)                 |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave service role — **mai esposta al client**         |
| `SUPABASE_ANON_KEY`         | Chiave anonima (lato server)                            |

### Avvio

```bash
# Sviluppo
bun run dev

# Build di produzione
bun run build

# Preview build
bun run preview
```

### Comandi di Qualità e Manutenzione

```bash
bun run lint              # ESLint su tutto il progetto
bun run typecheck         # Verifica tipi TypeScript
bun run test              # Test unitari con coverage
bun run test:e2e          # Test end-to-end Playwright
bun run format            # Formattazione Prettier
bun run doctor            # Analisi React (react-doctor)

# Database
bun run db:backup         # Backup database locale
bun run db:reset          # Reset database locale
bun run gen-types         # Genera tipi TypeScript da Supabase
bun run migrations:check  # Validazione file migration
```

### CI/CD

La CI usa **GitHub Actions** su push e pull request verso `main`, eseguendo lint, type-check, validazione migration Supabase e build.

Configurare in **GitHub Secrets**:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Struttura del Progetto

```
.
├── src/
│   ├── routes/                  # Route file-based (TanStack Router)
│   │   ├── _app/                #   Route autenticate (app principale)
│   │   ├── portal/              #   Route portale clienti
│   │   ├── _share/              #   Route pubbliche (script condivisi)
│   │   ├── __root.tsx           #   Root layout
│   │   └── router.getRouter.tsx #   Factory router
│   ├── components/
│   │   ├── ui/                  #   Primitive shadcn/ui
│   │   ├── layout/              #   AppShell, Sidebar, TopBar, NotificationBell
│   │   ├── admin/               #   Pannello amministrazione
│   │   ├── automations/         #   Builder automazioni e blocchi azione
│   │   ├── bundles/             #   Pacchetti assistenza
│   │   ├── calendar/            #   Viste calendario (giorno, settimana, mese, agenda)
│   │   ├── clients/             #   Gestione clienti e contatti
│   │   ├── costs/               #   Componenti dashboard costi
│   │   ├── dashboard/           #   Widget e analytics
│   │   ├── docs/                #   Knowledge base e renderer MDX
│   │   ├── errors/              #   Pagine errore (404, 500, manutenzione)
│   │   ├── inventory/           #   Inventario e scanner barcode
│   │   ├── kanban/              #   Board kanban e swimlane
│   │   ├── page-states/         #   Stati pagina (loading, errore, vuoto)
│   │   ├── pcready/             #   Componenti core (ticket, device, quote, PDF)
│   │   ├── portal/              #   Componenti portale clienti
│   │   ├── scripts/             #   Editor e gestione script
│   │   └── tickets/             #   Time tracking, allegati, relazioni ticket
│   ├── lib/
│   │   ├── schemas/             #   Schema Zod (clienti, dispositivi, ticket, etc.)
│   │   ├── queries/             #   Hook TanStack Query (50+ file)
│   │   ├── data/                #   Funzioni dati server-side
│   │   ├── automations/         #   Logica automazioni
│   │   ├── server/              #   Moduli server-only
│   │   └── ...                  #   Business logic, auth, utility
│   ├── hooks/                   #   Hook React custom
│   ├── domain/                  #   Tipi business e serializzazione
│   ├── types/                   #   Tipi TypeScript condivisi
│   ├── i18n/                    #   File di traduzione (IT/EN)
│   │   └── locales/
│   ├── integrations/
│   │   └── supabase/            #   Client e tipi generati
│   ├── content/docs/            #   Contenuti knowledge base in MDX
│   ├── __tests__/               #   Test unitari (mirror della struttura src/)
│   ├── styles.css               #   Stili globali Tailwind
│   └── router.tsx               #   Entry point router
├── supabase/
│   ├── migrations/              #   Migration SQL (ordine cronologico)
│   ├── seed.sql                 #   Seed dati base
│   └── config.toml              #   Configurazione Supabase CLI
├── e2e/                         #   Test end-to-end Playwright
├── scripts/                     #   Script Node.js (backup, seed, codegen)
├── docs/                        #   Documentazione architetturale e operativa
├── public/                      #   Asset statici (favicon, _headers, OpenAPI)
├── storybook/                   #   Configurazione Storybook
├── package.json                 #   Dipendenze e script
├── vite.config.ts               #   Configurazione Vite
├── tsconfig.json                #   Configurazione TypeScript
├── eslint.config.js             #   Configurazione ESLint flat
├── bunfig.toml                  #   Configurazione Bun
├── .env.example                 #   Template variabili d'ambiente
└── LICENSE                      #   Licenza MIT
```

### Convenzioni

| Directory         | Contiene                                        | Non contiene                         |
| ----------------- | ----------------------------------------------- | ------------------------------------ |
| `src/lib/`        | Business logic, utility, schemi Zod, hook query | Componenti React, route              |
| `src/components/` | Componenti React UI                             | Logica di business, route            |
| `src/routes/`     | File route TanStack Router                      | Componenti non-route, business logic |
| `src/hooks/`      | Hook React custom riutilizzabili                | Componenti UI                        |
| `scripts/`        | Script standalone Node.js                       | Logica importata dall'app            |

- Gli import interni usano l'alias `@/` che punta a `src/`
- Le route usano il pattern `.tsx` (stub) + `.lazy.tsx` (componente) per il code splitting
- Le migration Supabase sono ordinate per data nel nome file (ISO 8601)
- I test seguono la struttura `src/__tests__/` con mirror dei percorsi sorgente

## Database e Migration

Le migration Supabase sono in `supabase/migrations/` (oltre 50 file, in ordine cronologico). Coprono l'intero dominio applicativo:

- **Autenticazione**: MFA, backup codes, rate limiting, OAuth, registrazione
- **Autorizzazione**: RLS su tutte le tabelle, permessi granulari per ruolo
- **Ticket**: sequence per codice, SLA tracking, completamento, archiviazione, relazioni, note, allegati, time tracking, versioning
- **Dispositivi**: ciclo vita, checkout, storico, software, allegati, garanzie, manutenzioni
- **Clienti**: anagrafica, contatti, gruppi, tag, portale, SLA, budget
- **Costi**: contratti, fatture, preventivi, report, budget, viste riepilogative
- **Automazioni**: regole, flow, log esecuzione, viste
- **Notifiche**: preferenze canale, template email
- **Calendario**: eventi, estensioni
- **Dashboard**: widget, annotazioni, funzioni RPC analytics
- **Portale**: login token, 2FA, preferenze lingua, documenti, firma

Prima di usare l'applicazione in un ambiente condiviso, applicare tutte le migration eseguendo `supabase db push` o `supabase migration up`.

## Ruoli Utente

- **Admin** — accesso completo: gestione utenti, configurazioni, backup, eliminazione dati
- **Tech** — operatività: creazione e modifica ticket, checklist, dispositivi, costi
- **Viewer** — sola lettura su tutte le sezioni

I permessi sono ulteriormente raffinabili tramite la tabella `role_permissions` (migration `20260607130000`). La registrazione pubblica è disabilitata: i nuovi utenti vengono invitati dagli amministratori dalla sezione `Admin → Utenti`.

## Package Manager

Il progetto usa **Bun** come package manager e runtime. Il lockfile è `bun.lockb`. Non usare `npm install` o `yarn` per gestire le dipendenze.

## Deployment e Manutenzione

Vedi le istruzioni complete in [`docs/deployment.md`](docs/deployment.md). Include la configurazione per modalità manutenzione, variabili d'ambiente, e differenza tra variabili build-time (`VITE_*`) e runtime.

## Backup e Recovery

PCReady usa Supabase per backup automatici giornalieri. La procedura completa con policy RPO/RTO, retention e contatti di emergenza è documentata in [`docs/BACKUP.md`](docs/BACKUP.md).

## Documentazione Aggiuntiva

- [`docs/architecture.md`](docs/architecture.md) — Architettura software e decisioni tecniche
- [`docs/domain-model.md`](docs/domain-model.md) — Modello dati e relazioni
- [`docs/design-system.md`](docs/design-system.md) — Sistema di design e componenti
- [`docs/deployment.md`](docs/deployment.md) — Istruzioni di deployment
- [`docs/BACKUP.md`](docs/BACKUP.md) — Procedure di backup e recovery
- [`docs/database-reset.md`](docs/database-reset.md) — Reset del database
- [`docs/barcode-inventory.md`](docs/barcode-inventory.md) — Sistema barcode e QR
- [`docs/lighthouse-budgets.md`](docs/lighthouse-budgets.md) — Performance budget Lighthouse
- [`docs/mobile-audit.md`](docs/mobile-audit.md) — Audit mobile e accessibilità
