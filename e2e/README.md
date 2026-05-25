# E2E Tests (Playwright)

Questi test usano `page.route()` per mockare le API di Supabase e le server functions di TanStack Start. **Non richiedono Supabase locale** — basta `bun run dev`.

## Prerequisiti

1. **Playwright** installato: `bun x playwright --version`
2. **Chromium** installato: `bun x playwright install chromium`

## Esecuzione

```bash
# Il dev server viene avviato automaticamente da Playwright
bun run test:e2e

# Esegue un singolo file
bun x playwright test e2e/auth-flow.spec.ts

# Modalità UI (debug)
bun x playwright test --ui

# Modalità headed (vedi il browser)
bun x playwright test --headed
```

## Architettura Mock

I test E2E intercettano le chiamate di rete tramite `page.route()`:

- **Supabase Auth** (`/auth/v1/*`) → session mock, user admin
- **Supabase REST** (`/rest/v1/*`) → array vuoti by default, con override per test specifici
- **TanStack Start RPC** (`/_server`) → risposte generiche per server functions comuni
- **Supabase Realtime** (WebSocket) → connessione silenziata

Le variabili d'ambiente `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` sono impostate a valori fittizi nel `playwright.config.ts` per permettere l'inizializzazione del client Supabase senza errori.

## Note

- I test E2E **non** girano in CI. Sono pensati solo per esecuzione locale.
- Le mock sono definite in `e2e/mocks.ts` e possono essere estese con override per test specifici.
- Il dev server viene avviato su `http://localhost:8080` (configurato in `vite.config.ts`).
