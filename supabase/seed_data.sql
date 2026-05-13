-- Seed data for PCReady: clients, contacts, devices, checklists, scripts, tickets
-- Idempotent where possible (ON CONFLICT DO NOTHING)

-- 1) Clients
INSERT INTO public.clients (name, vat_number, address, email, phone, notes)
VALUES
  ('Tecnolab Srl', 'IT12345678901', 'Via Roma 12, 20100 Milano MI', 'info@tecnolab.it', '+39 02 1234567', 'Servizi IT e manutenzione hardware'),
  ('Meridian Group SpA', 'IT23456789012', 'Viale Europa 3, 00100 Roma RM', 'segreteria@meridian.it', '+39 06 7654321', 'Grande realtà con sedi regionali'),
  ('Studio Legale Ferretti', 'IT34567890123', 'Corso Vittorio 45, 10100 Torino TO', 'info@studioferretti.it', '+39 011 2345678', 'Studio legale con 25 avvocati'),
  ('Albergo Aurora SRL', 'IT45678901234', 'Via Lungomare 7, 90100 Palermo PA', 'reception@aurora-hotel.it', '+39 091 3456789', 'Catena alberghiera locale'),
  ('SviluppoWeb SRL', 'IT56789012345', 'Piazza Dante 2, 40100 Bologna BO', 'hello@sviluppoweb.it', '+39 051 9876543', 'Agenzia web e digital marketing'),
  ('Clinica San Luca Srl', 'IT67890123456', 'Via San Luca 18, 50100 Firenze FI', 'info@clinicasanluca.it', '+39 055 1122334', 'Clinica privata, gestione IT sanitaria'),
  ('Impresa Edile Rossi', 'IT78901234567', 'Via Cantù 9, 50121 Firenze FI', 'ufficio@edilerossi.it', '+39 055 6677889', 'Piccola impresa edile'),
  ('AutoService Ferri', 'IT89012345678', 'Via Industriale 4, 41100 Modena MO', 'info@autoserviceferri.it', '+39 059 223344', 'Officina e gestione flotte'),
  ('Istituto Comprensivo Verdi', 'IT90123456789', 'Via Scuola 1, 24100 Bergamo BG', 'segreteria@icverdi.edu.it', '+39 035 556677', 'Scuola primaria e secondaria'),
  ('Studio Commerciale Bianchi', 'IT01234567890', 'Via Mercato 11, 33100 Udine UD', 'info@studiobianchi.it', '+39 0432 998877', 'Consulenza fiscale e amministrativa')
ON CONFLICT DO NOTHING;

-- 2) Referenti (client_contacts) — 2-3 per client
-- Each contact inserted by resolving client id by name
INSERT INTO public.client_contacts (client_id, first_name, last_name, email, phone, role)
VALUES
  ((SELECT id FROM public.clients WHERE name='Tecnolab Srl'), 'Luca', 'Rossi', 'luca.rossi@tecnolab.it', '+39 345 1112222', 'Responsabile IT'),
  ((SELECT id FROM public.clients WHERE name='Tecnolab Srl'), 'Maria', 'Conti', 'maria.conti@tecnolab.it', '+39 347 3334444', 'Amministrativo'),
  ((SELECT id FROM public.clients WHERE name='Meridian Group SpA'), 'Giovanni', 'Moretti', 'giovanni.moretti@meridian.it', '+39 333 5556666', 'Titolare'),
  ((SELECT id FROM public.clients WHERE name='Meridian Group SpA'), 'Elena', 'Fabbri', 'elena.fabbri@meridian.it', '+39 338 7778888', 'Responsabile IT'),
  ((SELECT id FROM public.clients WHERE name='Studio Legale Ferretti'), 'Marco', 'Ferretti', 'marco.ferretti@studioferretti.it', '+39 349 1010101', 'Titolare'),
  ((SELECT id FROM public.clients WHERE name='Studio Legale Ferretti'), 'Anna', 'Galli', 'anna.galli@studioferretti.it', '+39 349 2020202', 'Amministrativo'),
  ((SELECT id FROM public.clients WHERE name='Albergo Aurora SRL'), 'Paolo', 'Bianchi', 'paolo.bianchi@aurora-hotel.it', '+39 338 3030303', 'Direttore'),
  ((SELECT id FROM public.clients WHERE name='Albergo Aurora SRL'), 'Giulia', 'Rinaldi', 'giulia.rinaldi@aurora-hotel.it', '+39 338 4040404', 'Reception'),
  ((SELECT id FROM public.clients WHERE name='SviluppoWeb SRL'), 'Federico', 'Neri', 'federico.neri@sviluppoweb.it', '+39 327 5050505', 'CTO'),
  ((SELECT id FROM public.clients WHERE name='SviluppoWeb SRL'), 'Sara', 'Esposito', 'sara.esposito@sviluppoweb.it', '+39 327 6060606', 'Project Manager'),
  ((SELECT id FROM public.clients WHERE name='Clinica San Luca Srl'), 'Alessandro', 'Romano', 'alessandro.romano@clinicasanluca.it', '+39 345 2121212', 'Responsabile IT'),
  ((SELECT id FROM public.clients WHERE name='Clinica San Luca Srl'), 'Lucia', 'Greco', 'lucia.greco@clinicasanluca.it', '+39 345 3131313', 'Amministrativo'),
  ((SELECT id FROM public.clients WHERE name='Impresa Edile Rossi'), 'Davide', 'Rossi', 'davide.rossi@edilerossi.it', '+39 349 4141414', 'Titolare'),
  ((SELECT id FROM public.clients WHERE name='Impresa Edile Rossi'), 'Chiara', 'Bergamo', 'chiara.bergamo@edilerossi.it', '+39 349 5151515', 'Responsabile Acquisti'),
  ((SELECT id FROM public.clients WHERE name='AutoService Ferri'), 'Francesco', 'Ferri', 'francesco.ferri@autoserviceferri.it', '+39 338 6161616', 'Responsabile Officina'),
  ((SELECT id FROM public.clients WHERE name='AutoService Ferri'), 'Elisa', 'Marini', 'elisa.marini@autoserviceferri.it', '+39 338 7171717', 'Amministrazione'),
  ((SELECT id FROM public.clients WHERE name='Istituto Comprensivo Verdi'), 'Paolo', 'Verdi', 'paolo.verdi@icverdi.edu.it', '+39 345 8181818', 'Dirigente Scolastico'),
  ((SELECT id FROM public.clients WHERE name='Istituto Comprensivo Verdi'), 'Laura', 'Bassi', 'laura.bassi@icverdi.edu.it', '+39 345 9191919', 'Responsabile ICT'),
  ((SELECT id FROM public.clients WHERE name='Studio Commerciale Bianchi'), 'Giuseppe', 'Bianchi', 'giuseppe.bianchi@studiobianchi.it', '+39 333 1212121', 'Commercialista'),
  ((SELECT id FROM public.clients WHERE name='Studio Commerciale Bianchi'), 'Rita', 'Costa', 'rita.costa@studiobianchi.it', '+39 333 2222222', 'Assistente')
ON CONFLICT DO NOTHING;

-- 3) Dispositivi (40 devices) — assigned_to holds client's referent name when assigned
-- We'll create a set of realistic models and OSes and distribute devices across clients
DO $$
DECLARE
  models TEXT[] := ARRAY['Dell Latitude 7430','Lenovo ThinkPad X1 Carbon','HP EliteBook 840','Apple MacBook Pro 13','ASUS Vivobook 15','Microsoft Surface Pro 8'];
  oses TEXT[] := ARRAY['Windows 11 Pro','Windows 10 Pro','macOS 13 Ventura','Ubuntu 22.04 LTS'];
  clients_record RECORD;
  i INT := 0;
  serial_suffix TEXT;
  statuses TEXT[] := ARRAY['available','assigned','maintenance','retired'];
BEGIN
  FOR clients_record IN SELECT id, name FROM public.clients LOOP
    -- create between 2 and 8 devices per client until we reach ~40 total
    FOR j IN 1..4 LOOP
      i := i + 1;
      serial_suffix := lpad((10000 + (i * 7))::text,5,'0');
      INSERT INTO public.devices (client_id, serial, model, os, assigned_to, status, notes, created_at)
      VALUES (
        clients_record.id,
        upper(substring(clients_record.name from 1 for 4)) || '-' || serial_suffix,
        models[1 + floor(random() * array_length(models,1))::int],
        oses[1 + floor(random() * array_length(oses,1))::int],
        CASE WHEN random() < 0.33 THEN (SELECT first_name || ' ' || last_name FROM public.client_contacts WHERE client_id = clients_record.id ORDER BY random() LIMIT 1) ELSE NULL END,
        CASE WHEN random() < 0.6 THEN 'available'::public.device_status WHEN random() < 0.85 THEN 'assigned'::public.device_status WHEN random() < 0.95 THEN 'maintenance'::public.device_status ELSE 'retired'::public.device_status END,
        CASE WHEN random() < 0.2 THEN 'Batteria da sostituire' WHEN random() < 0.15 THEN 'SSD aggiornato a 1TB' ELSE NULL END,
        now() - (floor(random()*100)::int || ' days')::interval
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
  -- If less than 40 created above, create until 40
  WHILE (SELECT count(*) FROM public.devices) < 40 LOOP
    i := i + 1;
    INSERT INTO public.devices (client_id, serial, model, os, assigned_to, status, notes, created_at)
    VALUES (
      (SELECT id FROM public.clients ORDER BY random() LIMIT 1),
      'EXTRA-' || lpad((10000 + i)::text,5,'0'),
      models[1 + floor(random() * array_length(models,1))::int],
      oses[1 + floor(random() * array_length(oses,1))::int],
      (SELECT first_name || ' ' || last_name FROM public.client_contacts ORDER BY random() LIMIT 1),
      CASE WHEN random() < 0.6 THEN 'available'::public.device_status WHEN random() < 0.85 THEN 'assigned'::public.device_status WHEN random() < 0.95 THEN 'maintenance'::public.device_status ELSE 'retired'::public.device_status END,
      NULL,
      now() - (floor(random()*100)::int || ' days')::interval
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END$$;

-- 4) Checklist templates (8)
INSERT INTO public.checklist_templates (name, description, structure, is_default)
VALUES
  ('Preparazione PC nuovo', 'Installazione e configurazione completa per macchine aziendali',
    '{"setup": {"label": "Preparazione","items":[{"id":"1","text":"Installazione OS"},{"id":"2","text":"Attivazione licenza"},{"id":"3","text":"Configurazione utente"},{"id":"4","text":"Installazione software base"},{"id":"5","text":"Join dominio"},{"id":"6","text":"Test rete"},{"id":"7","text":"Consegna"}]}}'::jsonb, true),
  ('Setup macOS BYOD', 'Template per dispositivi macOS BYOD',
    '{"mac": {"label": "macOS","items":[{"id":"1","text":"Aggiornamento macOS"},{"id":"2","text":"Configurazione VPN"},{"id":"3","text":"Installazione Outlook"},{"id":"4","text":"Configurazione MDM"}]}}'::jsonb, false),
  ('Manutenzione ordinaria', 'Checklist manutenzione periodica',
    '{"man": {"label":"Manutenzione","items":[{"id":"1","text":"Pulizia fisica"},{"id":"2","text":"Aggiornamenti OS"},{"id":"3","text":"Scansione antivirus"},{"id":"4","text":"Verifica backup"},{"id":"5","text":"Test batteria"}]}}'::jsonb, false),
  ('Sostituzione SSD', 'Procedure per sostituzione e ripristino dati',
    '{"ssd": {"label":"SSD","items":[{"id":"1","text":"Backup dati"},{"id":"2","text":"Clonazione disco"},{"id":"3","text":"Sostituzione hardware"},{"id":"4","text":"Ripristino dati"},{"id":"5","text":"Verifica avvio"}]}}'::jsonb, false),
  ('Configurazione email', 'Impostazioni account e client',
    '{"mail": {"label":"Email","items":[{"id":"1","text":"Creazione account"},{"id":"2","text":"Configurazione client"},{"id":"3","text":"Test invio/ricezione"},{"id":"4","text":"Configurazione firma"}]}}'::jsonb, false),
  ('Dismissione dispositivo', 'Procedure di dismissione sicura',
    '{"retire": {"label":"Dismissione","items":[{"id":"1","text":"Backup finale"},{"id":"2","text":"Formattazione sicura"},{"id":"3","text":"Rimozione da AD/MDM"},{"id":"4","text":"Aggiornamento inventario"},{"id":"5","text":"Smaltimento"}]}}'::jsonb, false),
  ('Onboarding nuovo utente', 'Passaggi per creare e consegnare device a nuovo utente',
    '{"onb": {"label":"Onboarding","items":[{"id":"1","text":"Creazione account AD"},{"id":"2","text":"Configurazione PC"},{"id":"3","text":"Assegnazione licenze"},{"id":"4","text":"Accessi applicativi"},{"id":"5","text":"Formazione base"}]}}'::jsonb, false),
  ('Recupero dati', 'Template per tentativi di recupero dati',
    '{"rec": {"label":"Recupero","items":[{"id":"1","text":"Diagnosi disco"},{"id":"2","text":"Tentativo recupero software"},{"id":"3","text":"Recupero hardware"},{"id":"4","text":"Verifica dati"},{"id":"5","text":"Report cliente"}]}}'::jsonb, false)
ON CONFLICT DO NOTHING;

-- 5) Scripts / Automations (6 examples)
INSERT INTO public.scripts (name, category, description, language, content)
VALUES
  ('Windows Update silenzioso', 'Manutenzione', 'Forza aggiornamenti Windows in background', 'powershell', 'Get-WindowsUpdate -AcceptAll -Install -AutoReboot'),
  ('Inventario hardware automatico', 'Inventario', 'Raccoglie CPU/RAM/Storage e invia a PCReady', 'powershell', 'Write-Output "Collecting hardware info..."'),
  ('Pulizia file temporanei', 'Manutenzione', 'Elimina temp e cache', 'powershell', 'Remove-Item -Path $env:TEMP\\* -Recurse -Force'),
  ('Notifica ticket scaduti', 'Automazione', 'Invia alert per ticket in attesa >48h', 'automation', 'send_alerts_if_overdue()'),
  ('Backup configurazione rete', 'Backup', 'Esporta config dispositivi di rete in PDF', 'python', 'print("exporting configs")'),
  ('Report settimanale automatico', 'Report', 'Genera e invia report PDF ogni lunedì', 'automation', 'generate_weekly_report()')
ON CONFLICT DO NOTHING;

-- 6) Tickets (60) — generated with random distribution over last 180 days
DO $$
DECLARE
  types TEXT[] := ARRAY['Preparazione PC','Assistenza','Manutenzione','Configurazione','Recupero dati'];
  priorities TEXT[] := ARRAY['high','med','low'];
  statuses TEXT[] := ARRAY['ready','pending','in-progress','testing'];
  i INT;
  c TEXT;
  m TEXT;
  s TEXT;
  dev_serial TEXT;
  requester TEXT;
  assignee UUID;
  chosen_status TEXT;
  completed_at_ts timestamptz;
BEGIN
  FOR i IN 1..60 LOOP
    c := (SELECT name FROM public.clients ORDER BY random() LIMIT 1);
    m := (SELECT model FROM public.devices WHERE client_id = (SELECT id FROM public.clients WHERE name = c) ORDER BY random() LIMIT 1);
    dev_serial := (
      SELECT d.serial
      FROM public.devices d
      WHERE d.client_id = (SELECT id FROM public.clients WHERE name = c)
        AND d.serial IS NOT NULL
      ORDER BY random()
      LIMIT 1
    );
    requester := COALESCE(
      (SELECT first_name || ' ' || COALESCE(last_name,'') FROM public.client_contacts WHERE client_id = (SELECT id FROM public.clients WHERE name = c) ORDER BY random() LIMIT 1),
      c
    );

    -- choose a realistic ticket status and set completed_at when appropriate
    chosen_status := (
      CASE
        WHEN random() < 0.15 THEN 'completed'
        WHEN random() < 0.18 THEN 'archived'
        WHEN random() < 0.66 THEN 'ready'
        WHEN random() < 0.9 THEN 'pending'
        WHEN random() < 0.97 THEN 'in-progress'
        ELSE 'testing'
      END
    );

    IF chosen_status IN ('completed', 'archived') THEN
      completed_at_ts := now() - (floor(random()*120)::int || ' days')::interval;
    ELSE
      completed_at_ts := NULL;
    END IF;

    assignee := (SELECT id FROM public.profiles ORDER BY random() LIMIT 1);
    INSERT INTO public.tickets (ticket_code, client, model, serial, requester, end_user, priority, status, assignee_id, os, software, notes, created_by, completed_at, created_at)
    VALUES (
      format('PCT-%s', lpad(i::text,5,'0')),
      c,
      COALESCE(m, 'Dell Latitude 7430'),
      dev_serial,
      requester,
      requester,
      priorities[1 + floor(random()*array_length(priorities,1))::int]::public.ticket_priority,
      chosen_status::public.ticket_status,
      assignee,
      (CASE WHEN random() < 0.5 THEN 'Windows 11 Pro' ELSE 'Ubuntu 22.04 LTS' END),
      NULL,
      'Ticket generato da seed: problema esempio #' || i,
      NULL,
      completed_at_ts,
      now() - (floor(random()*180)::int || ' days')::interval
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END$$;

-- Backfill ticket relations (client_id, device_id, requester_contact_id) using existing migration logic
-- These updates are idempotent and will resolve FK relations based on textual fields
UPDATE public.tickets t
SET client_id = c.id
FROM public.clients c
WHERE t.client_id IS NULL AND c.name = btrim(t.client);

UPDATE public.tickets t
SET device_id = d.id
FROM public.devices d
WHERE t.device_id IS NULL
  AND t.client_id IS NOT NULL
  AND d.client_id = t.client_id
  AND (
    (t.serial IS NOT NULL AND btrim(t.serial) <> '' AND d.serial IS NOT NULL AND lower(d.serial) = lower(btrim(t.serial)))
    OR (
      (t.serial IS NULL OR btrim(t.serial) = '')
      AND t.model IS NOT NULL
      AND btrim(t.model) <> ''
      AND d.model = t.model
    )
  );

UPDATE public.tickets t
SET requester_contact_id = cc.id
FROM public.client_contacts cc
WHERE t.requester_contact_id IS NULL
  AND cc.client_id = t.client_id
  AND cc.first_name = btrim(split_part(t.requester, ' ', 1));

-- End of seed
