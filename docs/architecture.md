# Documentazione Architetturale

Scopo

- Fornire una visione ad alto livello dell'architettura del dominio applicativo.
- Facilitare onboarding e decisioni progettuali.

Contenuti principali

- Modello di dominio e schema entità-relazioni (vedi docs/domain-model.md).
- Flussi principali: creazione ticket, creazione dispositivo, associazione ticket-dispositivo.
- Gestione clienti e referenti.
- Ruoli, autorizzazioni e policy RLS più rilevanti.
- Regole di business chiave.

Architettura logica (sintesi)

- Frontend: SPA React/Vite (src/).
- Backend: API server (serverless / edge functions / worker), DB relazionale (Postgres via Supabase).
- Persistenza: tabelle per utenti, clienti, referenti, dispositivi, ticket, assegnazioni, versioning/entità.
- Autenticazione/Autorizzazione: OAuth2 / sessioni, ruoli e permessi mappati a RLS.

Dipendenze critiche

- Supabase/Postgres per DB e RLS.
- Librerie di frontend elencate in package.json.

Linee guida di documentazione

- Mantenere `docs/domain-model.md` aggiornato quando si modificano tabelle o relazioni.
- Documentare ogni regola RLS significativa con la motivazione e l'effetto.

Prossimi passi

- Completare e revisionare `docs/domain-model.md` con il diagramma ER.
- Aggiungere esempi di policy RLS e snippet SQL rilevanti.
