# src/lib/ — Application Logic

Questa è l'unica directory per la business logic e i moduli condivisi dell'applicazione.

## Convenzioni

- **`src/lib/`** — logica condivisa dell'applicazione: utility, helper, client Supabase, auth context, query modules, schemas Zod.
- **Tutti** i moduli dell'applicazione importano da `src/lib/` usando l'alias `@/lib/...`.
- Script di tooling standalone (build, codegen, backup, migrazioni) vanno in `scripts/` alla root del progetto, **non** in `/lib/` o `src/lib/`.

## Cosa NON va in src/lib/

- Componenti React → vanno in `src/components/`
- Route definition → vanno in `src/routes/`
- Hook React generici → vanno in `src/hooks/`
- Script di tooling standalone → vanno in `scripts/`

## Struttura

```
src/lib/
  schemas/       — Zod schemas (settings, admin, clients, devices, oauth, scripts)
  queries/       — Database query modules
  admin/         — Admin utilities
  automations/   — Automation logic
  server/        — Server-only modules
  ...            — Moduli flat per dominio (auth, tickets, audit, notifications, etc.)
```
