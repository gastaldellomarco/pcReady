# Cloudflare Workers Builds — diagnostica e configurazione

Questo progetto usa Cloudflare Workers Builds come pipeline distinta da GitHub Actions. I fix dei workflow GitHub Actions non garantiscono automaticamente il successo dei deploy automatici Cloudflare: Workers Builds ha build image, package manager, variabili e comandi configurati nel dashboard Cloudflare.

## Configurazione repository attesa

- Runtime Node: `22` (`.nvmrc`, `.node-version`, `package.json#engines`)
- Package manager primario: `bun@1.3.13` (`package.json#packageManager`)
- Build command consigliato: `bun run cloudflare:build`
- Deploy command consigliato: `bun run cloudflare:deploy`
- Deploy dry-run locale: `bun run cloudflare:deploy:dry-run`
- Config Wrangler: `wrangler.jsonc`
- Worker name: `pcready`

## Configurazione Cloudflare consigliata

Nel dashboard Cloudflare, per il progetto `pcready`, verificare Production e Preview separatamente:

1. **Build command**
   - preferito: `bun run cloudflare:build`
   - `bun run build` è equivalente oggi, ma lo script dedicato rende esplicita la pipeline Cloudflare
   - alternativa se Bun non è disponibile nell'image: installare Bun 1.3.13 esplicitamente prima della build, poi eseguire `bun install --frozen-lockfile && bun run cloudflare:build`

2. **Deploy command**
   - preferito: `bun run cloudflare:deploy`
   - evitare `npx wrangler deploy`: usa npm/npx nella fase deploy, può scaricare versioni non bloccate e introduce una seconda toolchain rispetto a Bun
   - `wrangler` è pinato in `devDependencies`, quindi il deploy usa la versione lockata dal repository

3. **Package manager**
   - deve essere Bun 1.3.x, allineato al `bun.lockb`
   - il repository mantiene un solo lockfile (`bun.lockb`) per evitare fallback impliciti a npm/pnpm

4. **Node version**
   - usare Node 22 o comunque `>=22.12.0`
   - Vite 7 richiede Node recente; versioni Node 20 troppo vecchie possono fallire durante la build

5. **Output / asset directory**
   - non configurare manualmente una directory Pages statica se si sta usando Workers + Wrangler/TanStack Start
   - lasciare che `@cloudflare/vite-plugin` e Wrangler generino la configurazione finale

6. **Variabili ambiente build/runtime**
   Attualmente il dashboard Cloudflare non deve restare con `Environment variables: None`: il progetto legge Supabase già durante build/client bundle e runtime server.

   Verificare almeno:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - eventuali secret per provider email HTTP se richiesti dall'ambiente target

   Nota: le variabili `VITE_*` sono lette a build-time dal bundle client. Le variabili senza prefisso `VITE_` sono usate dal runtime server/Worker.

   Nota email: Cloudflare Workers non supporta SMTP diretto via socket TCP come `nodemailer`. Non impostare `SMTP_*` aspettandosi invio SMTP dal Worker; usare un provider email HTTP/API per la produzione.

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
6. Verificare che il build command sia `bun run cloudflare:build` o equivalente.
7. Verificare che il deploy command sia `bun run cloudflare:deploy`.
8. Verificare che Production e Preview abbiano entrambe le env vars richieste.
9. Riprodurre localmente con:
   - `bun install --frozen-lockfile`
   - `bun run cloudflare:build`
   - `bun run cloudflare:deploy:dry-run`

## Root cause candidates già mitigati nel repository

- Allineamento package manager: `packageManager` punta a `bun@1.3.13` e il lockfile npm è stato rimosso per evitare autodetection ambigua.
- Runtime Node esplicito: `.nvmrc`, `.node-version` e `engines.node` richiedono Node 22 / `>=22.12.0`.
- Nome Worker allineato al progetto: `wrangler.jsonc#name` è `pcready`.
- Script Cloudflare dedicati: `cloudflare:build`, `cloudflare:deploy` e `cloudflare:deploy:dry-run` separano la pipeline Cloudflare dai workflow GitHub Actions.
- Wrangler è pinato in `devDependencies` per evitare deploy con versioni scaricate dinamicamente da `npx`.
- Il codice server non usa più `new Function`/code generation dinamica, vietata nel runtime Cloudflare Workers.

## Pattern da mantenere

- Non usare workaround manuali nel dashboard senza riportarli in questo documento.
- Non confondere errori GitHub Actions con errori Workers Builds: allegare sempre il log della Build History Cloudflare.
- Se si cambia package manager, aggiornare lockfile, `packageManager`, documentazione e build command insieme.
- Se si aggiungono variabili `VITE_*`, ricordare che vanno configurate anche in Cloudflare per Preview e Production.
