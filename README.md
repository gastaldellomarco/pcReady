# PCReady

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

## Database e Migration

Le migration Supabase sono in `supabase/migrations`.

Prima di usare l'app in un ambiente condiviso, applicare tutte le migration, inclusa quella per la generazione server-side del `ticket_code`.

La tabella `tickets` ha `ticket_code` unico. Il client deve omettere `ticket_code` durante la creazione dei ticket standard: il valore viene assegnato dal trigger database.

Il modello dati separa le responsabilita principali:

- `clients`: anagrafica cliente
- `client_contacts`: contatti associati al cliente
- `devices`: asset fisici e inventario
- `tickets`: workflow operativo e checklist, con FK opzionali verso cliente, dispositivo e contatto richiedente

## Struttura Del Progetto

- `src/routes`: route file-based dell'applicazione
- `src/components`: componenti UI e componenti di dominio PCReady
- `src/components/pcready`: modal, badge e componenti specifici PCReady
- `src/lib`: context, hook e logica condivisa
- `src/integrations/supabase`: client Supabase e tipi generati
- `supabase/migrations`: schema, funzioni, trigger e policy RLS
- `wrangler.jsonc`: configurazione Cloudflare Workers

## Ruoli Utente

- `admin`: accesso completo, gestione utenti e configurazioni
- `tech`: creazione e modifica di ticket, checklist e risorse operative
- `viewer`: accesso in sola lettura

La registrazione pubblica e' disabilitata. I nuovi utenti vengono invitati dagli amministratori dalla sezione `Admin / Utenti`.

## Package Manager

Il progetto usa Bun. Il lockfile di riferimento e' `bun.lockb`; non usare `npm install` per aggiornare le dipendenze.

In ambiente Windows alcuni comandi di verifica possono essere eseguiti anche con `npm.cmd run build`, ma la gestione delle dipendenze resta affidata a Bun.
