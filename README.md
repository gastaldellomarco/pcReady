# PCReady

Applicazione web per la gestione della preparazione PC in ambiente aziendale.

## Stack Tecnologico

- React + TypeScript
- TanStack Router / TanStack Start con file-based routing
- Supabase per auth, database e RLS
- Vite + Bun
- shadcn/ui + Tailwind CSS
- Cloudflare Workers con Wrangler

## Setup Locale

### Prerequisiti

- Bun >= 1.x
- Account Supabase

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

## Struttura Del Progetto

- `src/routes`: route file-based dell'applicazione
- `src/components`: componenti UI e componenti di dominio PCReady
- `src/lib`: context, hook e logica condivisa
- `src/integrations/supabase`: client Supabase e tipi generati
- `supabase/migrations`: schema, funzioni e policy RLS
- `wrangler.jsonc`: configurazione Cloudflare Workers
- `aggiunte.md`: note interne di sviluppo

## Ruoli Utente

- `admin`: accesso completo, gestione utenti e configurazioni
- `tech`: creazione e modifica di ticket, checklist e risorse operative
- `viewer`: accesso in sola lettura

La registrazione pubblica e' disabilitata. I nuovi utenti vengono invitati dagli amministratori dalla sezione `Admin / Utenti`.

## Package Manager

Il progetto usa Bun. Il lockfile di riferimento e' `bun.lockb`; non usare `npm install` per aggiornare le dipendenze.
