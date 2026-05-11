# Backup & Disaster Recovery

## Obiettivo

Questa policy descrive come PCReady protegge i dati applicativi, quali sono gli obiettivi di ripristino e come richiedere un restore in caso di perdita dati o indisponibilità del provider.

## Provider di backup

PCReady utilizza Supabase come provider database gestito. I backup del database PostgreSQL sono gestiti dall'infrastruttura Supabase e includono:

- backup automatici giornalieri;
- Point-in-Time Recovery sui piani Pro e superiori;
- WAL (Write-Ahead Log) replication per recovery granulare dove previsto dal piano;
- storage dei backup su infrastruttura cloud geograficamente ridondante.

## Frequenza e retention

| Voce | Valore |
| --- | --- |
| Frequenza backup | Giornaliera, automatica |
| Retention piano Free | 7 giorni |
| Retention piano Pro | 30 giorni |
| Recovery Point Objective (RPO) | < 24 ore |
| Recovery Time Objective (RTO) | < 4 ore, subordinato ai tempi operativi di restore del provider e del supporto |

L'ultimo backup disponibile deve essere verificato dalla dashboard Supabase del progetto o tramite Supabase Management API, se abilitata per l'ambiente.

## Export manuale

Gli amministratori possono generare una copia locale dei dati principali dalla sezione:

`Admin -> Impostazioni App -> Generale -> Backup & Disaster Recovery`

Il pulsante **Esporta tutti i dati** produce un archivio ZIP contenente:

- `tickets_export_YYYY-MM-DD.csv`;
- `devices_export_YYYY-MM-DD.csv`;
- `clients_export_YYYY-MM-DD.csv`.

L'export manuale non sostituisce i backup automatici del database, ma fornisce una copia indipendente utile per verifiche, audit e conservazione offline.

## Procedura di ripristino

1. Identificare l'incidente: cancellazione accidentale, corruzione dati, indisponibilità Supabase o errore applicativo.
2. Bloccare eventuali operazioni correttive manuali non coordinate per evitare sovrascritture ulteriori.
3. Raccogliere le informazioni minime:
   - ambiente coinvolto;
   - orario stimato dell'evento;
   - tabelle o record impattati;
   - ultimo export manuale disponibile, se presente.
4. Contattare il supporto indicato in `AppSettings.support_email` dalla pagina Admin.
5. Verificare sulla dashboard Supabase il punto di ripristino disponibile più vicino all'orario richiesto.
6. Eseguire il restore su ambiente controllato quando possibile.
7. Validare consistenza di ticket, dispositivi, clienti, utenti e log applicativi.
8. Promuovere il database ripristinato o reimportare i dati validati secondo la strategia scelta.
9. Documentare l'incidente e aggiornare eventuali procedure preventive.

## Scenario: Supabase down

Se Supabase non è disponibile:

1. L'accesso, le query e le operazioni di scrittura dell'applicazione possono risultare degradate o non disponibili.
2. Monitorare lo status ufficiale Supabase e i log dell'infrastruttura applicativa.
3. Comunicare agli utenti che il servizio dipende dal ripristino del provider database.
4. Usare gli export manuali disponibili solo per consultazione offline; non sono una replica live.
5. Al ripristino del servizio, verificare integrità dei dati e completamento delle operazioni rimaste pendenti.

## Contatto di emergenza

Il contatto operativo viene configurato in `Admin -> Impostazioni App -> Email Supporto` ed è mostrato nella card **Backup & Disaster Recovery**.

In assenza di una email configurata, l'amministratore deve impostare `support_email` prima della messa in produzione.
