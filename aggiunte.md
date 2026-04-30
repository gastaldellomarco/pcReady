## Documento delle aggiunte da fare per la pagina `admin`

### 1. Aggiungere la route admin

- Creare `src/routes/_app/admin.tsx`
- Aggiungere la route al router generato (o far rigenerare routeTree.gen.ts)
- Proteggere la route con controllo `isAdmin` e redirect non-admin verso pagina sicura

### 2. Aggiungere voce di navigazione riservata agli admin

- Modificare \_app.tsx
- Inserire un nuovo elemento in `NAV_CONFIG` o `NAV_PRIMARY`:
  - `to: "/admin"`
  - `label: "Admin"` o `label: "Utenti"`
  - icona adeguata
- Renderizzare il link solo se `profile.role === "admin"` (o `isAdmin`)

### 3. Costruire l’interfaccia di gestione utenti

- In `src/routes/_app/admin.tsx` o in componenti dedicati:
  - elenco utenti
  - ricerca / filtro per nome / email / ruolo
  - tabella con colonne:
    - nome
    - email
    - ruolo
    - stato
    - azioni
  - dettagli utente
  - form di modifica ruolo
  - pulsante per rimuovere/disabilitare
- Potenziali componenti:
  - `UserTable`
  - `UserRoleEditor`
  - `UserDetailsPanel`

### 4. Backend / logica server-side per operazioni admin

- Usare client.server.ts:
  - `supabaseAdmin` per operazioni sensitive
- Creare API interne o server route:
  - aggiornare ruolo in `user_roles`
  - aggiornare profilo in `profiles`
  - disabilitare o eliminare utente
  - eventualmente inviare invito / reset password
- Evitare di fare queste operazioni direttamente dal client con la chiave di pubblicazione

### 5. Estendere i dati utente e le autorizzazioni

- Verificare che `profiles` contenga campi utili per admin:
  - `full_name`
  - `initials`
  - forse `email` (anche se esiste in auth users)
- Se serve, creare join con `auth.users` per mostrare email
- Prevedere la possibilità di:
  - cambiare ruolo
  - visualizzare log di azioni admin
  - visualizzare ultime attività

### 6. Controlli di accesso e sicurezza

- Nei componenti admin:
  - verificare `isAdmin`
  - bloccare azioni se non admin
- Nei server route/Api:
  - verificare che la richiesta provenga da un admin
  - usare `supabaseAdmin` o `service_role` con controllo lato server
- Aggiornare eventuali policy RLS se necessario:
  - permettere agli admin di leggere `user_roles` di tutti gli utenti
  - permettere agli admin di aggiornare `profiles` e `user_roles`

### 7. Aggiornamenti alla UI principale

- Sidebar:
  - aggiungere sezione “Gestione utenti” / “Admin”
- Header:
  - forse un badge o indicatore “Modalità admin”
- Pagine secondarie:
  - link in dashboard / profile per aprire admin se admin

### 8. Migliorie opzionali consigliate

- Audit / log azioni admin
- Filtro per ruoli `viewer`, `tech`, `admin`
- Creazione o invito di nuovi utenti
- Reset password o link magic
- Pagina “Impostazioni” admin per configurazioni globali

### 9. Solidità generale dell’app

- Gestione degli errori e feedback utente
  - messaggi chiari per errori di rete, autorizzazione e operazioni fallite
  - fallback UX per dati non disponibili o caricamento lento
- Validazione form lato client e server
  - `full_name`, `email`, ruoli, strutture complesse
  - evitare dati non validi su `profiles` e `user_roles`
- Controllo di versionamento/compatibilità delle migration
  - garantire che lo schema Supabase sia allineato con il codice
  - documentare le migration per onboarding
- Internationalizzazione / localizzazione
  - usare stringhe centralizzate se si prevede più lingue
  - evitare testi hardcoded nell’interfaccia
- Accessibilità (a11y)
  - keyboard navigation nella sidebar e nelle tabelle
  - etichette `aria-*` per bottoni e modali
  - contrasto e focus visibili

### 10. Qualità del codice e manutenibilità

- Tipizzazione completa TypeScript
  - evitare `any` e tipare tutte le risposte da Supabase
  - utilizzare i tipi generati da `src/integrations/supabase/types.ts`
- Componenti riutilizzabili e modulari
  - UI atomica per tabelle, form, bottoni, modal
  - separare logica di business da presentazione
- Test e automazione
  - test componenti UI critici (pagina admin, form, tabella)
  - test per casi di permessi (`admin` vs `viewer`)
  - test di integrazione per API/server route sensitive
- Controllo qualità e lint
  - ESLint/Prettier configurati e applicati
  - formattazione coerente e convenzioni di naming

### 11. Preparazione alla produzione

- Logging e monitoraggio
  - error tracking client/server (Sentry, LogRocket, ecc.)
  - metriche sulle operazioni admin e performance
- Sicurezza
  - protezione delle API server-side con service role controllato
  - non esporre mai chiavi sensibili nel bundle client
  - limitare i permessi di RLS solo a ciò che serve
- Performance
  - limitare payload delle liste utente con paginazione
  - usare query ottimizzate e caching leggero se serve
  - caricare solo dati necessari nella pagina admin
- Deployment e CI/CD
  - pipeline per build/test/deploy
  - validazione dei file di configurazione e delle migration
  - distribuzione su ambiente staging prima di prod

---

## Priorità raccomandata

1. Creare route `admin` e protezione `isAdmin`
2. Aggiungere voce di menu solo per admin
3. Realizzare tabella utenti + modifica ruolo
4. Implementare backend server-side con `supabaseAdmin`
5. Verificare/Rivedere policy Supabase per gestione utenti
6. Aggiungere UX di ricerca, dettagli, azioni
7. Aggiungere gestione errori e validazione
8. Typing e test delle funzionalità admin
9. Introdurre logging, monitoraggio e sicurezza lato server

---

## File chiave da toccare

- \_app.tsx
- `src/routes/_app/admin.tsx` (da creare)
- \_\_root.tsx
- auth-context.tsx (se serve supporto extra nel profilo)
- client.server.ts
- `supabase/migrations/*` (solo se aggiungi nuove policy o campi)
- eventuali file di test e configurazione ESLint/Prettier

> In breve: la struttura di ruoli c’è già, ma manca tutto il layer di amministrazione utente: route, UI, backend e autorizzazione specifica. Inoltre serve completare con error handling, validazione, test, sicurezza e preparazione alla produzione per avere un’app solida.
