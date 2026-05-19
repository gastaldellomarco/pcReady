## Deployment & Maintenance

This document describes environment variables and deployment-time concerns for PCReady, including the maintenance mode used to show a maintenance page during deploy windows.

## 🛠️ Modalità Manutenzione

### Attivare la modalità manutenzione

Per attivare la modalità manutenzione impostare le variabili d'ambiente nel file `.env` (o nelle env del deployment):

```env
VITE_MAINTENANCE_MODE=true
VITE_MAINTENANCE_END=2025-12-31T23:59:00+01:00
```

`VITE_MAINTENANCE_MODE` è una flag build-time che attiva la UI client di manutenzione.

`VITE_MAINTENANCE_END` è opzionale e, se presente, viene mostrato nella pagina di manutenzione come orario di fine previsto.

Formato di `VITE_MAINTENANCE_END`

Il valore deve essere una stringa ISO 8601 con fuso orario esplicito. Esempi:

- ✅ Corretto: `2025-12-31T23:59:00+01:00`
- ✅ Corretto: `2025-12-31T22:59:00Z`
- ❌ Errato: `31/12/2025`
- ❌ Errato: `2025-12-31` (senza ora e timezone)

### Differenza tra variabili `VITE_*` e variabili runtime

| Tipo                 |          Prefisso | Disponibile                              | Dove                     |
| -------------------- | ----------------: | ---------------------------------------- | ------------------------ |
| Build-time           |           `VITE_` | Solo nel bundle client dopo `vite build` | Browser / client-side    |
| Runtime (SSR/server) | (nessun prefisso) | Solo al runtime del server/process       | Server / Workers / Cloud |

Esempi:

- `VITE_MAINTENANCE_MODE`: flag incorporata nel bundle client durante la build. Cambiarla richiede un nuovo `vite build` e la ridistribuzione del bundle.
- `MAINTENANCE_MODE`: variabile opzionale letta dal server/SSR a runtime (se implementata nel deployment), utile quando non si vuole ricostruire il client per piccole finestre di manutenzione.

⚠️ Note operative

- Le `VITE_*` vengono incorporate nel bundle al momento della build. Per farle diventare attive in produzione è necessario ricostruire e ridistribuire il bundle (o usare un meccanismo server-side che sovrascrive/sostituisce la pagina di root).
- Se volete attivare/disattivare manutenzioni senza rebuild, aggiungete un controllo runtime lato server che legge `MAINTENANCE_MODE`/`MAINTENANCE_END` e restituisce la pagina di manutenzione a chi accede al root, oppure usate un switch a livello di CDN / ingress.

### Esempio operativo

1. Per pianificare una finestra di manutenzione che compare sul sito client:
   - Aggiornate `.env` con `VITE_MAINTENANCE_MODE=true` e `VITE_MAINTENANCE_END=...`.
   - Eseguite la build: `bun run build` (o `vite build`).
   - Ridistribuite il bundle sul server/Hosting.

2. Per una manutenzione breve senza rebuild:
   - Impostate `MAINTENANCE_MODE=true` e `MAINTENANCE_END=...` nel processo server/Workers.
   - Implementate lato server la logica che serve la pagina di manutenzione quando `MAINTENANCE_MODE` è attiva.

Per altre opzioni di deployment e script Cloudflare Workers vedi `wrangler.jsonc` e la sezione _Deployment_ nel `README.md`.
