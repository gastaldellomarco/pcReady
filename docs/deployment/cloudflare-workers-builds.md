# Cloudflare Workers Builds — diagnostica e configurazione

Questo progetto usa Cloudflare Workers Builds come pipeline distinta da GitHub Actions. I fix dei workflow GitHub Actions non garantiscono automaticamente il successo dei deploy automatici Cloudflare: Workers Builds ha build image, package manager, variabili e comandi configurati nel dashboard Cloudflare.

## Configurazione repository attesa

- Runtime Node: `22` (`.nvmrc`, `.node-version`, `package.json#engines`)
- Package manager primario: `bun@1.3.13` (`package.json#packageManager`)
- Build command consigliato: `bun run cloudflare:build`
- Deploy dry-run locale: `bun run cloudflare:deploy:dry-run`
- Config Wrangler: `wrangler.jsonc`
- Worker name: `pcready`

## Configurazione Cloudflare consigliata

Nel dashboard Cloudflare, per il progetto `pcready`, verificare Production e Preview separatamente:

1. **Build command**
   - preferito: `bun run cloudflare:build`
   - alternativa se Bun non è disponibile nell'image: installare Bun 1.3.13 esplicitamente prima della build, poi eseguire `bun install --frozen-lockfile && bun run cloudflare:build`

2. **Package manager**
   - deve essere Bun 1.3.x, allineato al `bun.lockb`
   - il repository mantiene un solo lockfile (`bun.lockb`) per evitare fallback impliciti a npm/pnpm

3. **Node version**
   - usare Node 22 o comunque `>=22.12.0`
   - Vite 7 richiede Node recente; versioni Node 20 troppo vecchie possono fallire durante la build

4. **Output / asset directory**
   - non configurare manualmente una directory Pages statica se si sta usando Workers + Wrangler/TanStack Start
   - lasciare che `@cloudflare/vite-plugin` e Wrangler generino la configurazione finale

5. **Variabili ambiente build/runtime**
   Verificare almeno:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - eventuali SMTP/runtime secret se richiesti dall'ambiente target

   Nota: le variabili `VITE_*` sono lette a build-time dal bundle client. Le variabili senza prefisso `VITE_` sono usate dal runtime server/Worker.

## Checklist diagnostica quando una build Cloudflare fallisce

1. Aprire Cloudflare Dashboard → Workers & Pages → `pcready` → Build History.
2. Copiare il log completo del build fallito nell'issue.
3. Identificare lo step esatto che fallisce:
   - install
   - build
   - bundle
   - publish/deploy
4. Verificare nel log quale package manager viene usato davvero.
5. Verificare nel log la versione Node e, se presente, la versione Bun.
6. Verificare che il command sia `bun run cloudflare:build` o equivalente.
7. Verificare che Production e Preview abbiano entrambe le env vars richieste.
8. Riprodurre localmente con:
   - `bun install --frozen-lockfile`
   - `bun run cloudflare:build`
   - `bun run cloudflare:deploy:dry-run`

## Root cause candidates già mitigati nel repository

- Allineamento package manager: `packageManager` punta a `bun@1.3.13` e il lockfile npm è stato rimosso per evitare autodetection ambigua.
- Runtime Node esplicito: `.nvmrc`, `.node-version` e `engines.node` richiedono Node 22 / `>=22.12.0`.
- Nome Worker allineato al progetto: `wrangler.jsonc#name` è `pcready`.
- Script Cloudflare dedicati: `cloudflare:build` e `cloudflare:deploy:dry-run` separano la pipeline Cloudflare dai workflow GitHub Actions.

## Pattern da mantenere

- Non usare workaround manuali nel dashboard senza riportarli in questo documento.
- Non confondere errori GitHub Actions con errori Workers Builds: allegare sempre il log della Build History Cloudflare.
- Se si cambia package manager, aggiornare lockfile, `packageManager`, documentazione e build command insieme.
- Se si aggiungono variabili `VITE_*`, ricordare che vanno configurate anche in Cloudflare per Preview e Production.
