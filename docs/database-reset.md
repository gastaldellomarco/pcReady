# Reset database Supabase

Questa procedura consente di ripartire da zero con i dati presenti nel database, mantenendo schema e migration come sorgente di verità.

## Precauzioni

- Eseguire sempre un backup prima del reset.
- Verificare di essere collegati al progetto Supabase corretto prima di usare il target `linked`.
- I backup generati dagli script finiscono in `backups/`, directory ignorata da Git.
- Il reset remoto è distruttivo: lo script lo blocca se non viene passato `--confirm=RESET-LINKED`.

## Tabelle pubbliche coinvolte

Le migration definiscono queste tabelle applicative in `public`:

- `activity_log`
- `app_settings`
- `archived_logs`
- `assistance_bundles`
- `audit_presets`
- `automation_flows`
- `automation_rules`
- `automation_run_logs`
- `bundle_fee_payments`
- `bundle_usage_entries`
- `calendar_events`
- `checklist_templates`
- `client_bundle_assignments`
- `client_contacts`
- `client_contracts`
- `clients`
- `devices`
- `email_templates`
- `entity_versions`
- `maintenance_history`
- `maintenance_schedules`
- `notifications`
- `oauth_authorization_codes`
- `oauth_clients`
- `oauth_consents`
- `portal_sessions`
- `profiles`
- `scripts`
- `ticket_attachments`
- `ticket_checklist_instances`
- `ticket_checklist_responses`
- `ticket_device_assignment_history`
- `ticket_device_assignments`
- `ticket_feedback`
- `ticket_notes`
- `ticket_relations`
- `ticket_status_history`
- `ticket_time_entries`
- `tickets`
- `user_mfa_backup_codes`
- `user_profiles`
- `user_roles`

Sono inoltre presenti dati gestiti da Supabase in altri schema, ad esempio `auth` e `storage`. Il reset Supabase CLI ricrea lo stato partendo dalle migration e dai seed configurati. Il seeder completo crea tre utenti demo minimi in `auth.users` solo per soddisfare le FK di profili, ruoli e assegnazioni.

## Seed iniziali

Il file `supabase/config.toml` abilita l'esecuzione automatica di:

1. `supabase/seed.sql`
2. `supabase/seed_demo_full.sql`

`seed.sql` mantiene i template email base. `seed_demo_full.sql` inserisce un dataset dimostrativo coerente e idempotente per ambiente sviluppo/QA: utenti demo, profili, clienti, contatti, dispositivi, contratti, pacchetti assistenza, ticket, checklist, note, allegati logici, calendari e manutenzioni. Alcuni dati di configurazione iniziale, ad esempio `app_settings`, `automation_rules`, template email aggiuntivi e pacchetti assistenza standard, sono dichiarati direttamente nelle migration e vengono ricreati quando il database viene resettato tramite migration.

Il vecchio `supabase/seed_data.sql` resta disponibile come dataset legacy, ma non è più eseguito automaticamente dal reset perché generava dati parziali/random e molte colonne opzionali non valorizzate.

## Procedura locale

1. Verifica migration:
   - `bun run migrations:check`
2. Esegui backup locale:
   - `bun run db:backup`
3. Resetta il DB locale, applicando migration e seed:
   - `bun run db:reset`
4. Testa l'applicazione:
   - `bun run typecheck`
   - `bun run test`
   - `bun run build`

## Procedura progetto Supabase collegato

1. Verifica il progetto collegato:
   - `supabase projects list`
   - `supabase status`
2. Verifica migration:
   - `bun run migrations:check`
3. Esegui backup remoto:
   - `bun run db:backup:linked`
4. Esegui reset remoto solo dopo conferma esplicita:
   - `node scripts/supabase-reset.mjs --target=linked --confirm=RESET-LINKED`
5. Testa l'applicazione:
   - `bun run typecheck`
   - `bun run test`
   - `bun run build`

## Tabelle generate a runtime o sensibili

Queste tabelle non vengono riempite artificialmente, salvo il client OAuth tecnico `pcready-demo-client`:

- `oauth_authorization_codes`: generata durante il flow OAuth.
- `oauth_consents`: generata quando un utente autorizza un client OAuth.
- `portal_sessions`: generata dagli accessi del portale clienti.
- `user_mfa_backup_codes`: generata dalla configurazione MFA degli utenti.
- `activity_log`: generata da azioni applicative e audit runtime.
- `archived_logs`: generata da job di retention/archive log.
- `automation_run_logs`: generata dall'esecuzione reale dei flow di automazione.
- `notifications`: generata da ticket, checklist, manutenzioni e automazioni.
- `entity_versions`: generata dal versioning applicativo quando vengono mutate entità tracciate.

## Ripristino da backup

I backup data-only sono file SQL. Per ripristinare un backup, usare Supabase CLI o `psql` con la connection string corretta del database. Prima del ripristino, verificare che lo schema sia compatibile con il file di dump.

## Note sulle FK

Il reset consigliato è `supabase db reset`, quindi non richiede un ordine manuale di cancellazione: il database viene ricreato e le migration vengono rieseguite in ordine. In caso di cancellazione manuale, usare `TRUNCATE ... RESTART IDENTITY CASCADE` su tutte le tabelle applicative per rispettare le dipendenze tra foreign key.
