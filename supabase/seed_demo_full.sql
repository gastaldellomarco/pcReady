-- ============================================================================
-- SEED DEMO FULL — Static & Anagraphical Data
-- ============================================================================
-- Reference date: 2026-05-31 (end of 5-month demo window)
-- Generates: auth users, profiles, clients, contacts, devices, contracts,
--            bundles, checklist templates, scripts, email templates,
--            automation rules/flows, cost invoices/quotes, calendar events,
--            maintenance schedules, and all supporting data.
--
-- Idempotent: uses ON CONFLICT / DO UPDATE where possible.
-- ============================================================================


-- ============================================================================
-- 1. AUTH USERS (5 internal team members)
-- ============================================================================
-- Password: 'password123' (bcrypt hash)
-- Encrypted password hash generated from 'password123'
DO $$
DECLARE
    v_pwhash text := '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    v_now   timestamptz := '2026-01-01 09:00:00+01'::timestamptz;
BEGIN

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
SELECT * FROM (VALUES
    ('a0000001-0000-4000-8000-000000000001'::uuid, 'marco.villa@pcready.test', v_pwhash, v_now, '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Marco Villa"}'::jsonb, v_now, v_now, '', '', '', ''),
    ('a0000001-0000-4000-8000-000000000002'::uuid, 'laura.bianchi@pcready.test', v_pwhash, v_now, '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Laura Bianchi"}'::jsonb, v_now, v_now, '', '', '', ''),
    ('a0000001-0000-4000-8000-000000000003'::uuid, 'diego.ferraris@pcready.test', v_pwhash, v_now, '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Diego Ferraris"}'::jsonb, v_now, v_now, '', '', '', ''),
    ('a0000001-0000-4000-8000-000000000004'::uuid,  'sara.moretti@pcready.test',  v_pwhash, v_now, '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Sara Moretti"}'::jsonb, v_now, v_now, '', '', '', ''),
        ('a0000001-0000-4000-8000-000000000005'::uuid, 'valerio.neri@pcready.test', v_pwhash, v_now, '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Valerio Neri"}'::jsonb, v_now, v_now, '', '', '', '')
) AS t
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.column1);

END $$;

-- ============================================================================
-- 2. PROFILES + USER PROFILES + USER ROLES
-- ============================================================================
DO $$
DECLARE
    v_marco   uuid := 'a0000001-0000-4000-8000-000000000001'::uuid;
    v_laura   uuid := 'a0000001-0000-4000-8000-000000000002'::uuid;
    v_diego   uuid := 'a0000001-0000-4000-8000-000000000003'::uuid;
    v_sara    uuid := 'a0000001-0000-4000-8000-000000000004'::uuid;
    v_valerio uuid := 'a0000001-0000-4000-8000-000000000005'::uuid;
    v_date    date  := '2026-01-01'::date;
BEGIN

-- public.profiles
INSERT INTO public.profiles (id, full_name, initials, created_at) VALUES
    (v_marco,   'Marco Villa',   'MV', v_date),
    (v_laura,   'Laura Bianchi', 'LB', v_date),
    (v_diego,   'Diego Ferraris','DF', v_date),
    (v_sara,    'Sara Moretti',  'SM', v_date),
    (v_valerio, 'Valerio Neri',  'VN', v_date)
ON CONFLICT (id) DO NOTHING;

-- public.user_profiles
INSERT INTO public.user_profiles (id, display_name, avatar_url, phone, timezone, language, preferred_theme, password_set,
    notify_ticket_assigned, notify_ticket_status_changed, notify_automation_failed, notify_device_status_changed,
    notify_checklist_completed, notify_mentions, notify_ticket_completed,
    email_notify_ticket_assigned, email_notify_ticket_status_changed, email_notify_automation_failed,
    email_notify_device_status_changed, email_notify_checklist_completed, email_notify_mentions, email_notify_ticket_completed,
    dashboard_layout, created_at)
SELECT * FROM (VALUES
    (v_marco,   'Marco Villa',   'https://api.dicebear.com/7.x/avataaars/svg?seed=MarcoVilla',   '+39 02 1234561', 'Europe/Rome', 'it', 'system', true,
     true, true, true, true, true, true, true,
     true, true, true, true, true, true, true,
     '{"widgets":[{"id":"stat-cards","order":0,"visible":true},{"id":"analytics-card","order":1,"visible":true},{"id":"trend-chart","order":2,"visible":true},{"id":"recent-tickets","order":3,"visible":true},{"id":"overdue-tickets","order":4,"visible":true},{"id":"status-distribution","order":5,"visible":true},{"id":"technician-heatmap","order":6,"visible":true},{"id":"recent-activity","order":7,"visible":true}]}'::jsonb,
     v_date),
    (v_laura,   'Laura Bianchi', 'https://api.dicebear.com/7.x/avataaars/svg?seed=LauraBianchi', 'tel:+393451234567', 'Europe/Rome', 'it', 'light', true,
     true, true, true, true, true, true, true,
     true, true, true, true, true, true, true,
     '{"widgets":[{"id":"stat-cards","order":0,"visible":true},{"id":"analytics-card","order":1,"visible":true},{"id":"trend-chart","order":2,"visible":true},{"id":"devices-without-ticket","order":3,"visible":true},{"id":"recent-tickets","order":4,"visible":true},{"id":"technician-stats","order":5,"visible":true},{"id":"team-activity","order":6,"visible":true},{"id":"critical-events","order":7,"visible":true}]}'::jsonb,
     v_date),
    (v_diego,   'Diego Ferraris','https://api.dicebear.com/7.x/avataaars/svg?seed=DiegoFerraris','+39 051 987654',  'Europe/Rome', 'it', 'light', true,
     true, true, true, true, true, true, true,
     true, true, true, true, true, true, true,
     '{"widgets":[{"id":"stat-cards","order":0,"visible":true},{"id":"analytics-card","order":1,"visible":true},{"id":"recent-tickets","order":2,"visible":true},{"id":"recent-activity","order":3,"visible":true},{"id":"tickets-without-device","order":4,"visible":true},{"id":"status-distribution","order":5,"visible":true}]}'::jsonb,
     v_date),
    (v_sara,    'Sara Moretti',  'https://api.dicebear.com/7.x/avataaars/svg?seed=SaraMoretti',  'tel:+393331234567', 'Europe/Rome', 'it', 'dark', true,
     true, true, true, true, true, true, true,
     true, true, true, true, true, true, true,
     '{"widgets":[{"id":"stat-cards","order":0,"visible":true},{"id":"recent-tickets","order":1,"visible":true},{"id":"recent-activity","order":2,"visible":true},{"id":"technician-stats","order":3,"visible":true}]}'::jsonb,
     '2026-02-01'::date),
    (v_valerio, 'Valerio Neri',  'https://api.dicebear.com/7.x/avataaars/svg?seed=ValerioNeri',  '+39 075 555666',  'Europe/Rome', 'it', 'system', true,
     true, false, false, false, false, false, false,
     false, false, false, false, false, false, false,
     '{"widgets":[{"id":"stat-cards","order":0,"visible":true},{"id":"recent-tickets","order":1,"visible":true}]}'::jsonb,
     v_date)
) AS t
ON CONFLICT (id) DO NOTHING;

-- public.user_roles
INSERT INTO public.user_roles (user_id, role) VALUES
    (v_marco,   'admin'),
    (v_laura,   'tech'),
    (v_diego,   'tech'),
    (v_sara,    'tech'),
    (v_valerio, 'viewer')
ON CONFLICT DO NOTHING;

END $$;

-- ============================================================================
-- 3. APP SETTINGS
-- ============================================================================
INSERT INTO public.app_settings (key, value) VALUES
    ('organization_name', '"PCReady"'),
    ('default_timezone', '"Europe/Rome"'),
    ('support_email', '"support@pcready.test"'),
    ('max_devices_per_technician', '15'),
    ('self_registration_enabled', 'false'),
    ('admin_approval_required', 'true'),
    ('wip_limits', '{"pending":20,"in-progress":8,"testing":8,"ready":20}'),
    ('sla_config', '{"default_response_hours":4,"default_resolution_hours":48,"business_hours_only":true,"business_hours_start":"09:00","business_hours_end":"18:00"}'),
    ('os_options', '["Windows 11 Pro","Windows 10 Pro","macOS Sonoma","macOS Sequoia","Ubuntu 24.04","Ubuntu 22.04","iOS 18","iPadOS 18","Android 14"]'),
    ('device_brands', '["Dell","HP","Lenovo","Apple","Microsoft","Samsung","Brother","Cisco","Ubiquiti","Synology","Epson","Kyocera"]'),
    ('ticket_categories', '["Networking","Hardware","Software","Onboarding","Offboarding","Security","Backup","Email","VPN","Printer","Server","Mobile"]')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ============================================================================
-- 4. ASSISTANCE BUNDLES (4 standard packages)
-- ============================================================================
-- These are seeded by 20260526120000_assistance_bundles.sql migration already.
-- We only re-insert here to ensure demo consistency with ON CONFLICT.
INSERT INTO public.assistance_bundles (name, description, billing_type, fee, currency, included_hours, extra_hourly_rate, sla_response_hours, sla_resolution_hours, included_onsite_visits, remote_support, ticket_priority, auto_renew, active)
SELECT * FROM (VALUES
    ('Base',       'Pacchetto base per assistenza remota essenziale con un piccolo monte ore annuale.',  'annual', 480.00, 'EUR',  6.00,  80.00,  8, 72, 0, true,  'low',      true, true),
    ('Standard',   'Pacchetto standard per PMI con assistenza remota, SLA migliorato e visite onsite incluse.', 'annual', 1200.00, 'EUR', 20.00, 70.00,  4, 48, 2, true,  'med',      true, true),
    ('Premium',    'Pacchetto premium con priorità alta, monte ore esteso e interventi onsite inclusi.',  'annual', 2400.00, 'EUR', 50.00, 60.00,  2, 24, 6, true,  'high',     true, true),
    ('Enterprise', 'Pacchetto enterprise personalizzato: canone, SLA, ore e visite onsite definiti su misura.', 'annual', 0.00,    'EUR', NULL,   0.00,  1,  8, NULL, true, 'critical', true, true)
) AS t(name, description, billing_type, fee, currency, included_hours, extra_hourly_rate, sla_response_hours, sla_resolution_hours, included_onsite_visits, remote_support, ticket_priority, auto_renew, active)
WHERE NOT EXISTS (SELECT 1 FROM public.assistance_bundles b WHERE lower(b.name) = lower(t.name));

-- ============================================================================
-- 5. CLIENTS (11 clients)
-- ============================================================================
DO $$
DECLARE
    v_marco      uuid := 'a0000001-0000-4000-8000-000000000001'::uuid;
    v_date       date  := '2025-12-15'::date;
    v_client_ids uuid[];
    v_id         uuid;
BEGIN

-- Insert all 11 clients with complete data
-- We use array_agg to collect IDs for reference later
CREATE TEMP TABLE IF NOT EXISTS _clients (
    sort_key    int PRIMARY KEY,
    id          uuid,
    name        text,
    company_name text
);
TRUNCATE _clients;

INSERT INTO public.clients (name, company_name, vat_number, fiscal_code, address, email, phone, notes, website_url,
    portal_enabled, portal_logo_url, portal_primary_color, portal_welcome_message, portal_name, created_at, updated_at)
SELECT * FROM (VALUES
    ('Tecnolab Srl',                'Tecnolab Srl',                'IT01234560123', '01234560123', 'Via delle Industrie 45, 20142 Milano (MI)',          'info@tecnolab.test',       '+39 02 89456123', 'PMI manifatturiera specializzata in componentistica meccanica di precisione. Parco macchine: 25 postazioni + 2 server. Cliente storico con contratto Premium.', 'https://tecnolab.test',    true, 'https://api.dicebear.com/7.x/identicon/svg?seed=Tecnolab',   '#2563EB', 'Benvenuto nel portale clienti PCReady. Qui puoi aprire ticket, monitorare lo stato degli interventi e consultare la documentazione.', 'Portale Tecnolab',  v_date, v_date),
    ('Clinica San Luca Srl',        'Clinica San Luca Srl',        'IT03456780124', '03456780124', 'Viale della Salute 12, 50123 Firenze (FI)',          'it@clinicasanluca.test',   '+39 055 2345678', 'Struttura sanitaria privata con 50 posti letto e ambulatori. Gestione informatizzata cartelle cliniche. Necessita di massima affidabilità e GDPR.', 'https://clinicasanluca.test', true, 'https://api.dicebear.com/7.x/identicon/svg?seed=ClinicaSanLuca','#059669', 'Portale assistenza IT Clinica San Luca — apertura ticket e monitoraggio interventi.', 'Portale San Luca', v_date, v_date),
    ('Studio Legale Ferretti',      'Studio Legale Ferretti',      'IT05678901235', '05678901235', 'Corso Re Arduino 28, 10124 Torino (TO)',             'info@studioferretti.test', '+39 011 3456789', 'Studio legale associato con 15 avvocati e personale di segreteria. Dati sensibili, necessità di sicurezza informatica e backup certificato.', 'https://studioferretti.test', true, 'https://api.dicebear.com/7.x/identicon/svg?seed=Ferretti',    '#7C3AED', 'Benvenuto! Da qui puoi richiedere assistenza informatica per il tuo studio.', 'Portale Ferretti', v_date, v_date),
    ('Istituto Leonardo da Vinci',  'Istituto Leonardo da Vinci',  'IT07890123456', '07890123456', 'Via della Scuola 5, 25125 Brescia (BS)',             'segreteria@istitutodavinci.test', '+39 030 4567890', 'Scuola secondaria di secondo grado con 800 studenti e 60 docenti. 2 laboratori informatici, registro elettronico, sito web.', 'https://istitutodavinci.test', true, 'https://api.dicebear.com/7.x/identicon/svg?seed=DaVinci',    '#DC2626', 'Portale assistenza IT per il personale scolastico.', 'Portale Da Vinci', v_date, v_date),
    ('Ristorante Da Gigi',          'Ristorante Da Gigi SRL',      'IT09012345678', '09012345678', 'Piazza delle Erbe 15, 37121 Verona (VR)',            'info@ristorantedagigi.test','+39 045 5678901', 'Ristorante stellato con sala da 80 coperti. Booking online, POS, gestionale cucina. Necessità di assistenza rapida in orario di servizio.', 'https://ristorantedagigi.test', true, 'https://api.dicebear.com/7.x/identicon/svg?seed=DaGigi',     '#F59E0B', 'Portale assistenza — Richiedi supporto per i sistemi del ristorante.', 'Portale Da Gigi',  v_date, v_date),
    ('Farmacia Dott. Galli',        'Farmacia Dott. Galli',        'IT10123456789', '10123456789', 'Via Indipendenza 72, 40121 Bologna (BO)',            'farmacia@dottgalli.test',  '+39 051 6789012', 'Farmacia storica nel centro di Bologna. Gestione ricette, magazzino farmaci, terminale ricetta elettronica. 3 postazioni + server locale.', 'https://farmaciadottgalli.test', true, 'https://api.dicebear.com/7.x/identicon/svg?seed=FarmaciaGalli','#0891B2', 'Benvenuto nel portale assistenza della farmacia.', 'Portale Farmacia Galli', v_date, v_date),
    ('Autocarrozzeria Mercurio',    'Autocarrozzeria Mercurio SRL','IT11234567890', '11234567890', 'Via dell''Artigianato 21, 35123 Padova (PD)',          'info@mercurio.test',       '+39 049 7890123', 'Carrozzeria auto con 10 dipendenti. Gestione clienti, fatturazione, magazzino ricambi. PC da ufficio e tablet in officina.', 'https://mercurio.test',    true, 'https://api.dicebear.com/7.x/identicon/svg?seed=Mercurio',   '#B91C1C', 'Portale clienti per assistenza IT e apertura ticket.', 'Portale Mercurio', v_date, v_date),
    ('Hotel Palazzo della Regina',  'Hotel Palazzo della Regina SPA', 'IT12345678901', '12345678901', 'Lungomare Tintori 8, 47921 Rimini (RN)',            'reception@palazzodellaregina.test', '+39 0541 8901234', 'Hotel 4 stelle con 120 camere. Sistema di prenotazione, check-in digitale, smart TV, 12 postazioni reception/amministrazione.', 'https://palazzodellaregina.test', true, 'https://api.dicebear.com/7.x/identicon/svg?seed=HotelRegina', '#D946EF', 'Benvenuto! Richiedi assistenza per i sistemi dell''hotel.', 'Portale Regina',   v_date, v_date),
    ('Supermercato Alimentari & Co','Supermercato Alimentari & Co SPA','IT13456789012', '13456789012', 'Via Emilia Ovest 156, 41123 Modena (MO)',            'it@alimentarieco.test',    '+39 059 9012345', 'Supermercato a insegna regionale con 8 casse. Sistemi POS, bilance pesatura, server gestionale, terminali scanner. 2 sedi gestite.', 'https://alimentarieco.test', true, 'https://api.dicebear.com/7.x/identicon/svg?seed=Alimentari', '#65A30D', 'Portale assistenza tecnica per punti vendita.', 'Portale Alimentari & Co', v_date, v_date),
    ('Centro Estetico Beauty Lab',  'Beauty Lab SRL',               'IT14567890123', '14567890123', 'Via XX Settembre 33, 24122 Bergamo (BG)',            'info@beautylab.test',      '+39 035 0123456', 'Centro estetico e benessere con 6 cabine. Software prenotazioni, CRM clienti, gestione abbonamenti. 4 PC + tablet in area reception.', 'https://beautylab.test',   true, 'https://api.dicebear.com/7.x/identicon/svg?seed=BeautyLab',  '#EC4899', 'Portale clienti Beauty Lab — supporto IT per il centro.', 'Portale Beauty Lab', v_date, v_date),
    ('Banca Regionale Etruria',     'Banca Regionale Etruria SPA',  'IT15678901234', '15678901234', 'Corso Vannucci 50, 06121 Perugia (PG)',              'it@etruria.test',          '+39 075 1234567', 'Istituto bancario regionale con 15 filiali. Server rack centralizzato, firewall, workstation blindate. Massima sicurezza e conformità.', 'https://etruria.test',     true, 'https://api.dicebear.com/7.x/identicon/svg?seed=BancaEtruria','#1D4ED8', 'Portale assistenza IT Banca Etruria — solo personale autorizzato.', 'Portale Etruria',  v_date, v_date)
) AS t(name, company_name, vat_number, fiscal_code, address, email, phone, notes, website_url,
    portal_enabled, portal_logo_url, portal_primary_color, portal_welcome_message, portal_name, created_at, updated_at)
ON CONFLICT (name) DO NOTHING;

-- Collect inserted IDs for reference
-- We re-query because ON CONFLICT may skip existing rows
INSERT INTO _clients (sort_key, id, name, company_name)
SELECT row_number() OVER (ORDER BY name), id, name, company_name
FROM public.clients
WHERE name IN ('Tecnolab Srl','Clinica San Luca Srl','Studio Legale Ferretti',
               'Istituto Leonardo da Vinci','Ristorante Da Gigi','Farmacia Dott. Galli',
               'Autocarrozzeria Mercurio','Hotel Palazzo della Regina',
               'Supermercato Alimentari & Co','Centro Estetico Beauty Lab','Banca Regionale Etruria');

END $$;

-- ============================================================================
-- 6. CLIENT CONTACTS (1-3 per client)
-- ============================================================================
DO $$
DECLARE
    v_rec record;
BEGIN

FOR v_rec IN SELECT id, name FROM public.clients WHERE name IN (
    'Tecnolab Srl','Clinica San Luca Srl','Studio Legale Ferretti',
    'Istituto Leonardo da Vinci','Ristorante Da Gigi','Farmacia Dott. Galli',
    'Autocarrozzeria Mercurio','Hotel Palazzo della Regina',
    'Supermercato Alimentari & Co','Centro Estetico Beauty Lab','Banca Regionale Etruria'
) LOOP

    CASE v_rec.name
        WHEN 'Tecnolab Srl' THEN
            INSERT INTO public.client_contacts (client_id, first_name, last_name, full_name, email, phone, role, job_title, department, is_primary, notes, portal_password_hash, portal_password_updated_at) VALUES
                (v_rec.id, 'Roberto', 'Mancini',    'Roberto Mancini',    'r.mancini@tecnolab.test',    '+39 02 89456124', 'Responsabile IT',     'IT Manager',                'IT',        true,  'Referente tecnico principale. Interlocutore diretto per tutti i ticket.', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2026-01-10'),
                (v_rec.id, 'Elena',   'Rossi',       'Elena Rossi',        'e.rossi@tecnolab.test',      '+39 02 89456125', 'Amministrazione',     'Responsabile Amministrativo','Amministrazione', false, 'Gestisce contratti e fatturazione.', NULL, NULL),
                (v_rec.id, 'Marco',   'Ferrari',     'Marco Ferrari',      'm.ferrari@tecnolab.test',    '+39 02 89456126', 'Produzione',          'Capo Officina',             'Produzione',  false, 'Utilizza le postazioni del reparto produzione.', NULL, NULL)
            ON CONFLICT DO NOTHING;

        WHEN 'Clinica San Luca Srl' THEN
            INSERT INTO public.client_contacts (client_id, first_name, last_name, full_name, email, phone, role, job_title, department, is_primary, notes, portal_password_hash, portal_password_updated_at) VALUES
                (v_rec.id, 'Dott.ssa Maria', 'Bianchi', 'Dott.ssa Maria Bianchi', 'm.bianchi@clinicasanluca.test', '+39 055 2345679', 'Direttore Sanitario', 'Direttore Sanitario',        'Direzione',  true,  'Referente principale per le questioni IT. Medico con sensibilità digitale.', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2026-01-10'),
                (v_rec.id, 'Francesco',     'Neri',    'Francesco Neri',   'f.neri@clinicasanluca.test',   '+39 055 2345680', 'Sistemi Informativi', 'Tecnico Sistemi Informativi', 'IT',        false, 'Co-referente tecnico, gestisce la parte amministrativa dei sistemi.', NULL, NULL)
            ON CONFLICT DO NOTHING;

        WHEN 'Studio Legale Ferretti' THEN
            INSERT INTO public.client_contacts (client_id, first_name, last_name, full_name, email, phone, role, job_title, department, is_primary, notes, portal_password_hash, portal_password_updated_at) VALUES
                (v_rec.id, 'Avv. Carlo',  'Ferretti',  'Avv. Carlo Ferretti',  'c.ferretti@studioferretti.test',  '+39 011 3456790', 'Socio Fondatore',     'Avvocato Senior',           'Direzione',  true,  'Socio fondatore, approva personalmente interventi e investimenti IT.', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2026-01-10'),
                (v_rec.id, 'Simonetta',    'Gallo',    'Simonetta Gallo',      's.gallo@studioferretti.test',    '+39 011 3456791', 'Segreteria',          'Responsabile Segreteria',   'Segreteria', false, 'Primo punto di contatto per problemi informatici quotidiani.', NULL, NULL)
            ON CONFLICT DO NOTHING;

        WHEN 'Istituto Leonardo da Vinci' THEN
            INSERT INTO public.client_contacts (client_id, first_name, last_name, full_name, email, phone, role, job_title, department, is_primary, notes, portal_password_hash, portal_password_updated_at) VALUES
                (v_rec.id, 'Prof.ssa Anna', 'Verdi',   'Prof.ssa Anna Verdi','a.verdi@istitutodavinci.test', '+39 030 4567891', 'Dirigente Scolastico', 'Dirigente Scolastico',      'Direzione',  true,  'Dirigente che autorizza gli interventi.', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2026-01-10'),
                (v_rec.id, 'Luca',          'Conti',   'Luca Conti',           'l.conti@istitutodavinci.test', '+39 030 4567892', 'Docente Referente',   'Docente Informatica',       'Didattica',  false, 'Referente per i laboratori informatici e la sala docenti.', NULL, NULL)
            ON CONFLICT DO NOTHING;

        WHEN 'Ristorante Da Gigi' THEN
            INSERT INTO public.client_contacts (client_id, first_name, last_name, full_name, email, phone, role, job_title, department, is_primary, notes, portal_password_hash, portal_password_updated_at) VALUES
                (v_rec.id, 'Gigi',          'Marchetti','Gigi Marchetti',      'g.marchetti@ristorantedagigi.test','+39 045 5678902', 'Titolare',            'Chef Patron',               'Direzione',  true,  'Titolare, contatto diretto per ogni evenienza.', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2026-01-10'),
                (v_rec.id, 'Sofia',         'Romano',  'Sofia Romano',         's.romano@ristorantedagigi.test', '+39 045 5678903', 'Sala',                'Maitre',                    'Sala',       false, 'Utilizza il gestionale prenotazioni e il POS.', NULL, NULL)
            ON CONFLICT DO NOTHING;

        WHEN 'Farmacia Dott. Galli' THEN
            INSERT INTO public.client_contacts (client_id, first_name, last_name, full_name, email, phone, role, job_title, department, is_primary, notes, portal_password_hash, portal_password_updated_at) VALUES
                (v_rec.id, 'Dott. Marco',  'Galli',   'Dott. Marco Galli',    'marco.galli@dottgalli.test',   '+39 051 6789013', 'Titolare',            'Farmacista Direttore',      'Direzione',  true,  'Titolare della farmacia, contatto per decisioni strategiche.', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2026-01-10'),
                (v_rec.id, 'Chiara',        'Rinaldi', 'Chiara Rinaldi',       'c.rinaldi@dottgalli.test',     '+39 051 6789014', 'Farmacista',          'Farmacista Collaboratore',  'Farmacia',   false, 'Utilizza il gestionale ricette e il terminale elettronico.', NULL, NULL)
            ON CONFLICT DO NOTHING;

        WHEN 'Autocarrozzeria Mercurio' THEN
            INSERT INTO public.client_contacts (client_id, first_name, last_name, full_name, email, phone, role, job_title, department, is_primary, notes, portal_password_hash, portal_password_updated_at) VALUES
                (v_rec.id, 'Stefano',    'Bianco',  'Stefano Bianco',       's.bianco@mercurio.test',       '+39 049 7890124', 'Titolare',            'Proprietario',              'Direzione',  true,  'Titolare dell''autocarrozzeria, gestisce personalmente l''IT.', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2026-01-10'),
                (v_rec.id, 'Alessandro', 'Fabbri',  'Alessandro Fabbri',    'a.fabbri@mercurio.test',       '+39 049 7890125', 'Officina',            'Capo Officina',             'Produzione', false, 'Utilizza tablet in officina per la gestione dei lavori.', NULL, NULL)
            ON CONFLICT DO NOTHING;

        WHEN 'Hotel Palazzo della Regina' THEN
            INSERT INTO public.client_contacts (client_id, first_name, last_name, full_name, email, phone, role, job_title, department, is_primary, notes, portal_password_hash, portal_password_updated_at) VALUES
                (v_rec.id, 'Dott.ssa Lucia', 'Contarini','Dott.ssa Lucia Contarini','l.contarini@palazzodellaregina.test','+39 0541 8901235', 'Direttrice',          'Direttrice Hotel',          'Direzione',  true,  'Direttrice della struttura, referente per tutti i contratti.', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2026-01-10'),
                (v_rec.id, 'Matteo',        'Russo',   'Matteo Russo',        'm.russo@palazzodellaregina.test','+39 0541 8901236', 'Ricevimento',         'Capo Ricevimento',          'Reception',  false, 'Principale utilizzatore del gestionale di booking e check-in.', NULL, NULL),
                (v_rec.id, 'Paolo',         'Ferri',   'Paolo Ferri',         'p.ferri@palazzodellaregina.test','+39 0541 8901237', 'Amministrazione',     'Responsabile Amministrativo','Ufficio',    false, 'Gestisce fatturazione e contratti.', NULL, NULL)
            ON CONFLICT DO NOTHING;

        WHEN 'Supermercato Alimentari & Co' THEN
            INSERT INTO public.client_contacts (client_id, first_name, last_name, full_name, email, phone, role, job_title, department, is_primary, notes, portal_password_hash, portal_password_updated_at) VALUES
                (v_rec.id, 'Giuseppe',   'Fontana',  'Giuseppe Fontana',     'g.fontana@alimentarieco.test', '+39 059 9012346', 'IT Manager',          'Responsabile IT',           'IT',         true,  'Referente IT per tutti i punti vendita.', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2026-01-10'),
                (v_rec.id, 'Maria',      'Costa',    'Maria Costa',          'm.costa@alimentarieco.test',   '+39 059 9012347', 'Amministrazione',     'Responsabile Amministrativo','Ufficio',    false, 'Gestisce gli aspetti amministrativi e contratti.', NULL, NULL)
            ON CONFLICT DO NOTHING;

        WHEN 'Centro Estetico Beauty Lab' THEN
            INSERT INTO public.client_contacts (client_id, first_name, last_name, full_name, email, phone, role, job_title, department, is_primary, notes, portal_password_hash, portal_password_updated_at) VALUES
                (v_rec.id, 'Elena',      'Grecchi',  'Elena Grecchi',        'e.grecchi@beautylab.test',    '+39 035 0123457', 'Titolare',            'Proprietaria',              'Direzione',  true,  'Titolare del centro, referente unico.', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2026-01-10'),
                (v_rec.id, 'Camilla',    'Guerra',   'Camilla Guerra',       'c.guerra@beautylab.test',     '+39 035 0123458', 'Estetista',           'Estetista Senior',          'Operativo',  false, 'Utilizza il software prenotazioni e CRM clienti.', NULL, NULL)
            ON CONFLICT DO NOTHING;

        WHEN 'Banca Regionale Etruria' THEN
            INSERT INTO public.client_contacts (client_id, first_name, last_name, full_name, email, phone, role, job_title, department, is_primary, notes, portal_password_hash, portal_password_updated_at) VALUES
                (v_rec.id, 'Ing. Paolo', 'Mattei',   'Ing. Paolo Mattei',    'p.mattei@etruria.test',        '+39 075 1234568', 'Chief Technology Officer', 'CTO',          'IT',      true,  'CTO, referente per tutte le infrastrutture IT.', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '2026-01-10'),
                (v_rec.id, 'Dott. Luca', 'Barbieri', 'Dott. Luca Barbieri',  'l.barbieri@etruria.test',      '+39 075 1234569', 'IT Operations',       'IT Operations Manager',     'IT',        false, 'Referente operativo per la gestione quotidiana dei sistemi.', NULL, NULL)
            ON CONFLICT DO NOTHING;
        ELSE NULL;
    END CASE;

END LOOP;

END $$;

-- ============================================================================
-- 7. CLIENT TAGS
-- ============================================================================
INSERT INTO public.client_tags (name, color)
SELECT * FROM (VALUES ('VIP',             '#F59E0B'),
    ('SLA Premium',     '#8B5CF6'),
    ('Backup critico',  '#EF4444'),
    ('Reperibilità 24/7','#EC4899'),
    ('Wi-Fi gestito',   '#3B82F6'),
    ('Server on-premise','#10B981'),
    ('Cloud-first',     '#06B6D4'),
    ('GDPR critico',    '#DC2626'),
    ('Multi-sede',      '#F97316'),
    ('Monitoraggio 7/7','#6366F1')) AS t(name, color)
WHERE NOT EXISTS (SELECT 1 FROM public.client_tags ct WHERE ct.name = t.name);-- ============================================================================
-- 8. CLIENT TAG ASSIGNMENTS
-- ============================================================================
DO $$
DECLARE
    v_tid uuid;
    v_cid uuid;
BEGIN
    -- VIP: Banca, Clinica, Hotel
    SELECT id INTO v_tid FROM public.client_tags WHERE name = 'VIP';
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Banca Regionale Etruria','Clinica San Luca Srl','Hotel Palazzo della Regina') LOOP
        INSERT INTO public.client_tag_assignments (client_id, tag_id) VALUES (v_cid, v_tid) ON CONFLICT DO NOTHING;
    END LOOP;

    -- SLA Premium: Banca, Clinica, Tecnolab
    SELECT id INTO v_tid FROM public.client_tags WHERE name = 'SLA Premium';
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Banca Regionale Etruria','Clinica San Luca Srl','Tecnolab Srl') LOOP
        INSERT INTO public.client_tag_assignments (client_id, tag_id) VALUES (v_cid, v_tid) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Backup critico: Banca, Clinica, Studio Legale, Farmacia
    SELECT id INTO v_tid FROM public.client_tags WHERE name = 'Backup critico';
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Banca Regionale Etruria','Clinica San Luca Srl','Studio Legale Ferretti','Farmacia Dott. Galli') LOOP
        INSERT INTO public.client_tag_assignments (client_id, tag_id) VALUES (v_cid, v_tid) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Reperibilità 24/7: Clinica, Hotel, Banca
    SELECT id INTO v_tid FROM public.client_tags WHERE name = 'Reperibilità 24/7';
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Clinica San Luca Srl','Hotel Palazzo della Regina','Banca Regionale Etruria') LOOP
        INSERT INTO public.client_tag_assignments (client_id, tag_id) VALUES (v_cid, v_tid) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Wi-Fi gestito: Hotel, Ristorante, Scuola
    SELECT id INTO v_tid FROM public.client_tags WHERE name = 'Wi-Fi gestito';
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Hotel Palazzo della Regina','Ristorante Da Gigi','Istituto Leonardo da Vinci') LOOP
        INSERT INTO public.client_tag_assignments (client_id, tag_id) VALUES (v_cid, v_tid) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Server on-premise: Banca, Tecnolab, Supermercato, Hotel
    SELECT id INTO v_tid FROM public.client_tags WHERE name = 'Server on-premise';
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Banca Regionale Etruria','Tecnolab Srl','Supermercato Alimentari & Co','Hotel Palazzo della Regina') LOOP
        INSERT INTO public.client_tag_assignments (client_id, tag_id) VALUES (v_cid, v_tid) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Cloud-first: Studio Legale, Scuola, Beauty Lab
    SELECT id INTO v_tid FROM public.client_tags WHERE name = 'Cloud-first';
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Studio Legale Ferretti','Istituto Leonardo da Vinci','Centro Estetico Beauty Lab') LOOP
        INSERT INTO public.client_tag_assignments (client_id, tag_id) VALUES (v_cid, v_tid) ON CONFLICT DO NOTHING;
    END LOOP;

    -- GDPR critico: Banca, Clinica, Studio Legale, Farmacia
    SELECT id INTO v_tid FROM public.client_tags WHERE name = 'GDPR critico';
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Banca Regionale Etruria','Clinica San Luca Srl','Studio Legale Ferretti','Farmacia Dott. Galli') LOOP
        INSERT INTO public.client_tag_assignments (client_id, tag_id) VALUES (v_cid, v_tid) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Multi-sede: Supermercato, Banca
    SELECT id INTO v_tid FROM public.client_tags WHERE name = 'Multi-sede';
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Supermercato Alimentari & Co','Banca Regionale Etruria') LOOP
        INSERT INTO public.client_tag_assignments (client_id, tag_id) VALUES (v_cid, v_tid) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Monitoraggio 7/7: Hotel, Clinica
    SELECT id INTO v_tid FROM public.client_tags WHERE name = 'Monitoraggio 7/7';
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Hotel Palazzo della Regina','Clinica San Luca Srl') LOOP
        INSERT INTO public.client_tag_assignments (client_id, tag_id) VALUES (v_cid, v_tid) ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- ============================================================================
-- 9. CLIENT NOTES
-- ============================================================================
DO $$
DECLARE
    v_marco uuid := 'a0000001-0000-4000-8000-000000000001'::uuid;
    v_cid   uuid;
BEGIN
    -- 1-2 notes per client
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Tecnolab Srl','Clinica San Luca Srl','Studio Legale Ferretti','Istituto Leonardo da Vinci','Banca Regionale Etruria','Hotel Palazzo della Regina') LOOP
        INSERT INTO public.client_notes (client_id, content, author_id) VALUES
            (v_cid, 'Cliente seguito personalmente. Contratto in scadenza a dicembre 2026, avviare rinnovo a ottobre.', v_marco)
ON CONFLICT DO NOTHING;
    END LOOP;

    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Ristorante Da Gigi','Farmacia Dott. Galli','Autocarrozzeria Mercurio','Supermercato Alimentari & Co','Centro Estetico Beauty Lab') LOOP
        INSERT INTO public.client_notes (client_id, content, author_id) VALUES
            (v_cid, 'Cliente con contratto Standard. Richieste tipicamente semplici e rapide.', v_marco)
ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- ============================================================================
-- 10. CLIENT DOCUMENTS (metadata only)
-- ============================================================================
DO $$
DECLARE
    v_marco uuid := 'a0000001-0000-4000-8000-000000000001'::uuid;
    v_cid   uuid;
BEGIN
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Banca Regionale Etruria','Clinica San Luca Srl','Tecnolab Srl','Hotel Palazzo della Regina','Supermercato Alimentari & Co') LOOP
        INSERT INTO public.client_documents (client_id, file_name, storage_bucket, storage_path, file_size, mime_type, document_type, description, uploaded_by)
            VALUES
            (v_cid, 'contratto_assistenza_2026.pdf', 'client-documents', 'demo/' || v_cid::text || '/contratto_2026.pdf', 245760, 'application/pdf', 'contract', 'Contratto di assistenza annuale 2026 firmato digitalmente.', v_marco)
            ON CONFLICT (storage_bucket, storage_path) DO NOTHING;
    END LOOP;

    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Banca Regionale Etruria','Clinica San Luca Srl','Studio Legale Ferretti') LOOP
        INSERT INTO public.client_documents (client_id, file_name, storage_bucket, storage_path, file_size, mime_type, document_type, description, uploaded_by)
            VALUES
            (v_cid, 'ndp_informativa_privacy_signed.pdf', 'client-documents', 'demo/' || v_cid::text || '/ndp_signed.pdf', 184320, 'application/pdf', 'nda', 'NDP per trattamento dati sensibili firmata dal cliente.', v_marco)
            ON CONFLICT (storage_bucket, storage_path) DO NOTHING;
    END LOOP;
END $$;

-- ============================================================================
-- 11. CLIENT CONTRACTS
-- ============================================================================
DO $$
DECLARE
    v_cid  uuid;
    v_date date := '2026-05-31'::date;
BEGIN
    -- Tecnolab Srl — Premium annuale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Tecnolab Srl';
    INSERT INTO public.client_contracts (client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes) VALUES
        (v_cid, 'Contratto assistenza Premium 2026', 'active', 'annual', 2400, 50, 60, '2026-01-01', '2026-12-31', 'Contratto Premium con 50 ore incluse e priorità alta. Visite onsite incluse (6/anno).')
ON CONFLICT DO NOTHING;

    -- Clinica San Luca Srl — Premium annuale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Clinica San Luca Srl';
    INSERT INTO public.client_contracts (client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes) VALUES
        (v_cid, 'Contratto assistenza Sanità 2026', 'active', 'annual', 3600, 80, 55, '2026-01-01', '2026-12-31', 'Contratto sanitario con SLA ridotto (2h risposta, 12h risoluzione). Reperibilità 24/7 inclusa.')
ON CONFLICT DO NOTHING;

    -- Studio Legale Ferretti — Standard annuale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Studio Legale Ferretti';
    INSERT INTO public.client_contracts (client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes) VALUES
        (v_cid, 'Contratto assistenza Standard 2026', 'active', 'annual', 1200, 20, 70, '2026-01-01', '2026-12-31', 'Contratto Standard. Backup certificato GDPR incluso.')
ON CONFLICT DO NOTHING;

    -- Istituto Leonardo da Vinci — Standard annuale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Istituto Leonardo da Vinci';
    INSERT INTO public.client_contracts (client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes) VALUES
        (v_cid, 'Contratto assistenza Scuola 2026', 'active', 'annual', 960, 15, 75, '2026-01-01', '2026-12-31', 'Tariffa agevolata per ente scolastico. 2 laboratori da mantenere.')
ON CONFLICT DO NOTHING;

    -- Ristorante Da Gigi — Base mensile
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Ristorante Da Gigi';
    INSERT INTO public.client_contracts (client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes) VALUES
        (v_cid, 'Contratto assistenza Ristorante', 'active', 'monthly', 80, 4, 80, '2026-02-01', '2026-12-31', 'Canone mensile ridotto per piccola attività. Assistenza in orario serale.')
ON CONFLICT DO NOTHING;

    -- Farmacia Dott. Galli — Standard mensile
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Farmacia Dott. Galli';
    INSERT INTO public.client_contracts (client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes) VALUES
        (v_cid, 'Contratto assistenza Farmacia 2026', 'active', 'monthly', 150, 6, 75, '2026-01-15', '2026-12-31', 'Farmacia con terminale ricetta elettronica. Priorità ai ticket su sistemi di vendita.')
ON CONFLICT DO NOTHING;

    -- Autocarrozzeria Mercurio — Standard annuale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Autocarrozzeria Mercurio';
    INSERT INTO public.client_contracts (client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes) VALUES
        (v_cid, 'Contratto assistenza 2026', 'active', 'annual', 840, 12, 75, '2026-03-01', '2026-12-31', 'Nuovo contratto sottoscritto a marzo 2026.')
ON CONFLICT DO NOTHING;

    -- Hotel Palazzo della Regina — Premium annuale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Hotel Palazzo della Regina';
    INSERT INTO public.client_contracts (client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes) VALUES
        (v_cid, 'Contratto assistenza Hotel 2026', 'active', 'annual', 3000, 60, 65, '2026-01-01', '2026-12-31', 'Alta stagione estiva: potenziamento assistenza da giugno a settembre. Reperibilità 24/7.')
ON CONFLICT DO NOTHING;

    -- Supermercato Alimentari & Co — Standard annuale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Supermercato Alimentari & Co';
    INSERT INTO public.client_contracts (client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes) VALUES
        (v_cid, 'Contratto assistenza GDO 2026', 'active', 'annual', 1800, 30, 70, '2026-01-01', '2026-12-31', 'Due sedi da coprire. Interventi prevalentemente su POS e bilance.')
ON CONFLICT DO NOTHING;

    -- Centro Estetico Beauty Lab — Base annuale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Centro Estetico Beauty Lab';
    INSERT INTO public.client_contracts (client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes) VALUES
        (v_cid, 'Contratto assistenza Base 2026', 'active', 'annual', 480, 6, 80, '2026-02-01', '2026-12-31', 'Contratto base per piccola attività di benessere.')
ON CONFLICT DO NOTHING;

    -- Banca Regionale Etruria — Enterprise personalizzato
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Banca Regionale Etruria';
    INSERT INTO public.client_contracts (client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes) VALUES
        (v_cid, 'Contratto assistenza Enterprise 2026', 'active', 'annual', 12000, 200, 50, '2026-01-01', '2026-12-31', 'Contratto Enterprise per 15 filiali. Include firewall management, backup centralizzato e audit trimestrali.')
ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- 12. CLIENT BUNDLE ASSIGNMENTS + FEE PAYMENTS
-- ============================================================================
DO $$
DECLARE
    v_bundle_id uuid;
    v_cid       uuid;
    v_assign_id uuid;
    v_now       date := '2026-05-31'::date;
BEGIN
    -- Retrieve bundle IDs
    CREATE TEMP TABLE IF NOT EXISTS _bundle_ids (name text, id uuid);
    TRUNCATE _bundle_ids;
    INSERT INTO _bundle_ids SELECT name, id FROM public.assistance_bundles WHERE name IN ('Base','Standard','Premium','Enterprise');

    -- Assign bundles + create fee payments
    -- 1. Tecnolab → Premium
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Tecnolab Srl';
    SELECT id INTO v_bundle_id FROM _bundle_ids WHERE name = 'Premium';
    INSERT INTO public.client_bundle_assignments (client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, notes)
        VALUES (v_cid, v_bundle_id, 'active', '2026-01-01', '2026-12-31', true, 'automatic', 'Rinnovo automatico annuale.')
    ON CONFLICT DO NOTHING RETURNING id INTO v_assign_id;
    IF v_assign_id IS NULL THEN
        SELECT id INTO v_assign_id FROM public.client_bundle_assignments WHERE client_id = v_cid AND bundle_id = v_bundle_id;
    END IF;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 2400, '2026-01-01', '2026-12-31', '2026-01-05', 'paid')
ON CONFLICT DO NOTHING;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 2400, '2027-01-01', '2027-12-31', NULL, 'pending')
ON CONFLICT DO NOTHING;

    -- 2. Clinica San Luca → Premium (custom: higher SLA)
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Clinica San Luca Srl';
    SELECT id INTO v_bundle_id FROM _bundle_ids WHERE name = 'Premium';
    INSERT INTO public.client_bundle_assignments (client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, custom_fee, custom_included_hours, custom_extra_hourly_rate, custom_sla_response_hours, custom_sla_resolution_hours, notes)
        VALUES (v_cid, v_bundle_id, 'active', '2026-01-01', '2026-12-31', true, 'automatic', 3600, 80, 55, 2, 12, 'Override custom per esigenze sanitarie: SLA ridotto e più ore incluse.')
    ON CONFLICT DO NOTHING RETURNING id INTO v_assign_id;
    IF v_assign_id IS NULL THEN
        SELECT id INTO v_assign_id FROM public.client_bundle_assignments WHERE client_id = v_cid AND bundle_id = v_bundle_id;
    END IF;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 3600, '2026-01-01', '2026-12-31', '2026-01-03', 'paid')
ON CONFLICT DO NOTHING;

    -- 3. Studio Legale Ferretti → Standard
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Studio Legale Ferretti';
    SELECT id INTO v_bundle_id FROM _bundle_ids WHERE name = 'Standard';
    INSERT INTO public.client_bundle_assignments (client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, notes)
        VALUES (v_cid, v_bundle_id, 'active', '2026-01-01', '2026-12-31', true, 'automatic', 'Rinnovo automatico annuale.')
    ON CONFLICT DO NOTHING RETURNING id INTO v_assign_id;
    IF v_assign_id IS NULL THEN
        SELECT id INTO v_assign_id FROM public.client_bundle_assignments WHERE client_id = v_cid AND bundle_id = v_bundle_id;
    END IF;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 1200, '2026-01-01', '2026-12-31', '2026-01-10', 'paid')
ON CONFLICT DO NOTHING;

    -- 4. Istituto Leonardo da Vinci → Standard (custom: reduced fee)
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Istituto Leonardo da Vinci';
    SELECT id INTO v_bundle_id FROM _bundle_ids WHERE name = 'Standard';
    INSERT INTO public.client_bundle_assignments (client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, custom_fee, custom_included_hours, notes)
        VALUES (v_cid, v_bundle_id, 'active', '2026-01-01', '2026-12-31', true, 'automatic', 960, 15, 'Tariffa agevolata per ente scolastico.')
    ON CONFLICT DO NOTHING RETURNING id INTO v_assign_id;
    IF v_assign_id IS NULL THEN
        SELECT id INTO v_assign_id FROM public.client_bundle_assignments WHERE client_id = v_cid AND bundle_id = v_bundle_id;
    END IF;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 960, '2026-01-01', '2026-12-31', '2026-01-12', 'paid')
ON CONFLICT DO NOTHING;

    -- 5. Ristorante Da Gigi → Base
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Ristorante Da Gigi';
    SELECT id INTO v_bundle_id FROM _bundle_ids WHERE name = 'Base';
    INSERT INTO public.client_bundle_assignments (client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, notes)
        VALUES (v_cid, v_bundle_id, 'active', '2026-02-01', '2026-12-31', true, 'manual', 'Canone ridotto per attività stagionale.')
    ON CONFLICT DO NOTHING RETURNING id INTO v_assign_id;
    IF v_assign_id IS NULL THEN
        SELECT id INTO v_assign_id FROM public.client_bundle_assignments WHERE client_id = v_cid AND bundle_id = v_bundle_id;
    END IF;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 80, '2026-02-01', '2026-02-28', '2026-02-05', 'paid')
ON CONFLICT DO NOTHING;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 80, '2026-03-01', '2026-03-31', '2026-03-03', 'paid')
ON CONFLICT DO NOTHING;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 80, '2026-04-01', '2026-04-30', '2026-04-05', 'paid')
ON CONFLICT DO NOTHING;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 80, '2026-05-01', '2026-05-31', '2026-05-04', 'paid')
ON CONFLICT DO NOTHING;

    -- 6. Farmacia Dott. Galli → Standard (custom: monthly billing)
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Farmacia Dott. Galli';
    SELECT id INTO v_bundle_id FROM _bundle_ids WHERE name = 'Standard';
    INSERT INTO public.client_bundle_assignments (client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, custom_fee, custom_included_hours, notes)
        VALUES (v_cid, v_bundle_id, 'active', '2026-01-15', '2026-12-31', true, 'automatic', 150, 6, 'Canone mensile. Incluse 6 ore/mese.')
    ON CONFLICT DO NOTHING RETURNING id INTO v_assign_id;
    IF v_assign_id IS NULL THEN
        SELECT id INTO v_assign_id FROM public.client_bundle_assignments WHERE client_id = v_cid AND bundle_id = v_bundle_id;
    END IF;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 150, '2026-01-15', '2026-02-14', '2026-01-20', 'paid')
ON CONFLICT DO NOTHING;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 150, '2026-02-15', '2026-03-14', '2026-02-18', 'paid')
ON CONFLICT DO NOTHING;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 150, '2026-03-15', '2026-04-14', '2026-03-20', 'paid')
ON CONFLICT DO NOTHING;

    -- 7. Autocarrozzeria Mercurio → Standard
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Autocarrozzeria Mercurio';
    SELECT id INTO v_bundle_id FROM _bundle_ids WHERE name = 'Standard';
    INSERT INTO public.client_bundle_assignments (client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, notes)
        VALUES (v_cid, v_bundle_id, 'active', '2026-03-01', '2026-12-31', true, 'automatic', 'Nuovo contratto attivo da marzo 2026.')
    ON CONFLICT DO NOTHING RETURNING id INTO v_assign_id;
    IF v_assign_id IS NULL THEN
        SELECT id INTO v_assign_id FROM public.client_bundle_assignments WHERE client_id = v_cid AND bundle_id = v_bundle_id;
    END IF;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 1200, '2026-03-01', '2026-12-31', '2026-03-05', 'paid')
ON CONFLICT DO NOTHING;

    -- 8. Hotel Palazzo della Regina → Premium (custom)
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Hotel Palazzo della Regina';
    SELECT id INTO v_bundle_id FROM _bundle_ids WHERE name = 'Premium';
    INSERT INTO public.client_bundle_assignments (client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, custom_fee, custom_included_hours, custom_extra_hourly_rate, notes)
        VALUES (v_cid, v_bundle_id, 'active', '2026-01-01', '2026-12-31', true, 'automatic', 3000, 60, 65, 'Personalizzato per esigenze alberghiere.')
    ON CONFLICT DO NOTHING RETURNING id INTO v_assign_id;
    IF v_assign_id IS NULL THEN
        SELECT id INTO v_assign_id FROM public.client_bundle_assignments WHERE client_id = v_cid AND bundle_id = v_bundle_id;
    END IF;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 3000, '2026-01-01', '2026-12-31', '2026-01-08', 'paid')
ON CONFLICT DO NOTHING;

    -- 9. Supermercato Alimentari & Co → Standard
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Supermercato Alimentari & Co';
    SELECT id INTO v_bundle_id FROM _bundle_ids WHERE name = 'Standard';
    INSERT INTO public.client_bundle_assignments (client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, notes)
        VALUES (v_cid, v_bundle_id, 'active', '2026-01-01', '2026-12-31', true, 'automatic', 'Rinnovo automatico.')
    ON CONFLICT DO NOTHING RETURNING id INTO v_assign_id;
    IF v_assign_id IS NULL THEN
        SELECT id INTO v_assign_id FROM public.client_bundle_assignments WHERE client_id = v_cid AND bundle_id = v_bundle_id;
    END IF;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 1800, '2026-01-01', '2026-12-31', '2026-01-15', 'paid')
ON CONFLICT DO NOTHING;

    -- 10. Centro Estetico Beauty Lab → Base
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Centro Estetico Beauty Lab';
    SELECT id INTO v_bundle_id FROM _bundle_ids WHERE name = 'Base';
    INSERT INTO public.client_bundle_assignments (client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, notes)
        VALUES (v_cid, v_bundle_id, 'active', '2026-02-01', '2026-12-31', true, 'manual', null)
    ON CONFLICT DO NOTHING RETURNING id INTO v_assign_id;
    IF v_assign_id IS NULL THEN
        SELECT id INTO v_assign_id FROM public.client_bundle_assignments WHERE client_id = v_cid AND bundle_id = v_bundle_id;
    END IF;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 480, '2026-02-01', '2026-12-31', '2026-02-05', 'paid')
ON CONFLICT DO NOTHING;

    -- 11. Banca Regionale Etruria → Enterprise
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Banca Regionale Etruria';
    SELECT id INTO v_bundle_id FROM _bundle_ids WHERE name = 'Enterprise';
    INSERT INTO public.client_bundle_assignments (client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, custom_fee, custom_included_hours, custom_extra_hourly_rate, custom_sla_response_hours, custom_sla_resolution_hours, notes)
        VALUES (v_cid, v_bundle_id, 'active', '2026-01-01', '2026-12-31', true, 'automatic', 12000, 200, 50, 1, 8, 'Contratto Enterprise personalizzato per banca con 15 filiali.')
    ON CONFLICT DO NOTHING RETURNING id INTO v_assign_id;
    IF v_assign_id IS NULL THEN
        SELECT id INTO v_assign_id FROM public.client_bundle_assignments WHERE client_id = v_cid AND bundle_id = v_bundle_id;
    END IF;
    INSERT INTO public.bundle_fee_payments (client_bundle_assignment_id, client_id, amount, period_start, period_end, paid_at, status)
        VALUES (v_assign_id, v_cid, 12000, '2026-01-01', '2026-12-31', '2026-01-02', 'paid')
ON CONFLICT DO NOTHING;

END $$;

-- ============================================================================
-- 13. CHECKLIST TEMPLATES
-- ============================================================================
INSERT INTO public.checklist_templates (name, description, is_default, structure, created_by)
SELECT * FROM (VALUES     ('Setup nuovo dispositivo', 'Checklist per configurazione di un nuovo PC/notebook aziendale: installazione SO, software, account e backup.', true,
     '{"sections":[{"key":"setup_hardware","title":"Verifica hardware","order":0,"items":[{"key":"unboxing","label":"Verifica imballo e integrità fisica","type":"checkbox"},{"key":"power_on","label":"Primo avvio e test accensione","type":"checkbox"},{"key":"bios_check","label":"Verifica BIOS/UEFI: firmware aggiornato, Secure Boot abilitato","type":"checkbox"}]},{"key":"setup_os","title":"Installazione sistema operativo","order":1,"items":[{"key":"os_install","label":"Installazione SO (Win/Mac/Linux) con impostazioni standard","type":"checkbox"},{"key":"os_updates","label":"Applicazione aggiornamenti di sistema","type":"checkbox"},{"key":"drivers","label":"Installazione driver e firmware","type":"checkbox"},{"key":"encryption","label":"Abilitazione crittografia disco (BitLocker/FileVault/LUKS)","type":"checkbox"}]},{"key":"setup_software","title":"Software e account","order":2,"items":[{"key":"antivirus","label":"Installazione e configurazione AV","type":"checkbox"},{"key":"office","label":"Installazione Microsoft 365 / LibreOffice","type":"checkbox"},{"key":"vpn","label":"Configurazione client VPN","type":"checkbox"},{"key":"accounts","label":"Configurazione account aziendali (email, cloud, ERP)","type":"checkbox"},{"key":"backup","label":"Configurazione backup locale/cloud","type":"checkbox"}]},{"key":"setup_delivery","title":"Consegna","order":3,"items":[{"key":"label","label":"Applicazione etichetta asset","type":"checkbox"},{"key":"user_test","label":"Test con utente finale","type":"checkbox"},{"key":"docs","label":"Consegna manuali e accessori","type":"checkbox"},{"key":"signature","label":"Firma ricevuta di consegna","type":"text"}]}]}'::jsonb,
     'a0000001-0000-4000-8000-000000000001'::uuid),
    ('Manutenzione periodica server', 'Checklist per manutenzione ordinaria di server aziendali: pulizia, backup, aggiornamenti.', false,
     '{"sections":[{"key":"server_physical","title":"Verifica fisica","order":0,"items":[{"key":"cleaning","label":"Pulizia filtri e ventole","type":"checkbox"},{"key":"leds","label":"Controllo spie LED e allarmi","type":"checkbox"},{"key":"temps","label":"Verifica temperature componenti","type":"text"}]},{"key":"server_system","title":"Sistema","order":1,"items":[{"key":"updates","label":"Applicazione aggiornamenti critici","type":"checkbox"},{"key":"logs","label":"Analisi log di sistema (error/warn)","type":"checkbox"},{"key":"disk","label":"Verifica spazio disco e RAID health","type":"checkbox"},{"key":"memory","label":"Test memoria (memtest)","type":"checkbox"}]},{"key":"server_backup","title":"Backup","order":2,"items":[{"key":"backup_check","label":"Verifica esito ultimo backup","type":"checkbox"},{"key":"restore_test","label":"Test ripristino file di esempio","type":"checkbox"},{"key":"offsite","label":"Verifica backup off-site","type":"checkbox"}]},{"key":"server_security","title":"Sicurezza","order":3,"items":[{"key":"certificates","label":"Verifica scadenza certificati SSL/TLS","type":"checkbox"},{"key":"access","label":"Review accessi e utenti","type":"checkbox"},{"key":"firewall","label":"Verifica regole firewall","type":"checkbox"}]}]}'::jsonb,
     'a0000001-0000-4000-8000-000000000001'::uuid),
    ('Check-in dispositivo per riparazione', 'Checklist per accettazione di un dispositivo in riparazione: anamnesi, test preliminari e consenso.', true,
     '{"sections":[{"key":"intake","title":"Accettazione","order":0,"items":[{"key":"client_info","label":"Registrazione dati cliente","type":"text"},{"key":"device_info","label":"Registrazione modello e seriale","type":"text"},{"key":"condition","label":"Foto condizioni esterne","type":"checkbox"},{"key":"accessories","label":"Verifica accessori (caricatore, cavi, mouse)","type":"checkbox"},{"key":"client_sign","label":"Firma consenso riparazione","type":"text"}]},{"key":"diagnostics","title":"Diagnostica preliminare","order":1,"items":[{"key":"power_test","label":"Test alimentazione","type":"checkbox"},{"key":"display","label":"Test display","type":"checkbox"},{"key":"keyboard","label":"Test tastiera/trackpad","type":"checkbox"},{"key":"ports","label":"Test porte USB, HDMI, audio","type":"checkbox"},{"key":"battery","label":"Verifica stato batteria","type":"text"}]},{"key":"report","title":"Referto","order":2,"items":[{"key":"symptoms","label":"Descrizione sintomi dal cliente","type":"text"},{"key":"diagnosis","label":"Diagnosi preliminare","type":"text"},{"key":"estimate","label":"Preventivo approvato","type":"text"}]}]}'::jsonb,
     'a0000001-0000-4000-8000-000000000001'::uuid),
    ('Trasferimento dati e migrazione', 'Checklist per trasferimento dati da vecchio a nuovo dispositivo con verifica integrità.', false,
     '{"sections":[{"key":"mig_prep","title":"Preparazione","order":0,"items":[{"key":"inventory","label":"Inventario dati da trasferire","type":"checkbox"},{"key":"backup","label":"Backup completo vecchio dispositivo","type":"checkbox"},{"key":"cleanup","label":"Pulizia file temporanei e cache","type":"checkbox"}]},{"key":"mig_transfer","title":"Trasferimento","order":1,"items":[{"key":"files","label":"Copia file utente (documenti, immagini, desktop)","type":"checkbox"},{"key":"email","label":"Esportazione/importazione email e contatti","type":"checkbox"},{"key":"browser","label":"Migrazione preferenze browser (preferiti, password salvate)","type":"checkbox"},{"key":"apps","label":"Reinstallazione applicazioni con licenze","type":"checkbox"}]},{"key":"mig_verify","title":"Verifica","order":2,"items":[{"key":"integrity","label":"Verifica integrità dati trasferiti","type":"checkbox"},{"key":"user_test","label":"Test con utente finale","type":"checkbox"},{"key":"old_device","label":"Pulizia e dismissione vecchio dispositivo","type":"checkbox"}]}]}'::jsonb,
     'a0000001-0000-4000-8000-000000000001'::uuid)
) AS t(name, description, is_default, structure, created_by)
WHERE NOT EXISTS (SELECT 1 FROM public.checklist_templates ct WHERE ct.name = t.name);-- ============================================================================
-- 14. SCRIPTS
-- ============================================================================
INSERT INTO public.scripts (name, description, category, language, content, color, icon, created_by)
SELECT * FROM (VALUES     ('WiFi Diagnostics', 'Raccoglie informazioni sulla connessione WiFi: SSID, segnale, canale, interferenze.', 'Networking', 'powershell',
     'Get-NetAdapter -Name "*Wi-Fi*" | Get-NetAdapterStatistics\nnetsh wlan show interfaces\nnetsh wlan show networks mode=bssid',
     '#3B82F6', 'Wifi', 'a0000001-0000-4000-8000-000000000001'::uuid),
    ('Disk Health Report', 'Report completo sullo stato dei dischi: SMART, spazio, performance.', 'Hardware', 'powershell',
     'Get-PhysicalDisk | Select-Object *\nGet-WmiObject Win32_DiskDrive | Select-Object Model,Size,Status\nGet-WmiObject Win32_LogicalDisk | Select-Object DeviceID,Size,FreeSpace',
     '#10B981', 'HardDrive', 'a0000001-0000-4000-8000-000000000002'::uuid),
    ('System Info Collector', 'Raccoglie configurazione hardware e software del sistema.', 'Hardware', 'powershell',
     'systeminfo | Select-String "OS Name","OS Version","System Manufacturer","System Model","Total Physical Memory"\nGet-WmiObject Win32_Processor | Select-Object Name,NumberOfCores,MaxClockSpeed\nGet-WmiObject Win32_ComputerSystem | Select-Object Manufacturer,Model,TotalPhysicalMemory',
     '#8B5CF6', 'Monitor', 'a0000001-0000-4000-8000-000000000002'::uuid),
    ('Reset TCP/IP Stack', 'Resetta lo stack TCP/IP per problemi di connettività di rete.', 'Networking', 'cmd',
     'netsh int ip reset\nnetsh winsock reset\nipconfig /flushdns\nipconfig /release\nipconfig /renew',
     '#F59E0B', 'Network', 'a0000001-0000-4000-8000-000000000003'::uuid),
    ('Battery Report Generator', 'Genera report dettagliato sullo stato della batteria.', 'Hardware', 'powershell',
     'powercfg /batteryreport\n$report = Get-ChildItem -Path $env:USERPROFILE -Filter "battery-report.html" -Recurse | Select-Object -First 1\nif ($report) { Invoke-Item $report.FullName }',
     '#EC4899', 'BatteryFull', 'a0000001-0000-4000-8000-000000000004'::uuid),
    ('Check Windows Updates', 'Controlla e installa gli aggiornamenti Windows in sospeso.', 'Software', 'powershell',
     'Install-Module PSWindowsUpdate -Force -Confirm:$false\nGet-WUInstall -MicrosoftUpdate -AcceptAll -AutoReboot:$false',
     '#6366F1', 'Package', 'a0000001-0000-4000-8000-000000000003'::uuid)
) AS t(name, description, category, language, content, color, icon, created_by)
WHERE NOT EXISTS (SELECT 1 FROM public.scripts s WHERE s.name = t.name);-- ============================================================================
-- 15. AUTOMATION RULES (existing + updates)
-- ============================================================================
INSERT INTO public.automation_rules (trigger_text, action_text, category, description, active, sort)
SELECT * FROM (VALUES     ('quando un ticket viene creato con priorità "alta"', 'assegna automaticamente il ticket al tecnico con meno carico di lavoro', 'Assegnazione', 'Distribuisce automaticamente i ticket prioritari tra i tecnici disponibili.', true, 1),
    ('quando un ticket rimane in stato "pending" per più di 4 ore', 'invia notifica di promemoria al tecnico assegnato', 'Notifica', 'Evita che ticket in attesa vengano dimenticati.', true, 2),
    ('quando un ticket viene completato', 'invia email di soddisfazione al cliente', 'Notifica', 'Richiede feedback al cliente dopo la chiusura del ticket.', true, 3),
    ('quando un dispositivo ha ticket aperti da più di 48 ore', 'cambia priorità del ticket a "alta"', 'Priorità', 'Ticket critici per tempo di risposta.', false, 4),
    ('quando un nuovo contatto viene creato nel portale', 'invia notifica di benvenuto con credenziali di accesso', 'Portale', 'Accoglienza nuovi contatti clienti.', true, 5)
) AS t(trigger_text, action_text, category, description, active, sort)
WHERE NOT EXISTS (SELECT 1 FROM public.automation_rules ar WHERE ar.trigger_text = t.trigger_text);-- Update automation rules execution counts
UPDATE public.automation_rules SET count = count + floor(random() * 50 + 10)::int, last_run_at = '2026-05-31 10:00:00+02'::timestamptz WHERE active = true;

-- ============================================================================
-- 16. AUTOMATION FLOWS
-- ============================================================================
INSERT INTO public.automation_flows (name, description, category, active, trigger_definition, conditions_definition, actions_definition, flow_definition, created_by)
SELECT * FROM (VALUES
    ('Assegnazione ticket prioritari', 'Assegna automaticamente ticket urgenti al tecnico meno carico.', 'Assegnazione', true,
     '{"type":"ticket_created","config":{"priority_in":["high"]}}'::jsonb,
     '{"all":[{"field":"ticket.priority","operator":"in","value":["high"]}]}'::jsonb,
    '[{"type":"assign_ticket","config":{"strategy":"least_loaded","roles":["tech"]}}]'::jsonb,
    '{"trigger":{"type":"ticket_created","config":{"priority_in":["high"]}},"conditions":{"all":[{"field":"ticket.priority","operator":"in","value":["high"]}]},"actions":[{"type":"assign_ticket","config":{"strategy":"least_loaded","roles":["tech"]}}],"nodes":[{"id":"n-trigger","type":"trigger","config":{"type":"ticket_created","config":{"priority_in":["high"]}}},{"id":"n-action","type":"action","config":{"type":"assign_ticket","config":{"strategy":"least_loaded","roles":["tech"]}}}],"edges":[{"from":"n-trigger","to":"n-action"}]}'::jsonb,
     'a0000001-0000-4000-8000-000000000001'::uuid),
    ('Promemoria ticket in attesa', 'Invia notifica se un ticket resta pending oltre 4 ore.', 'Notifica', true,
    '{"type":"scheduled","config":{"schedule":"*/30 * * * *"}}'::jsonb,
     '{"all":[{"field":"ticket.status","operator":"eq","value":"pending"},{"field":"ticket.created_at","operator":"older_than","value":"4 hours"}]}'::jsonb,
    '[{"type":"create_notification","config":{"title":"Ticket in attesa da oltre 4 ore","severity":"warning"}}]'::jsonb,
    '{"trigger":{"type":"scheduled","config":{"schedule":"*/30 * * * *"}},"conditions":{"all":[{"field":"ticket.status","operator":"eq","value":"pending"},{"field":"ticket.created_at","operator":"older_than","value":"4 hours"}]},"actions":[{"type":"create_notification","config":{"title":"Ticket in attesa da oltre 4 ore","severity":"warning"}}],"nodes":[{"id":"n-trigger","type":"trigger","config":{"type":"scheduled","config":{"schedule":"*/30 * * * *"}}},{"id":"n-action","type":"action","config":{"type":"create_notification","config":{"title":"Ticket in attesa da oltre 4 ore","severity":"warning"}}}],"edges":[{"from":"n-trigger","to":"n-action"}]}'::jsonb,
     'a0000001-0000-4000-8000-000000000001'::uuid)
) AS t
WHERE NOT EXISTS (SELECT 1 FROM public.automation_flows f WHERE lower(f.name) = lower(t.column1));

-- ============================================================================
-- 17. EMAIL TEMPLATES (preserve existing + add demo variants)
-- ============================================================================
INSERT INTO public.email_templates (event_type, subject, body_html, body_text, variables, is_active) VALUES
    ('ticket_assigned',        'Nuovo ticket assegnato: {{ticket_code}}',                                    '<h2>Nuovo ticket assegnato</h2><p>Ti è stato assegnato il ticket <strong>{{ticket_code}}</strong>.</p><p>Cliente: {{client_name}}<br>Priorità: {{priority}}<br>Oggetto: {{title}}</p><a href="{{ticket_url}}">Apri ticket</a>', null, '{"ticket_code":"","client_name":"","priority":"","title":"","ticket_url":""}'::jsonb, true),
    ('portal_ticket_status_changed',  'Ticket {{ticket_code}} cambiato in {{new_status}}',                          '<h2>Aggiornamento ticket</h2><p>Il ticket <strong>{{ticket_code}}</strong> è passato a <strong>{{new_status}}</strong>.</p><p>Cliente: {{client_name}}</p><a href="{{ticket_url}}">Visualizza ticket</a>', null, '{"ticket_code":"","new_status":"","client_name":"","ticket_url":""}'::jsonb, true),
    ('ticket_completed',       'Ticket {{ticket_code}} completato',                                          '<h2>Ticket completato</h2><p>Il ticket <strong>{{ticket_code}}</strong> per {{client_name}} è stato completato.</p><p>Ci farebbe piacere ricevere un tuo feedback.</p><a href="{{feedback_url}}">Lascia una recensione</a>', null, '{"ticket_code":"","client_name":"","feedback_url":""}'::jsonb, true),
    ('checklist_completed',   'Manutenzione programmata in scadenza: {{schedule_title}}',                   '<h2>Promemoria manutenzione</h2><p>La manutenzione programmata <strong>{{schedule_title}}</strong> è in scadenza il {{due_date}}.</p><p>Dispositivo: {{device_name}} ({{device_model}})<br>Cliente: {{client_name}}</p><a href="{{schedule_url}}">Visualizza schedule</a>', null, '{"schedule_title":"","due_date":"","device_name":"","device_model":"","client_name":"","schedule_url":""}'::jsonb, true),
    ('ticket_assigned',      'Automation failed: {{rule_name}}',                                           '<h2>Automation fallita</h2><p>La regola <strong>{{rule_name}}</strong> ha riscontrato un errore durante l''esecuzione.</p><p>Errore: {{error_message}}</p><a href="{{logs_url}}">Visualizza log</a>', null, '{"rule_name":"","error_message":"","logs_url":""}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 18. OAUTH CLIENT (demo)
-- ============================================================================
INSERT INTO public.oauth_clients (client_id, client_secret, name, description, redirect_uris, scopes_allowed, status, created_by)
SELECT * FROM (VALUES
    ('pcready-demo-client', 'demo-secret-change-in-production', 'PCReady Demo Client', 'Client OAuth di test per lo sviluppo.', ARRAY['http://localhost:5173/auth/callback'], ARRAY['openid','profile','email','pcready:read']::public.oauth_scope[], 'active'::public.oauth_client_status, 'a0000001-0000-4000-8000-000000000001'::uuid)
) AS t
WHERE NOT EXISTS (SELECT 1 FROM public.oauth_clients o WHERE o.client_id = t.column1);

-- ============================================================================
-- 19. AUDIT PRESETS
-- ============================================================================
INSERT INTO public.audit_presets (name, filters, user_id)
SELECT * FROM (VALUES     ('Ticket ad alta priorità', '{"entity_type":"ticket","severity":["warning","critical"],"date_from":"2026-01-01","date_to":"2026-05-31","priority":["high"]}'::jsonb, 'a0000001-0000-4000-8000-000000000001'::uuid),
    ('Attività dei tecnici', '{"entity_type":"ticket","action_type":["ticket_created","ticket_assigned"],"date_from":"2026-01-01","date_to":"2026-05-31"}'::jsonb, 'a0000001-0000-4000-8000-000000000002'::uuid),
    ('Errori di sistema', '{"severity":["critical"],"entity_type":["device","server"],"date_from":"2026-01-01","date_to":"2026-05-31"}'::jsonb, 'a0000001-0000-4000-8000-000000000003'::uuid)
) AS t(name, filters, user_id)
WHERE NOT EXISTS (SELECT 1 FROM public.audit_presets ap WHERE ap.name = t.name AND ap.user_id = t.user_id);-- ============================================================================
-- 20. CLIENT BUDGETS
-- ============================================================================
DO $$
DECLARE
    v_cid uuid;
BEGIN
    -- Budget annuali per clienti con contratti annuali
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Tecnolab Srl','Clinica San Luca Srl','Studio Legale Ferretti','Istituto Leonardo da Vinci','Autocarrozzeria Mercurio','Hotel Palazzo della Regina','Supermercato Alimentari & Co','Banca Regionale Etruria') LOOP
        INSERT INTO public.client_budgets (client_id, period, budget_amount, alert_threshold_percent, starts_on, ends_on) VALUES
            (v_cid, 'annual', (SELECT round(recurring_fee * 1.3, -2) FROM public.client_contracts WHERE client_id = v_cid AND status = 'active' ORDER BY start_date DESC LIMIT 1), 80, '2026-01-01', '2026-12-31')
ON CONFLICT DO NOTHING;
    END LOOP;

    -- Budget mensili per clienti con contratti mensili
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Ristorante Da Gigi','Farmacia Dott. Galli') LOOP
        INSERT INTO public.client_budgets (client_id, period, budget_amount, alert_threshold_percent, starts_on, ends_on) VALUES
            (v_cid, 'monthly', (SELECT round(recurring_fee * 1.5, -1) FROM public.client_contracts WHERE client_id = v_cid AND status = 'active' ORDER BY start_date DESC LIMIT 1), 80, '2026-01-01', '2026-12-31')
ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- ============================================================================
-- 21. COST PERIODIC REPORTS
-- ============================================================================
DO $$
DECLARE
    v_cid uuid;
    v_month date;
BEGIN
    FOR v_cid IN SELECT id FROM public.clients WHERE name IN ('Tecnolab Srl','Clinica San Luca Srl','Studio Legale Ferretti','Hotel Palazzo della Regina','Supermercato Alimentari & Co','Banca Regionale Etruria') LOOP
        FOR v_month IN SELECT generate_series('2026-01-01'::date, '2026-05-01'::date, '1 month'::interval)::date LOOP
            INSERT INTO public.cost_periodic_reports (client_id, report_month, status, email_to) VALUES
                (v_cid, v_month, 'generated', (SELECT email FROM public.clients WHERE id = v_cid))
ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- ============================================================================
-- 22. CLIENT CONTRACT ALERTS
-- ============================================================================
DO $$
DECLARE
    v_cid      uuid;
    v_assign   record;
BEGIN
    -- Alert per contratti in scadenza
    FOR v_assign IN
        SELECT a.id, a.client_id
        FROM public.client_bundle_assignments a
        JOIN public.clients c ON c.id = a.client_id
        WHERE c.name IN ('Tecnolab Srl','Clinica San Luca Srl','Banca Regionale Etruria')
    LOOP
        INSERT INTO public.client_contract_alerts (client_id, bundle_assignment_id, days_before, channel, enabled, created_by) VALUES
            (v_assign.client_id, v_assign.id, 30, 'in_app', true, 'a0000001-0000-4000-8000-000000000001'::uuid)
ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- ============================================================================
-- 23. DEVICES (5-10 per client = ~77 devices)
-- ============================================================================
DO $$
DECLARE
    v_cid      uuid;
    v_marco    uuid := 'a0000001-0000-4000-8000-000000000001'::uuid;
    v_date     date := '2025-12-01'::date;
    v_created  timestamptz;
    v_devices  text[];
    v_dev      text;
    max_num    bigint;
BEGIN

-- Disable the asset_tag trigger temporarily to allow manual asset_tag values
DROP TRIGGER IF EXISTS before_device_asset_tag_insert ON public.devices;

-- Tecnolab Srl — 8 dispositivi (produzione + ufficio)
SELECT id INTO v_cid FROM public.clients WHERE name = 'Tecnolab Srl';
v_created := '2025-11-15 09:00:00+01'::timestamptz;
INSERT INTO public.devices (client_id, model, serial, brand, device_type, category, os, os_version, os_architecture,
    cpu_name, cpu_cores, cpu_frequency_ghz, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count,
    screen_size_inches, screen_resolution, screen_type, wifi, bluetooth, ethernet,
    location_office, location_floor, location_desk,
    status, assigned_to, notes,
    purchase_date, purchase_cost, warranty_expiry_date, warranty_provider, warranty_type, warranty_notes,
    ip_address, mac_address, asset_tag, created_by, created_at, updated_at) VALUES
    (v_cid, 'OptiPlex 7080', 'SN-TEC-001', 'Dell', 'Desktop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i7-10700', 8, 4.8, 32, 'DDR4', 3200, 'NVMe SSD', 512, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Sede Milano', 'Piano 1', 'Ufficio tecnico', 'assigned', 'Michele Sartori',
     'Postazione principale ufficio tecnico. Utilizzata per CAD e progettazione.',
     '2025-10-01', 1200.00, '2028-10-01', 'Dell Italia', 'onsite', 'Garanzia estesa 3 anni on-site.',
     '192.168.1.10', '00:1A:2B:3C:4D:01', 'PCR-000001', v_marco, v_created, v_created),

    (v_cid, 'ThinkPad X1 Carbon Gen 11', 'SN-TEC-002', 'Lenovo', 'Laptop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i7-1365U', 10, 5.2, 16, 'LPDDR5', 6000, 'NVMe SSD', 512, 1,
     14.0, '1920x1200', 'IPS', 'Wi-Fi 6E', '5.3', '2.5GbE',
     'Sede Milano', 'Piano 2', 'Direzione', 'assigned', 'Roberto Mancini',
     'Notebook direzionale per RF. Utilizzo in mobilità.',
     '2025-09-01', 1890.00, '2028-09-01', 'Lenovo', 'onsite', 'Garanzia 3 anni con copertura danni accidentali.',
     '192.168.1.11', '00:1A:2B:3C:4D:02', 'PCR-000002', v_marco, v_created, v_created),

    (v_cid, 'Latitude 5540', 'SN-TEC-003', 'Dell', 'Laptop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-1345U', 10, 4.7, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     15.6, '1920x1080', 'IPS', 'Wi-Fi 6E', '5.3', 'GbE',
     'Sede Milano', 'Piano 1', 'Postazione produzione 1', 'assigned', 'Marco Ferrari',
     'PC operatore produzione. Software gestionale officina.',
     '2026-01-15', 1050.00, '2029-01-15', 'Dell Italia', 'onsite', 'Garanzia 3 anni.',
     '192.168.1.12', '00:1A:2B:3C:4D:03', 'PCR-000003', v_marco, v_created, v_created),

    (v_cid, 'Latitude 5540', 'SN-TEC-004', 'Dell', 'Laptop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-1345U', 10, 4.7, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     15.6, '1920x1080', 'IPS', 'Wi-Fi 6E', '5.3', 'GbE',
     'Sede Milano', 'Piano 1', 'Postazione produzione 2', 'assigned', 'Giovanni Sala',
     'PC operatore produzione.',
     '2026-01-15', 1050.00, '2029-01-15', 'Dell Italia', 'onsite', 'Garanzia 3 anni.',
     '192.168.1.13', '00:1A:2B:3C:4D:04', 'PCR-000004', v_marco, v_created, v_created),

    (v_cid, 'PowerEdge T360', 'SN-TEC-SRV1', 'Dell', 'Server Tower', 'server_infra', 'Windows Server 2022', '', '',
     'Intel Xeon E-2488', 8, 5.6, 64, 'ECC DDR5', 4800, 'RAID10 NVMe', 2048, 4,
     NULL, NULL, NULL, NULL, NULL, '2x 10GbE SFP+',
     'Sede Milano', 'Piano -1', 'CED', 'maintenance', '',     'Server ERP e file server. RAID10 NVMe 2TB.',
     NULL, NULL, NULL, NULL, NULL, NULL, '192.168.1.5', '00:1A:2B:3C:4D:10', 'PCR-000005', v_marco, '2025-06-01 09:00:00+01'::timestamptz, '2025-06-01 09:00:00+01'::timestamptz),

    (v_cid, 'DS1522+', 'SN-TEC-NAS1', 'Synology', 'NAS', 'server_infra', 'DSM 7.2', '', '',
     'AMD Ryzen R1600', 2, 2.6, 8, 'DDR4 ECC', 2400, 'HDD SATA', 12000, 4,
     NULL, NULL, NULL, NULL, NULL, 'GbE',
     'Sede Milano', 'Piano -1', 'CED', 'assigned', '',
     'NAS backup con 4x 4TB in SHR. Backup giornaliero server e postazioni.',
     NULL, NULL, NULL, NULL, NULL, NULL, '192.168.1.6', '00:1A:2B:3C:4D:11', 'PCR-000006', v_marco, '2025-03-01 09:00:00+01'::timestamptz, '2025-03-01 09:00:00+01'::timestamptz),

    (v_cid, 'ProLiant MicroServer Gen11', 'SN-TEC-SRV2', 'HP', 'Server Tower', 'server_infra', 'Ubuntu Server 24.04', '', '',
     'AMD EPYC 4124P', 4, 3.8, 32, 'ECC DDR5', 4400, 'NVMe SSD', 1024, 2,
     NULL, NULL, NULL, NULL, NULL, '2x GbE',
     'Sede Milano', 'Piano -1', 'CED', 'available', '',
     'Server secondario: container Docker (monitoring, CI/CD).',
     NULL, NULL, NULL, NULL, NULL, NULL, '192.168.1.7', '00:1A:2B:3C:4D:12', 'PCR-000007', v_marco, '2026-02-01 09:00:00+01'::timestamptz, '2026-02-01 09:00:00+01'::timestamptz),

    (v_cid, 'LaserJet Pro M404dn', 'SN-TEC-PRN1', 'HP', 'Printer', 'printing', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, 'USB 2.0 + GbE',
     NULL, NULL, NULL, 'available', '', 'Stampante laser reparto ufficio. Toner HP 26X.',
     '2025-05-01', 350.00, '2028-05-01', 'HP Italia', 'onsite', '', NULL, NULL, 'PCR-000008', v_marco, v_created, v_created)
ON CONFLICT DO NOTHING;

-- Clinica San Luca — 7 dispositivi
SELECT id INTO v_cid FROM public.clients WHERE name = 'Clinica San Luca Srl';
v_created := '2025-10-10 09:00:00+01'::timestamptz;
INSERT INTO public.devices (client_id, model, serial, brand, device_type, category, os, os_version, os_architecture,
    cpu_name, cpu_cores, cpu_frequency_ghz, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count,
    screen_size_inches, screen_resolution, screen_type, wifi, bluetooth, ethernet,
    location_office, location_floor, location_desk,
    status, assigned_to, notes,
    purchase_date, purchase_cost, warranty_expiry_date, warranty_provider, warranty_type, warranty_notes,
    ip_address, mac_address, asset_tag, created_by, created_at, updated_at) VALUES
    (v_cid, 'OptiPlex Micro 7010', 'SN-CSL-001', 'Dell', 'Desktop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-13500T', 14, 4.6, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Firenze', 'Piano 1', 'Accettazione 1', 'assigned', 'Infermiera turno',
     'Postazione accettazione pazienti. Gestione ricette e appuntamenti.',
     '2025-09-15', 850.00, '2028-09-15', 'Dell Italia', 'onsite', 'Garanzia 3 anni.',
     '192.168.2.10', '00:1A:2B:3C:4E:01', 'PCR-000009', v_marco, v_created, v_created),

    (v_cid, 'OptiPlex Micro 7010', 'SN-CSL-002', 'Dell', 'Desktop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-13500T', 14, 4.6, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Firenze', 'Piano 1', 'Accettazione 2', 'assigned', 'Infermiera turno',
     'Postazione accettazione secondaria.',
     '2025-09-15', 850.00, '2028-09-15', 'Dell Italia', 'onsite', 'Garanzia 3 anni.',
     '192.168.2.11', '00:1A:2B:3C:4E:02', 'PCR-000010', v_marco, v_created, v_created),

    (v_cid, 'ThinkCentre M75q Gen 5', 'SN-CSL-003', 'Lenovo', 'Desktop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'AMD Ryzen 5 7530U', 6, 4.5, 16, 'DDR4', 3200, 'NVMe SSD', 512, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Firenze', 'Piano 2', 'Direzione sanitaria', 'assigned', 'Dott.ssa Maria Bianchi',
     'PC direzione sanitaria. Gestione cartelle cliniche.',
     '2025-08-01', 950.00, '2028-08-01', 'Lenovo', 'onsite', 'Garanzia 3 anni.',
     '192.168.2.12', '00:1A:2B:3C:4E:03', 'PCR-000011', v_marco, v_created, v_created),

    (v_cid, 'ThinkPad L15 Gen 4', 'SN-CSL-004', 'Lenovo', 'Laptop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i5-1345U', 10, 4.7, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     15.6, '1920x1080', 'IPS', 'Wi-Fi 6E', '5.3', 'GbE',
     'Firenze', 'Piano 1', 'Ufficio amministrazione', 'assigned', 'Francesco Neri',
     'PC amministrativo per fatturazione e gestione personale.',
     '2026-01-10', 980.00, '2029-01-10', 'Lenovo', 'onsite', 'Garanzia 3 anni.',
     '192.168.2.13', '00:1A:2B:3C:4E:04', 'PCR-000012', v_marco, '2026-01-10 09:00:00+01'::timestamptz, '2026-01-10 09:00:00+01'::timestamptz),

    (v_cid, 'DS923+', 'SN-CSL-NAS1', 'Synology', 'NAS', 'server_infra', 'DSM 7.2', '', '',
     'AMD Ryzen R1600', 2, 2.6, 4, 'DDR4 ECC', 2400, 'HDD SATA', 16000, 4,
     NULL, NULL, NULL, NULL, NULL, '2x GbE',
     'Firenze', 'Piano -1', 'Locale server', 'assigned', '',
     'NAS backup cartelle cliniche e documenti. RAID5 4x 4TB. Backup off-site crittografato.',
    NULL, NULL, NULL, NULL, NULL, NULL, '192.168.2.5', '00:1A:2B:3C:4E:10', 'PCR-000013', v_marco, v_created, v_created),

    (v_cid, 'Brother QL-820NWBc', 'SN-CSL-PRN1', 'Brother', 'Printer', 'printing', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 'Wi-Fi', '4.2', 'USB + GbE',
     NULL, NULL, NULL, 'available', '', 'Stampante etichette braccialetti pazienti.',
     '2025-06-01', 320.00, '2028-06-01', 'Brother', 'onsite', '', NULL, NULL, 'PCR-000014', v_marco, '2025-06-01 09:00:00+01'::timestamptz, '2025-06-01 09:00:00+01'::timestamptz),

    (v_cid, 'iPad 10th Gen', 'SN-CSL-TAB1', 'Apple', 'Tablet', 'mobile', 'iPadOS 18', '18.3', '',
     'Apple A14 Bionic', 6, 3.0, 4, 'LPDDR4X', 4266, 'NAND Flash', 64, 1,
     10.9, '2360x1640', 'Liquid Retina', 'Wi-Fi 6', '5.3', NULL,
     'Firenze', 'Piano 1', 'Reparto', 'available', '',
     'Tablet per consultazione cartelle cliniche in reparto.',
     '2025-11-01', 589.00, '2028-11-01', 'Apple Italia', 'standard', 'AppleCare+ 3 anni.',
     '192.168.2.20', '00:1A:2B:3C:4E:20', 'PCR-000015', v_marco, v_created, v_created)
ON CONFLICT DO NOTHING;

-- Studio Legale Ferretti — 5 dispositivi
SELECT id INTO v_cid FROM public.clients WHERE name = 'Studio Legale Ferretti';
v_created := '2025-09-01 09:00:00+01'::timestamptz;
INSERT INTO public.devices (client_id, model, serial, brand, device_type, category, os, os_version, os_architecture,
    cpu_name, cpu_cores, cpu_frequency_ghz, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count,
    screen_size_inches, screen_resolution, screen_type, wifi, bluetooth, ethernet,
    location_office, location_floor, location_desk,
    status, assigned_to, notes,
    purchase_date, purchase_cost, warranty_expiry_date, warranty_provider, warranty_type, warranty_notes,
    ip_address, mac_address, asset_tag, created_by, created_at, updated_at) VALUES
    (v_cid, 'Surface Laptop 5', 'SN-FER-001', 'Microsoft', 'Laptop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i7-1265U', 10, 4.8, 16, 'LPDDR5X', 6000, 'NVMe SSD', 512, 1,
     15.0, '2496x1664', 'PixelSense', 'Wi-Fi 6E', '5.3', NULL,
     'Torino', 'Piano 3', 'Studio Avv. Ferretti', 'assigned', 'Avv. Carlo Ferretti',
     'PC principale del socio fondatore. Dati sensibili — crittografia BitLocker attiva.',
     '2025-08-01', 1999.00, '2028-08-01', 'Microsoft Italia', 'onsite', 'Garanzia 3 anni + Microsoft Complete.',
     '192.168.3.10', '00:1A:2B:3C:4F:01', 'PCR-000016', v_marco, v_created, v_created),

    (v_cid, 'Surface Laptop 5', 'SN-FER-002', 'Microsoft', 'Laptop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-1245U', 10, 4.4, 8, 'LPDDR5X', 6000, 'NVMe SSD', 256, 1,
     13.5, '2256x1504', 'PixelSense', 'Wi-Fi 6E', '5.3', NULL,
     'Torino', 'Piano 3', 'Segreteria', 'assigned', 'Simonetta Gallo',
     'PC segreteria: gestione appuntamenti, fatturazione, corrispondenza.',
     '2025-08-01', 1299.00, '2028-08-01', 'Microsoft Italia', 'onsite', 'Garanzia 3 anni.',
     '192.168.3.11', '00:1A:2B:3C:4F:02', 'PCR-000017', v_marco, v_created, v_created),

    (v_cid, 'EcoTank ET-5850', 'SN-FER-PRN1', 'Epson', 'Printer', 'printing', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 'Wi-Fi', '4.2', 'USB + GbE',
     NULL, NULL, NULL, 'available', '',
     'Stampante multifunzione A3 per ufficio. Serbatoio inkjet.',
     '2025-07-01', 580.00, '2028-07-01', 'Epson Italia', 'onsite', 'Garanzia 3 anni con sostituzione.',
     '192.168.3.20', '00:1A:2B:3C:4F:10', 'PCR-000018', v_marco, '2025-07-01 09:00:00+01'::timestamptz, '2025-07-01 09:00:00+01'::timestamptz),

    (v_cid, 'ThinkPad X13 Yoga Gen 4', 'SN-FER-003', 'Lenovo', 'Laptop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i5-1345U', 10, 4.7, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     13.3, '1920x1200', 'Touch IPS', 'Wi-Fi 6E', '5.3', 'GbE',
     'Torino', 'Piano 3', 'Associato 1', 'assigned', 'Avv. Marco Bianchi',
     'PC associato studio. Convertibile per uso in aula.',
     '2026-02-01', 1450.00, '2029-02-01', 'Lenovo', 'onsite', 'Garanzia 3 anni.',
     '192.168.3.12', '00:1A:2B:3C:4F:03', 'PCR-000019', v_marco, '2026-02-01 09:00:00+01'::timestamptz, '2026-02-01 09:00:00+01'::timestamptz),

    (v_cid, 'DS220+', 'SN-FER-NAS1', 'Synology', 'NAS', 'server_infra', 'DSM 7.2', '', '',
     'Intel Celeron J4025', 2, 2.9, 2, 'DDR4', 2400, 'HDD SATA', 4000, 2,
     NULL, NULL, NULL, NULL, NULL, 'GbE',
     'Torino', 'Piano -1', 'Archivio', 'assigned', '',
     'NAS backup con 2x 2TB RAID1. Backup crittografato giornaliero.',
    NULL, NULL, NULL, NULL, NULL, NULL, '192.168.3.5', '00:1A:2B:3C:4F:11', 'PCR-000020', v_marco, v_created, v_created)
ON CONFLICT DO NOTHING;

-- Istituto Leonardo da Vinci — 9 dispositivi
SELECT id INTO v_cid FROM public.clients WHERE name = 'Istituto Leonardo da Vinci';
v_created := '2025-08-20 09:00:00+01'::timestamptz;
INSERT INTO public.devices (client_id, model, serial, brand, device_type, category, os, os_version, os_architecture,
    cpu_name, cpu_cores, cpu_frequency_ghz, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count,
    screen_size_inches, screen_resolution, screen_type, wifi, bluetooth, ethernet,
    location_office, location_floor, location_desk,
    status, assigned_to, notes,
    purchase_date, purchase_cost, warranty_expiry_date, warranty_provider, warranty_type, warranty_notes,
    ip_address, mac_address, asset_tag, created_by, created_at, updated_at) VALUES
    (v_cid, 'OptiPlex 3040 Micro', 'SN-DAV-001', 'Dell', 'Desktop', 'endpoint', 'Ubuntu 24.04', '24.04', 'x64',
     'Intel Core i5-6500T', 4, 3.2, 8, 'DDR4', 2133, 'SSD SATA', 240, 1,
     NULL, NULL, NULL, 'Wi-Fi 5', '4.2', 'GbE',
     'Brescia', 'Piano 1', 'Laboratorio 1 - Postazione 1', 'assigned', 'Studente',
     'Laboratorio informatica 1. 15 postazioni identiche per didattica.',
     '2023-09-01', 450.00, '2026-09-01', 'Dell', 'standard', NULL,
     '192.168.4.10', '00:1A:2B:3C:50:01', 'PCR-000021', v_marco, v_created, v_created),

    (v_cid, 'OptiPlex 3040 Micro', 'SN-DAV-002', 'Dell', 'Desktop', 'endpoint', 'Ubuntu 24.04', '24.04', 'x64',
     'Intel Core i5-6500T', 4, 3.2, 8, 'DDR4', 2133, 'SSD SATA', 240, 1,
     NULL, NULL, NULL, 'Wi-Fi 5', '4.2', 'GbE',
     'Brescia', 'Piano 1', 'Laboratorio 1 - Postazione 2', 'assigned', 'Studente',
     'Laboratorio informatica 1.',
     '2023-09-01', 450.00, '2026-09-01', 'Dell', 'standard', NULL,
     '192.168.4.11', '00:1A:2B:3C:50:02', 'PCR-000022', v_marco, v_created, v_created),

    (v_cid, 'OptiPlex 3040 Micro', 'SN-DAV-003', 'Dell', 'Desktop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-6500T', 4, 3.2, 8, 'DDR4', 2133, 'SSD SATA', 240, 1,
     NULL, NULL, NULL, 'Wi-Fi 5', '4.2', 'GbE',
     'Brescia', 'Piano 1', 'Ufficio docenti', 'assigned', 'Luca Conti',
     'PC docente di informatica. Gestione laboratori.',
     '2023-09-01', 550.00, '2026-09-01', 'Dell', 'standard', NULL,
     '192.168.4.20', '00:1A:2B:3C:50:03', 'PCR-000023', v_marco, v_created, v_created),

    (v_cid, 'ThinkPad E16 Gen 1', 'SN-DAV-004', 'Lenovo', 'Laptop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i5-1345U', 10, 4.7, 16, 'DDR4', 3200, 'NVMe SSD', 512, 1,
     16.0, '1920x1200', 'IPS', 'Wi-Fi 6E', '5.3', 'GbE',
     'Brescia', 'Piano 2', 'Dirigenza', 'assigned', 'Prof.ssa Anna Verdi',
     'PC portatile dirigenza scolastica.',
     '2025-09-01', 1100.00, '2028-09-01', 'Lenovo', 'onsite', 'Garanzia 3 anni.',
     '192.168.4.30', '00:1A:2B:3C:50:04', 'PCR-000024', v_marco, v_created, v_created),

    (v_cid, 'LaserJet M404dn', 'SN-DAV-PRN1', 'HP', 'Printer', 'printing', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, 'USB + GbE',
     NULL, NULL, NULL, 'maintenance', '', 'Stampante laser sala docenti. Toner HP 26X.',
     '2024-01-01', 300.00, '2027-01-01', 'HP', 'onsite', '', NULL, NULL, 'PCR-000025', v_marco, v_created, v_created),

    (v_cid, 'iPad 9th Gen', 'SN-DAV-TAB1', 'Apple', 'Tablet', 'mobile', 'iPadOS 18', '18.3', '',
     'Apple A13 Bionic', 6, 2.7, 3, 'LPDDR4X', 4266, 'NAND Flash', 64, 1,
     10.2, '2160x1620', 'Retina', 'Wi-Fi 5', '4.2', NULL,
     'Brescia', 'Piano 2', 'Segreteria', 'available', '',
     'Tablet per registro elettronico e comunicazioni.',
     '2024-09-01', 429.00, '2027-09-01', 'Apple Italia', 'standard', 'AppleCare+',
     '192.168.4.40', '00:1A:2B:3C:50:05', 'PCR-000026', v_marco, v_created, v_created)
ON CONFLICT DO NOTHING;

-- Ristorante Da Gigi — 5 dispositivi
SELECT id INTO v_cid FROM public.clients WHERE name = 'Ristorante Da Gigi';
v_created := '2025-11-01 09:00:00+01'::timestamptz;
INSERT INTO public.devices (client_id, model, serial, brand, device_type, category, os, os_version, os_architecture,
    cpu_name, cpu_cores, cpu_frequency_ghz, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count,
    screen_size_inches, screen_resolution, screen_type, wifi, bluetooth, ethernet,
    location_office, location_floor, location_desk,
    status, assigned_to, notes,
    purchase_date, purchase_cost, warranty_expiry_date, warranty_provider, warranty_type, warranty_notes,
    ip_address, mac_address, asset_tag, created_by, created_at, updated_at) VALUES
    (v_cid, 'ThinkCentre Neo 50s', 'SN-GIG-001', 'Lenovo', 'Desktop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i3-13100', 4, 4.5, 8, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Verona', 'Piano 1', 'Cassa', 'assigned', 'Sofia Romano',
     'PC cassa con gestionale ristorante e POS.',
     '2025-10-01', 650.00, '2028-10-01', 'Lenovo', 'onsite', NULL,
     '192.168.5.10', '00:1A:2B:3C:51:01', 'PCR-000027', v_marco, v_created, v_created),

    (v_cid, 'ThinkCentre Neo 50s', 'SN-GIG-002', 'Lenovo', 'Desktop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i3-13100', 4, 4.5, 8, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Verona', 'Piano 1', 'Ufficio', 'assigned', 'Gigi Marchetti',
     'PC ufficio: gestione fornitori, contabilità, prenotazioni.',
     '2025-10-01', 650.00, '2028-10-01', 'Lenovo', 'onsite', NULL,
     '192.168.5.11', '00:1A:2B:3C:51:02', 'PCR-000028', v_marco, v_created, v_created),

    (v_cid, 'Galaxy Tab A8', 'SN-GIG-TAB1', 'Samsung', 'Tablet', 'mobile', 'Android 14', '14', '',
     'Unisoc T618', 8, 2.0, 4, 'LPDDR4X', 2133, 'NAND Flash', 64, 1,
     10.5, '1920x1200', 'TFT', 'Wi-Fi 5', '5.0', NULL,
     'Verona', 'Piano 1', 'Sala - Menu digitale', 'available', '',
     'Tablet menù digitale e prenotazioni.',
     '2025-12-01', 280.00, '2028-12-01', 'Samsung Italia', 'standard', NULL,
     '192.168.5.20', '00:1A:2B:3C:51:10', 'PCR-000029', v_marco, v_created, v_created),

    (v_cid, 'LaserJet Pro M404dn', 'SN-GIG-PRN1', 'HP', 'Printer', 'printing', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 'Wi-Fi', '4.2', 'USB + GbE',
     NULL, NULL, NULL, 'available', '',
     'Stampante ufficio e sala per menu e documenti.',
     '2025-09-01', 280.00, '2028-09-01', 'HP Italia', 'onsite', NULL, NULL, NULL, 'PCR-000030', v_marco, v_created, v_created),

    (v_cid, 'TallyDascom T-2260', 'SN-GIG-POS1', 'Tally', 'POS Terminal', 'peripheral', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, 'USB',
     NULL, NULL, NULL, 'available', '',
     'Stampante termica scontrini fiscale per reparto cassa.',
     '2025-10-01', 350.00, '2028-10-01', 'TallyDascom', 'standard', NULL, NULL, NULL, 'PCR-000031', v_marco, v_created, v_created)
ON CONFLICT DO NOTHING;

-- Farmacia Dott. Galli — 6 dispositivi
SELECT id INTO v_cid FROM public.clients WHERE name = 'Farmacia Dott. Galli';
v_created := '2025-10-15 09:00:00+01'::timestamptz;
INSERT INTO public.devices (client_id, model, serial, brand, device_type, category, os, os_version, os_architecture,
    cpu_name, cpu_cores, cpu_frequency_ghz, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count,
    screen_size_inches, screen_resolution, screen_type, wifi, bluetooth, ethernet,
    location_office, location_floor, location_desk,
    status, assigned_to, notes,
    purchase_date, purchase_cost, warranty_expiry_date, warranty_provider, warranty_type, warranty_notes,
    ip_address, mac_address, asset_tag, created_by, created_at, updated_at) VALUES
    (v_cid, 'ThinkCentre M75q Gen 5', 'SN-FAR-001', 'Lenovo', 'Desktop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'AMD Ryzen 5 7530U', 6, 4.5, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Bologna', 'Piano 1', 'Banco vendita 1', 'assigned', 'Farmacista turno',
     'Postazione banco vendita: gestionale farmacia + terminale ricetta.',
     '2025-09-01', 780.00, '2028-09-01', 'Lenovo', 'onsite', 'Garanzia 3 anni.',
     '192.168.6.10', '00:1A:2B:3C:52:01', 'PCR-000032', v_marco, v_created, v_created),

    (v_cid, 'ThinkCentre M75q Gen 5', 'SN-FAR-002', 'Lenovo', 'Desktop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'AMD Ryzen 5 7530U', 6, 4.5, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Bologna', 'Piano 1', 'Banco vendita 2', 'assigned', 'Farmacista turno',
     'Postazione banco secondaria.',
     '2025-09-01', 780.00, '2028-09-01', 'Lenovo', 'onsite', 'Garanzia 3 anni.',
     '192.168.6.11', '00:1A:2B:3C:52:02', 'PCR-000033', v_marco, v_created, v_created),

    (v_cid, 'ThinkCentre M75q Gen 5', 'SN-FAR-003', 'Lenovo', 'Desktop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'AMD Ryzen 5 7530U', 6, 4.5, 16, 'DDR4', 3200, 'NVMe SSD', 512, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Bologna', 'Piano 1', 'Direzione', 'assigned', 'Dott. Marco Galli',
     'PC direzione: gestionale fornitori, magazzino, amministrazione.',
     '2025-08-01', 850.00, '2028-08-01', 'Lenovo', 'onsite', 'Garanzia 3 anni.',
     '192.168.6.12', '00:1A:2B:3C:52:03', 'PCR-000034', v_marco, v_created, v_created),

    (v_cid, 'LaserJet Pro M304a', 'SN-FAR-PRN1', 'HP', 'Printer', 'printing', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 'Wi-Fi', '4.2', 'USB',
     NULL, NULL, NULL, 'available', '',
     'Stampante laser per etichette farmaci e documenti.',
     '2025-07-01', 220.00, '2028-07-01', 'HP Italia', 'onsite', NULL, NULL, NULL, 'PCR-000035', v_marco, '2025-07-01 09:00:00+01'::timestamptz, '2025-07-01 09:00:00+01'::timestamptz),

    (v_cid, 'DS120j', 'SN-FAR-NAS1', 'Synology', 'NAS', 'server_infra', 'DSM 7.2', '', '',
     'Realtek RTD1296', 4, 1.5, 1, 'DDR4', 2400, 'HDD SATA', 2000, 2,
     NULL, NULL, NULL, NULL, NULL, 'GbE',
     'Bologna', 'Piano -1', 'Retro', 'assigned', '',
     'NAS backup gestionali e dati amministrativi. RAID1 2TB.',
     '2025-03-01', 300.00, '2028-03-01', 'Synology', 'standard', NULL,
     '192.168.6.5', '00:1A:2B:3C:52:10', 'PCR-000036', v_marco, '2025-03-01 09:00:00+01'::timestamptz, '2025-03-01 09:00:00+01'::timestamptz),

    (v_cid, 'Tomax M50', 'SN-FAR-TER1', 'Dell', 'Desktop', 'endpoint', 'Windows 11 IoT', '24H2', 'x64',
     'Intel Celeron N5095', 4, 2.9, 4, 'DDR4', 2933, 'NVMe SSD', 128, 1,
     15.0, '1024x768', 'Touch', 'Wi-Fi 5', '4.2', 'GbE',
     'Bologna', 'Piano 1', 'Angolo ricetta', 'assigned', 'Chiara Rinaldi',
     'Terminale ricetta elettronica con lettore TS.',
     '2026-01-15', 1200.00, '2029-01-15', 'Tomax Italia', 'onsite', 'Garanzia 3 anni.',
     '192.168.6.15', '00:1A:2B:3C:52:15', 'PCR-000037', v_marco, '2026-01-15 09:00:00+01'::timestamptz, '2026-01-15 09:00:00+01'::timestamptz)
ON CONFLICT DO NOTHING;

-- Autocarrozzeria Mercurio — 5 dispositivi
SELECT id INTO v_cid FROM public.clients WHERE name = 'Autocarrozzeria Mercurio';
v_created := '2025-12-01 09:00:00+01'::timestamptz;
INSERT INTO public.devices (client_id, model, serial, brand, device_type, category, os, os_version, os_architecture,
    cpu_name, cpu_cores, cpu_frequency_ghz, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count,
    screen_size_inches, screen_resolution, screen_type, wifi, bluetooth, ethernet,
    location_office, location_floor, location_desk,
    status, assigned_to, notes,
    purchase_date, purchase_cost, warranty_expiry_date, warranty_provider, warranty_type, warranty_notes,
    ip_address, mac_address, asset_tag, created_by, created_at, updated_at) VALUES
    (v_cid, 'ThinkCentre M70q Gen 4', 'SN-MER-001', 'Lenovo', 'Desktop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i5-13500T', 14, 4.6, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Padova', 'Piano 1', 'Ufficio', 'assigned', 'Stefano Bianco',
     'PC ufficio: fatturazione, gestione clienti, contabilità.',
     '2025-11-15', 720.00, '2028-11-15', 'Lenovo', 'onsite', NULL,
     '192.168.7.10', '00:1A:2B:3C:53:01', 'PCR-000038', v_marco, v_created, v_created),

    (v_cid, 'Galaxy Tab Active5', 'SN-MER-TAB1', 'Samsung', 'Tablet', 'mobile', 'Android 14', '14', '',
     'Exynos 1380', 8, 2.4, 6, 'LPDDR5', 3200, 'NAND Flash', 128, 1,
     8.0, '1920x1200', 'TFT', 'Wi-Fi 6', '5.3', NULL,
     'Padova', 'Piano 1', 'Officina', 'available', '',
     'Tablet rugged per officina: consultazione schede intervento, foto danni.',
     '2026-01-10', 620.00, '2029-01-10', 'Samsung Italia', 'standard', 'Garanzia 3 anni.',
     '192.168.7.20', '00:1A:2B:3C:53:10', 'PCR-000039', v_marco, '2026-01-10 09:00:00+01'::timestamptz, '2026-01-10 09:00:00+01'::timestamptz),

    (v_cid, 'EcoTank L15150', 'SN-MER-PRN1', 'Epson', 'Printer', 'printing', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 'Wi-Fi', '4.2', 'USB + GbE',
     NULL, NULL, NULL, 'available', '',
     'Stampante multifunzione A3 per ufficio e schede intervento.',
     '2025-10-01', 480.00, '2028-10-01', 'Epson Italia', 'onsite', NULL, NULL, NULL, 'PCR-000040', v_marco, v_created, v_created),

    (v_cid, 'ThinkPad L15 Gen 4', 'SN-MER-002', 'Lenovo', 'Laptop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i5-1345U', 10, 4.7, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     15.6, '1920x1080', 'IPS', 'Wi-Fi 6E', '5.3', 'GbE',
     'Padova', 'Piano 1', 'Tecnico', 'assigned', 'Alessandro Fabbri',
     'PC tecnico officina: gestione ricambi, anagrafica veicoli.',
     '2026-02-15', 950.00, '2029-02-15', 'Lenovo', 'onsite', 'Garanzia 3 anni.',
     '192.168.7.11', '00:1A:2B:3C:53:02', 'PCR-000041', v_marco, '2026-02-15 09:00:00+01'::timestamptz, '2026-02-15 09:00:00+01'::timestamptz),

    (v_cid, 'UniFi U6 Pro', 'SN-MER-AP1', 'Ubiquiti', 'Access Point', 'network', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 'Wi-Fi 6', NULL, '2.5GbE PoE+',
     NULL, NULL, NULL, 'available', '',
     'Access Point WiFi 6 per copertura officina e ufficio.',
     '2025-12-01', 159.00, '2028-12-01', 'Ubiquiti EU', 'onsite', NULL, '192.168.7.254', '00:1A:2B:3C:53:FF', 'PCR-000042', v_marco, v_created, v_created)
ON CONFLICT DO NOTHING;

-- Hotel Palazzo della Regina — 9 dispositivi
SELECT id INTO v_cid FROM public.clients WHERE name = 'Hotel Palazzo della Regina';
v_created := '2025-10-01 09:00:00+01'::timestamptz;
INSERT INTO public.devices (client_id, model, serial, brand, device_type, category, os, os_version, os_architecture,
    cpu_name, cpu_cores, cpu_frequency_ghz, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count,
    screen_size_inches, screen_resolution, screen_type, wifi, bluetooth, ethernet,
    location_office, location_floor, location_desk,
    status, assigned_to, notes,
    purchase_date, purchase_cost, warranty_expiry_date, warranty_provider, warranty_type, warranty_notes,
    ip_address, mac_address, asset_tag, created_by, created_at, updated_at) VALUES
    (v_cid, 'ThinkCentre M70q Gen 4', 'SN-HOT-001', 'Lenovo', 'Desktop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i5-13500T', 14, 4.6, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Rimini', 'Piano Terra', 'Reception 1', 'assigned', 'Addetto reception',
     'Postazione check-in/out, booking engine.',
     '2025-09-01', 720.00, '2028-09-01', 'Lenovo', 'onsite', 'Garanzia 3 anni.',
     '192.168.8.10', '00:1A:2B:3C:54:01', 'PCR-000043', v_marco, v_created, v_created),

    (v_cid, 'ThinkCentre M70q Gen 4', 'SN-HOT-002', 'Lenovo', 'Desktop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i5-13500T', 14, 4.6, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Rimini', 'Piano Terra', 'Reception 2', 'assigned', 'Addetto reception',
     'Postazione reception secondaria.',
     '2025-09-01', 720.00, '2028-09-01', 'Lenovo', 'onsite', 'Garanzia 3 anni.',
     '192.168.8.11', '00:1A:2B:3C:54:02', 'PCR-000044', v_marco, v_created, v_created),

    (v_cid, 'ThinkCentre M70q Gen 4', 'SN-HOT-003', 'Lenovo', 'Desktop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i5-13500T', 14, 4.6, 16, 'DDR4', 3200, 'NVMe SSD', 512, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Rimini', 'Piano 1', 'Amministrazione', 'assigned', 'Paolo Ferri',
     'PC amministrazione: contabilità, fatture, contratti.',
     '2025-09-01', 800.00, '2028-09-01', 'Lenovo', 'onsite', 'Garanzia 3 anni.',
     '192.168.8.12', '00:1A:2B:3C:54:03', 'PCR-000045', v_marco, v_created, v_created),

    (v_cid, 'ThinkPad X13 Yoga Gen 4', 'SN-HOT-004', 'Lenovo', 'Laptop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i7-1365U', 10, 5.2, 16, 'LPDDR5', 6000, 'NVMe SSD', 512, 1,
     13.3, '1920x1200', 'Touch IPS', 'Wi-Fi 6E', '5.3', 'GbE',
     'Rimini', 'Piano 1', 'Direzione', 'assigned', 'Dott.ssa Lucia Contarini',
     'PC direzionale. Utilizzo anche in mobilità per fiere e meeting.',
     '2025-08-15', 1650.00, '2028-08-15', 'Lenovo', 'onsite', 'Garanzia 3 anni premium.',
     '192.168.8.20', '00:1A:2B:3C:54:10', 'PCR-000046', v_marco, v_created, v_created),

    (v_cid, 'PowerEdge T160', 'SN-HOT-SRV1', 'Dell', 'Server Tower', 'server_infra', 'Windows Server 2025', '', '',
     'Intel Xeon E-2414', 4, 3.4, 32, 'ECC DDR5', 4800, 'RAID1 SSD', 960, 2,
     NULL, NULL, NULL, NULL, NULL, '2x GbE',
     'Rimini', 'Piano -1', 'Locale server', 'assigned', '',
     'Server prenotazioni, gestionale alberghiero, AD. RAID1 SSD + backup NAS.',
     '2025-07-01', 2800.00, '2028-07-01', 'Dell Italia', 'onsite', 'Garanzia 3 anni premium 4h.',
     '192.168.8.5', '00:1A:2B:3C:54:50', 'PCR-000047', v_marco, '2025-07-01 09:00:00+01'::timestamptz, '2025-07-01 09:00:00+01'::timestamptz),

    (v_cid, 'DS224+', 'SN-HOT-NAS1', 'Synology', 'NAS', 'server_infra', 'DSM 7.2', '', '',
     'Intel Celeron J4125', 4, 2.7, 2, 'DDR4', 2400, 'HDD SATA', 8000, 2,
     NULL, NULL, NULL, NULL, NULL, '2x GbE',
     'Rimini', 'Piano -1', 'Locale server', 'assigned', '',
     'NAS backup server e postazioni. RAID1 2x 4TB.',
     '2025-07-01', 450.00, '2028-07-01', 'Synology', 'standard', NULL,
     '192.168.8.6', '00:1A:2B:3C:54:51', 'PCR-000048', v_marco, '2025-07-01 09:00:00+01'::timestamptz, '2025-07-01 09:00:00+01'::timestamptz),

    (v_cid, 'UniFi U6 LR', 'SN-HOT-AP1', 'Ubiquiti', 'Access Point', 'network', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 'Wi-Fi 6', NULL, 'GbE PoE',
     'Rimini', 'Piano Terra', 'Hall', 'available', '',
     'AP WiFi 6 copertura hall e reception.',
     '2025-06-01', 129.00, '2028-06-01', 'Ubiquiti EU', 'onsite', NULL, '192.168.8.250', '00:1A:2B:3C:54:F0', 'PCR-000049', v_marco, '2025-06-01 09:00:00+01'::timestamptz, '2025-06-01 09:00:00+01'::timestamptz),

    (v_cid, 'USW-24-PoE', 'SN-HOT-SW1', 'Ubiquiti', 'Switch PoE', 'network', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, '24x GbE PoE+',
     'Rimini', 'Piano -1', 'Locale server', 'available', '',
     'Switch PoE core per rete hotel. 24 porte PoE+ con SFP uplink.',
     '2025-06-01', 399.00, '2028-06-01', 'Ubiquiti EU', 'onsite', NULL, '192.168.8.253', '00:1A:2B:3C:54:FC', 'PCR-000050', v_marco, '2025-06-01 09:00:00+01'::timestamptz, '2025-06-01 09:00:00+01'::timestamptz),

    (v_cid, 'Express S50', 'SN-HOT-PRN1', 'Zebra', 'Printer', 'printing', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 'Wi-Fi', '4.2', 'USB',
     NULL, NULL, NULL, 'available', '',
     'Stampante badge ospiti WiFi e card magnetiche.',
     '2025-05-15', 280.00, '2028-05-15', 'Zebra Italy', 'onsite', NULL, NULL, NULL, 'PCR-000051', v_marco, '2025-05-15 09:00:00+01'::timestamptz, '2025-05-15 09:00:00+01'::timestamptz)
ON CONFLICT DO NOTHING;

-- Supermercato Alimentari & Co — 8 dispositivi
SELECT id INTO v_cid FROM public.clients WHERE name = 'Supermercato Alimentari & Co';
v_created := '2025-11-01 09:00:00+01'::timestamptz;
INSERT INTO public.devices (client_id, model, serial, brand, device_type, category, os, os_version, os_architecture,
    cpu_name, cpu_cores, cpu_frequency_ghz, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count,
    screen_size_inches, screen_resolution, screen_type, wifi, bluetooth, ethernet,
    location_office, location_floor, location_desk,
    status, assigned_to, notes,
    purchase_date, purchase_cost, warranty_expiry_date, warranty_provider, warranty_type, warranty_notes,
    ip_address, mac_address, asset_tag, created_by, created_at, updated_at) VALUES
    (v_cid, 'OptiPlex 7010', 'SN-ALI-001', 'Dell', 'Desktop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-13500', 14, 4.8, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Modena', 'Piano 1', 'Ufficio', 'assigned', 'Giuseppe Fontana',
     'PC ufficio: gestione personale, fornitori, contabilità.',
     '2025-10-01', 750.00, '2028-10-01', 'Dell Italia', 'onsite', NULL,
     '192.168.9.10', '00:1A:2B:3C:55:01', 'PCR-000052', v_marco, v_created, v_created),

    (v_cid, 'OptiPlex 7010', 'SN-ALI-002', 'Dell', 'Desktop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-13500', 14, 4.8, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, 'Wi-Fi 6', '5.3', 'GbE',
     'Modena', 'Piano 1', 'Amministrazione', 'assigned', 'Maria Costa',
     'PC amministrazione: fatturazione, pagamenti, fornitori.',
     '2025-10-01', 750.00, '2028-10-01', 'Dell Italia', 'onsite', NULL,
     '192.168.9.11', '00:1A:2B:3C:55:02', 'PCR-000053', v_marco, v_created, v_created),

    (v_cid, 'PowerEdge T160', 'SN-ALI-SRV1', 'Dell', 'Server Tower', 'server_infra', 'Windows Server 2025', '', '',
     'Intel Xeon E-2414', 4, 3.4, 32, 'ECC DDR5', 4800, 'RAID1 SSD', 960, 2,
     NULL, NULL, NULL, NULL, NULL, '2x GbE',
     'Modena', 'Piano -1', 'Magazzino server', 'assigned', '',
     'Server gestionale punto vendita. Gestisce POS, magazzino, prezzi.',
     '2025-07-01', 2500.00, '2028-07-01', 'Dell Italia', 'onsite', 'Garanzia 3 anni.',
     '192.168.9.5', '00:1A:2B:3C:55:50', 'PCR-000054', v_marco, '2025-07-01 09:00:00+01'::timestamptz, '2025-07-01 09:00:00+01'::timestamptz),

    (v_cid, 'DS224+', 'SN-ALI-NAS1', 'Synology', 'NAS', 'server_infra', 'DSM 7.2', '', '',
     'Intel Celeron J4125', 4, 2.7, 2, 'DDR4', 2400, 'HDD SATA', 8000, 2,
     NULL, NULL, NULL, NULL, NULL, '2x GbE',
     'Modena', 'Piano -1', 'Magazzino server', 'assigned', '',
     'NAS backup server e dati. RAID1 2x 4TB.',
     '2025-07-01', 420.00, '2028-07-01', 'Synology', 'standard', NULL,
     '192.168.9.6', '00:1A:2B:3C:55:51', 'PCR-000055', v_marco, '2025-07-01 09:00:00+01'::timestamptz, '2025-07-01 09:00:00+01'::timestamptz),

    (v_cid, 'Epson TM-T88VII', 'SN-ALI-POS1', 'Epson', 'POS Terminal', 'peripheral', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, 'USB + GbE',
     NULL, NULL, NULL, 'available', '',
     'Stampante termica scontrino cassa 1.',
     '2025-08-01', 320.00, '2028-08-01', 'Epson Italia', 'onsite', NULL, NULL, NULL, 'PCR-000056', v_marco, v_created, v_created),

    (v_cid, 'Epson TM-T88VII', 'SN-ALI-POS2', 'Epson', 'POS Terminal', 'peripheral', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, 'USB + GbE',
     NULL, NULL, NULL, 'available', '',
     'Stampante termica scontrino cassa 2.',
     '2025-08-01', 320.00, '2028-08-01', 'Epson Italia', 'onsite', NULL, NULL, NULL, 'PCR-000057', v_marco, v_created, v_created),

    (v_cid, 'EP803', 'SN-ALI-BIL1', 'Dibal', 'Scale', 'peripheral', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, 'USB',
     NULL, NULL, NULL, 'available', '',
     'Bilancia pesatura reparto ortofrutta con stampante etichette.',
     '2023-06-01', 1200.00, '2026-06-01', 'Dibal Italia', 'onsite', 'Garanzia 3 anni.',
     '192.168.9.30', '00:1A:2B:3C:55:60', 'PCR-000058', v_marco, v_created, v_created),

    (v_cid, 'LaserJet Pro M305d', 'SN-ALI-PRN1', 'HP', 'Printer', 'printing', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 'Wi-Fi', '4.2', 'USB + GbE',
     NULL, NULL, NULL, 'available', '',
     'Stampante laser ufficio amministrazione.',
     '2025-09-01', 250.00, '2028-09-01', 'HP Italia', 'onsite', NULL, NULL, NULL, 'PCR-000059', v_marco, v_created, v_created)
ON CONFLICT DO NOTHING;

-- Centro Estetico Beauty Lab — 5 dispositivi
SELECT id INTO v_cid FROM public.clients WHERE name = 'Centro Estetico Beauty Lab';
v_created := '2025-12-01 09:00:00+01'::timestamptz;
INSERT INTO public.devices (client_id, model, serial, brand, device_type, category, os, os_version, os_architecture,
    cpu_name, cpu_cores, cpu_frequency_ghz, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count,
    screen_size_inches, screen_resolution, screen_type, wifi, bluetooth, ethernet,
    location_office, location_floor, location_desk,
    status, assigned_to, notes,
    purchase_date, purchase_cost, warranty_expiry_date, warranty_provider, warranty_type, warranty_notes,
    ip_address, mac_address, asset_tag, created_by, created_at, updated_at) VALUES
    (v_cid, 'iMac 24" M3', 'SN-BEA-001', 'Apple', 'Desktop', 'endpoint', 'macOS Sequoia', '15.3', '',
     'Apple M3', 8, 4.1, 8, 'Unified', 6400, 'NVMe SSD', 256, 1,
     24.0, '4480x2520', 'Retina 4.5K', 'Wi-Fi 6E', '5.3', 'GbE',
     'Bergamo', 'Piano 1', 'Reception', 'assigned', 'Elena Grecchi',
     'iMac reception: gestione prenotazioni, CRM, cassa.',
     '2025-11-01', 1599.00, '2028-11-01', 'Apple Italia', 'standard', 'AppleCare+ 3 anni.',
     '192.168.10.10', '00:1A:2B:3C:56:01', 'PCR-000060', v_marco, v_created, v_created),

    (v_cid, 'MacBook Air 15" M3', 'SN-BEA-002', 'Apple', 'Laptop', 'endpoint', 'macOS Sequoia', '15.3', '',
     'Apple M3', 8, 4.1, 8, 'Unified', 6400, 'NVMe SSD', 256, 1,
     15.3, '2880x1864', 'Liquid Retina', 'Wi-Fi 6E', '5.3', NULL,
     'Bergamo', 'Piano 1', 'Titolare', 'assigned', 'Elena Grecchi',
     'MacBook personale della titolare. Utilizzo anche da remoto.',
     '2025-11-01', 1499.00, '2028-11-01', 'Apple Italia', 'standard', 'AppleCare+ 3 anni.',
     '192.168.10.11', '00:1A:2B:3C:56:02', 'PCR-000061', v_marco, v_created, v_created),

    (v_cid, 'iPad Air M2', 'SN-BEA-TAB1', 'Apple', 'Tablet', 'mobile', 'iPadOS 18', '18.3', '',
     'Apple M2', 8, 3.5, 8, 'Unified', 6400, 'NAND Flash', 128, 1,
     11.0, '2360x1640', 'Liquid Retina', 'Wi-Fi 6E', '5.3', NULL,
     'Bergamo', 'Piano 1', 'Cabina 1', 'available', '',
     'Tablet per CRM clienti in cabina: schede trattamenti, firma digitale.',
     '2025-12-01', 749.00, '2028-12-01', 'Apple Italia', 'standard', 'AppleCare+',
     '192.168.10.20', '00:1A:2B:3C:56:10', 'PCR-000062', v_marco, v_created, v_created),

    (v_cid, 'EcoTank L4260', 'SN-BEA-PRN1', 'Epson', 'Printer', 'printing', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 'Wi-Fi', '4.2', 'USB',
     NULL, NULL, NULL, 'available', '',
     'Stampante multifunzione per documenti clienti e report.',
     '2025-10-01', 320.00, '2028-10-01', 'Epson Italia', 'onsite', NULL, NULL, NULL, 'PCR-000063', v_marco, v_created, v_created),

    (v_cid, 'UniFi U6 Lite', 'SN-BEA-AP1', 'Ubiquiti', 'Access Point', 'network', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, 'Wi-Fi 6', NULL, 'GbE PoE',
     NULL, NULL, NULL, 'available', '',
     'AP WiFi 6 per copertura centro estetico.',
     '2025-11-15', 99.00, '2028-11-15', 'Ubiquiti EU', 'onsite', NULL, '192.168.10.254', '00:1A:2B:3C:56:FF', 'PCR-000064', v_marco, v_created, v_created)
ON CONFLICT DO NOTHING;

-- Banca Regionale Etruria — 10 dispositivi
SELECT id INTO v_cid FROM public.clients WHERE name = 'Banca Regionale Etruria';
v_created := '2025-09-01 09:00:00+01'::timestamptz;
INSERT INTO public.devices (client_id, model, serial, brand, device_type, category, os, os_version, os_architecture,
    cpu_name, cpu_cores, cpu_frequency_ghz, ram_gb, ram_type, ram_frequency_mhz, storage_type, storage_capacity_gb, storage_drive_count,
    screen_size_inches, screen_resolution, screen_type, wifi, bluetooth, ethernet,
    location_office, location_floor, location_desk,
    status, assigned_to, notes,
    purchase_date, purchase_cost, warranty_expiry_date, warranty_provider, warranty_type, warranty_notes,
    ip_address, mac_address, asset_tag, created_by, created_at, updated_at) VALUES
    (v_cid, 'OptiPlex 7010', 'SN-ETR-001', 'Dell', 'Desktop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-13500', 14, 4.8, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, NULL, NULL, 'GbE',
     'Perugia', 'Piano 1', 'Direzione', 'assigned', 'Ing. Paolo Mattei',
     'PC direzione IT. Collegato a VLAN direzionale blindata.',
     '2025-08-01', 950.00, '2028-08-01', 'Dell Italia', 'onsite', 'Garanzia premium 4h on-site.',
     '192.168.11.10', '00:1A:2B:3C:57:01', 'PCR-000065', v_marco, v_created, v_created),

    (v_cid, 'OptiPlex 7010', 'SN-ETR-002', 'Dell', 'Desktop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-13500', 14, 4.8, 16, 'DDR4', 3200, 'NVMe SSD', 256, 1,
     NULL, NULL, NULL, NULL, NULL, 'GbE',
     'Perugia', 'Piano 1', 'IT Operations', 'assigned', 'Dott. Luca Barbieri',
     'PC sede centrale per gestione IT.',
     '2025-08-01', 950.00, '2028-08-01', 'Dell Italia', 'onsite', 'Garanzia premium.',
     '192.168.11.11', '00:1A:2B:3C:57:02', 'PCR-000066', v_marco, v_created, v_created),

    (v_cid, 'PowerEdge R360', 'SN-ETR-SRV1', 'Dell', 'Server Rack', 'server_infra', 'Windows Server 2025', '', '',
     'Intel Xeon E-2488', 8, 5.6, 128, 'ECC DDR5', 4800, 'RAID10 NVMe', 4096, 4,
     NULL, NULL, NULL, NULL, NULL, '4x 10GbE SFP+',
     'Perugia', 'Piano -1', 'CED rack 1', 'assigned', '',
     'Server principale: AD, DNS, DHCP, file server, gestione filiali. RAID10 NVMe 4TB.',
     '2025-06-01', 8500.00, '2028-06-01', 'Dell Italia', 'onsite', 'Garanzia 3 anni mission-critical.',
     '192.168.11.5', '00:1A:2B:3C:57:50', 'PCR-000067', v_marco, '2025-06-01 09:00:00+01'::timestamptz, '2025-06-01 09:00:00+01'::timestamptz),

    (v_cid, 'PowerEdge R260', 'SN-ETR-SRV2', 'Dell', 'Server Rack', 'server_infra', 'Ubuntu Server 24.04', '', '',
     'Intel Xeon E-2414', 4, 3.4, 64, 'ECC DDR5', 4800, 'RAID1 SSD', 960, 2,
     NULL, NULL, NULL, NULL, NULL, '2x 10GbE SFP+',
     'Perugia', 'Piano -1', 'CED rack 2', 'assigned', '',
     'Server backup e monitoring. Ubuntu + database replica.',
     '2025-06-01', 3200.00, '2028-06-01', 'Dell Italia', 'onsite', 'Garanzia 3 anni.',
     '192.168.11.6', '00:1A:2B:3C:57:51', 'PCR-000068', v_marco, '2025-06-01 09:00:00+01'::timestamptz, '2025-06-01 09:00:00+01'::timestamptz),

    (v_cid, 'DS1823xs+', 'SN-ETR-NAS1', 'Synology', 'NAS', 'server_infra', 'DSM 7.2', '', '',
     'AMD Ryzen V1780B', 4, 3.6, 16, 'ECC DDR4', 2666, 'HDD SATA', 48000, 8,
     NULL, NULL, NULL, NULL, NULL, '4x GbE + 2x 10GbE',
     'Perugia', 'Piano -1', 'CED rack 3', 'assigned', '',
     'NAS enterprise 8 bay RAID6. Backup centralizzato tutte le filiali. 48TB lordi.',
     '2025-03-01', 3200.00, '2028-03-01', 'Synology', 'onsite', 'Garanzia 3 anni + estensione.',
     '192.168.11.7', '00:1A:2B:3C:57:52', 'PCR-000069', v_marco, '2025-03-01 09:00:00+01'::timestamptz, '2025-03-01 09:00:00+01'::timestamptz),

    (v_cid, 'FortiGate 100F', 'SN-ETR-FW1', 'Fortinet', 'Firewall', 'network', 'FortiOS 7.6', '', '',
     'FortiASIC NP7', 4, 2.0, 8, 'DDR4', 2400, 'NAND Flash', 128, 1,
     NULL, NULL, NULL, NULL, NULL, '20x GbE + 4x SFP',
     'Perugia', 'Piano -1', 'CED rack 4', 'assigned', '',
     'Firewall perimetrale con VPN site-to-site per 15 filiali. IPS/AV/Filtro web.',
     '2025-05-01', 4500.00, '2028-05-01', 'Fortinet Italia', 'onsite', 'FortiCare 24/7 + FortiGuard bundle.',
     '192.168.11.1', '00:1A:2B:3C:57:F0', 'PCR-000070', v_marco, '2025-05-01 09:00:00+01'::timestamptz, '2025-05-01 09:00:00+01'::timestamptz),

    (v_cid, 'UniFi Switch Pro 48 PoE', 'SN-ETR-SW1', 'Ubiquiti', 'Switch PoE', 'network', '', '', '',
     NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
     NULL, NULL, NULL, NULL, NULL, '48x GbE PoE+ + 4x SFP+',
     'Perugia', 'Piano -1', 'CED rack core', 'available', '',
     'Switch core rack CED. Aggregazione VLAN e PoE per AP e telecamere.',
     '2025-04-01', 699.00, '2028-04-01', 'Ubiquiti EU', 'onsite', NULL, '192.168.11.254', '00:1A:2B:3C:57:FE', 'PCR-000071', v_marco, '2025-04-01 09:00:00+01'::timestamptz, '2025-04-01 09:00:00+01'::timestamptz),

    (v_cid, 'ThinkPad P15v Gen 4', 'SN-ETR-003', 'Lenovo', 'Laptop', 'endpoint', 'Windows 11 Pro', '23H2', 'x64',
     'Intel Core i7-13700H', 14, 5.0, 32, 'DDR5', 5200, 'NVMe SSD', 512, 1,
     15.6, '1920x1080', 'IPS', 'Wi-Fi 6E', '5.3', 'GbE',
     'Perugia', 'Piano 1', 'IT mobile', 'assigned', 'Ing. Paolo Mattei',
     'Workstation mobile per audit e configurazioni in filiale.',
     '2025-09-15', 2100.00, '2028-09-15', 'Lenovo', 'onsite', 'Garanzia 3 anni premium.',
     '192.168.11.12', '00:1A:2B:3C:57:03', 'PCR-000072', v_marco, v_created, v_created),

    (v_cid, 'OptiPlex 7010', 'SN-ETR-004', 'Dell', 'Desktop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-13500', 14, 4.8, 16, 'DDR4', 3200, 'NVMe SSD', 512, 1,
     NULL, NULL, NULL, NULL, NULL, 'GbE',
     'Perugia', 'Piano 1', 'Filiale 1 - Postazione 1', 'assigned', 'Operatore filiale',
     'Postazione operatore sportello filiale di Perugia.',
     '2025-08-01', 850.00, '2028-08-01', 'Dell Italia', 'onsite', 'Garanzia 3 anni.',
     '192.168.11.20', '00:1A:2B:3C:57:04', 'PCR-000073', v_marco, v_created, v_created),

    (v_cid, 'OptiPlex 7010', 'SN-ETR-005', 'Dell', 'Desktop', 'endpoint', 'Windows 11 Pro', '24H2', 'x64',
     'Intel Core i5-13500', 14, 4.8, 16, 'DDR4', 3200, 'NVMe SSD', 512, 1,
     NULL, NULL, NULL, NULL, NULL, 'GbE',
     'Perugia', 'Piano 1', 'Filiale 1 - Postazione 2', 'assigned', 'Operatore filiale',
     'Postazione operatore sportello filiale secondaria.',
     '2025-08-01', 850.00, '2028-08-01', 'Dell Italia', 'onsite', 'Garanzia 3 anni.',
     '192.168.11.21', '00:1A:2B:3C:57:05', 'PCR-000074', v_marco, v_created, v_created)
ON CONFLICT DO NOTHING;

-- Re-create the trigger for asset_tag that we dropped earlier
DROP TRIGGER IF EXISTS before_device_asset_tag_insert ON public.devices;
CREATE TRIGGER before_device_asset_tag_insert
  BEFORE INSERT ON public.devices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_device_asset_tag();
    SELECT coalesce(max((substring(asset_tag from '^PCR-([0-9]+)$'))::bigint), 0)
    INTO max_num
    FROM public.devices
    WHERE asset_tag ~ '^PCR-[0-9]+$';
    IF max_num > 0 THEN
        PERFORM setval('public.device_asset_seq', max_num, true);
    END IF;
END $$;

-- ============================================================================
-- 24. MAINTENANCE SCHEDULES
-- ============================================================================
DO $$
DECLARE
    v_dev   record;
    v_count int := 0;
BEGIN
    -- Create maintenance schedules for critical device types (servers, NAS, firewalls, network infra)
    FOR v_dev IN
        SELECT d.id, d.model, d.brand, d.device_type, d.category, c.name AS client_name, d.client_id
        FROM public.devices d
        JOIN public.clients c ON c.id = d.client_id
        WHERE d.category IN ('server_infra', 'network')
    LOOP
        IF v_dev.category = 'server_infra' THEN
            -- Monthly server maintenance
            INSERT INTO public.maintenance_schedules (device_id, title, description, recurrence, next_due_date, last_done_date, auto_create_ticket, assigned_to, ticket_template)
            VALUES (v_dev.id, 'Manutenzione server ' || v_dev.model, 'Verifica periodica server: aggiornamenti, log, backup, pulizia.', 'monthly',
                    '2026-06-15', '2026-05-15', true, 'a0000001-0000-4000-8000-000000000002'::uuid,
                     jsonb_build_object('title', 'Manutenzione server ' || v_dev.model || ' - ' || v_dev.client_name, 'description', 'Manutenzione programmata mensile. Verificare: aggiornamenti OS, log errori, spazio disco, backup, temperature.', 'ticket_type', 'maintenance', 'priority', 'med', 'category', 'Server'))
ON CONFLICT DO NOTHING;
        ELSIF v_dev.category = 'network' AND v_dev.device_type = 'Firewall' THEN
            -- Quarterly firewall review
            INSERT INTO public.maintenance_schedules (device_id, title, description, recurrence, next_due_date, last_done_date, auto_create_ticket, assigned_to)
            VALUES (v_dev.id, 'Review configurazione ' || v_dev.model, 'Audit trimestrale configurazione firewall: regole, connessioni attive, log.', 'quarterly',
                    '2026-07-01', '2026-04-01', true, 'a0000001-0000-4000-8000-000000000003'::uuid)
ON CONFLICT DO NOTHING;
        ELSIF v_dev.category = 'network' THEN
            -- Bi-annual network equipment check
            INSERT INTO public.maintenance_schedules (device_id, title, description, recurrence, next_due_date, last_done_date, auto_create_ticket, assigned_to)
            VALUES (v_dev.id, 'Verifica ' || v_dev.device_type || ' ' || v_dev.model, 'Controllo periodico stato apparecchiatura di rete: LED, temperature, porte.', 'quarterly',
                    '2026-08-01', '2026-04-15', false, 'a0000001-0000-4000-8000-000000000002'::uuid)
ON CONFLICT DO NOTHING;
        END IF;
        v_count := v_count + 1;
    END LOOP;

    -- Additional maintenance for critical endpoint devices (NAS gets monthly check too)
    FOR v_dev IN
        SELECT d.id, d.model, d.brand, d.device_type, c.name AS client_name
        FROM public.devices d
        JOIN public.clients c ON c.id = d.client_id
        WHERE d.device_type = 'NAS'
    LOOP
        INSERT INTO public.maintenance_schedules (device_id, title, description, recurrence, next_due_date, last_done_date, auto_create_ticket, assigned_to)
        VALUES (v_dev.id, 'Manutenzione NAS ' || v_dev.model, 'Verifica mensile NAS: spazio disco, RAID health, backup, aggiornamenti DSM.', 'monthly',
                '2026-06-10', '2026-05-10', true, 'a0000001-0000-4000-8000-000000000002'::uuid)
ON CONFLICT DO NOTHING;
        v_count := v_count + 1;
    END LOOP;

    -- Schedule for printers in high-usage environments
    FOR v_dev IN
        SELECT d.id, d.model, c.name AS client_name
        FROM public.devices d
        JOIN public.clients c ON c.id = d.client_id
        WHERE d.category = 'printing' AND c.name IN ('Tecnolab Srl', 'Clinica San Luca Srl', 'Studio Legale Ferretti', 'Istituto Leonardo da Vinci')
    LOOP
        INSERT INTO public.maintenance_schedules (device_id, title, description, recurrence, next_due_date, last_done_date, auto_create_ticket, assigned_to)
        VALUES (v_dev.id, 'Manutenzione stampante ' || v_dev.model, 'Pulizia testine, sostituzione consumabili (se necessario), verifica conteggio pagine.', 'quarterly',
                '2026-07-01', '2026-04-01', false, 'a0000001-0000-4000-8000-000000000003'::uuid)
ON CONFLICT DO NOTHING;
        v_count := v_count + 1;
    END LOOP;
END $$;

-- ============================================================================
-- 25. MAINTENANCE HISTORY
-- ============================================================================
INSERT INTO public.maintenance_history (schedule_id, device_id, completed_at, completed_by, notes)
SELECT s.id, s.device_id, s.last_done_date, s.assigned_to,
       CASE
           WHEN s.recurrence = 'monthly' THEN 'Manutenzione mensile completata: aggiornamenti applicati, backup verificato, log controllati. Nessuna anomalia rilevata.'
           WHEN s.recurrence = 'quarterly' THEN 'Audit trimestrale completato. Configurazione verificata e ottimizzata. Log archiviati.'
           ELSE 'Manutenzione periodica completata con successo.'
       END
FROM public.maintenance_schedules s
WHERE s.last_done_date IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.maintenance_history h WHERE h.schedule_id = s.id AND h.completed_at = s.last_done_date)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 26. CALENDAR EVENTS (future ones only; past events generated by TS script)
-- ============================================================================
DO $$
DECLARE
    v_marco   uuid := 'a0000001-0000-4000-8000-000000000001'::uuid;
    v_laura   uuid := 'a0000001-0000-4000-8000-000000000002'::uuid;
    v_diego   uuid := 'a0000001-0000-4000-8000-000000000003'::uuid;
    v_sara    uuid := 'a0000001-0000-4000-8000-000000000004'::uuid;
    v_cid     uuid;
    v_ids     uuid[] := ARRAY['a0000001-0000-4000-8000-000000000001'::uuid, 'a0000001-0000-4000-8000-000000000002'::uuid, 'a0000001-0000-4000-8000-000000000003'::uuid, 'a0000001-0000-4000-8000-000000000004'::uuid];
    v_tech    uuid;
    v_colors  text[] := ARRAY['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899'];
BEGIN
    -- June 2026 events
    INSERT INTO public.calendar_events (title, event_type, start_at, end_at, assignee_id, color, estimated_duration_minutes, notes, all_day, created_by)
    SELECT * FROM (VALUES
        ('Manutenzione server Tecnolab',        'intervention', '2026-06-02 09:00:00+02'::timestamptz, '2026-06-02 12:00:00+02'::timestamptz, v_laura, '#3B82F6', 180, 'Manutenzione mensile server PowerEdge T360 e NAS. Verificare backup e aggiornamenti.', false, v_marco),
        ('Setup nuovo PC reception Hotel',      'intervention', '2026-06-03 10:00:00+02'::timestamptz, '2026-06-03 13:00:00+02'::timestamptz, v_laura, '#10B981', 180, 'Configurazione nuovo PC reception. Installazione gestionale alberghiero e test stampante badge.', false, v_marco),
        ('Audit sicurezza Banca Etruria',       'intervention', '2026-06-05 09:00:00+02'::timestamptz, '2026-06-05 17:00:00+02'::timestamptz, v_diego, '#EF4444', 480, 'Audit trimestrale sicurezza: review firewall, log, utenze, policy. Tutto il giorno.', false, v_marco),
        ('Ferie Laura Bianchi',                 'availability', '2026-06-08 00:00:00+02'::timestamptz, '2026-06-14 23:59:00+02'::timestamptz, v_laura, '#F59E0B', NULL, 'Ferie 8-14 giugno.', true, v_laura),
        ('Manutenzione NAS Clinica San Luca',   'intervention', '2026-06-10 14:00:00+02'::timestamptz, '2026-06-10 16:00:00+02'::timestamptz, v_diego, '#3B82F6', 120, 'Sostituzione disco NAS segnalato come degradato. Check RAID e backup.', false, v_marco),
        ('Meeting review Q2',                   'appointment',  '2026-06-12 10:00:00+02'::timestamptz, '2026-06-12 11:30:00+02'::timestamptz, v_marco, '#8B5CF6', 90, 'Review trimestrale con tecnici: ticket, SLA, feedback clienti.', false, v_marco),

        ('Scadenza certificati SSL Banca',      'deadline',     '2026-06-15 09:00:00+02'::timestamptz, '2026-06-15 09:00:00+02'::timestamptz, v_diego, '#EF4444', NULL, 'Rinnovo certificati SSL firewall e server Banca Etruria in scadenza.', false, v_marco),
        ('Intervento Studio Legale Ferretti',   'intervention', '2026-06-17 09:00:00+02'::timestamptz, '2026-06-17 12:00:00+02'::timestamptz, v_laura, '#10B981', 180, 'Migrazione dati nuovo PC Avv. Bianchi + verifica NAS backup.', false, v_marco),
        ('Configurazione switch Hotel',         'intervention', '2026-06-19 14:00:00+02'::timestamptz, '2026-06-19 17:00:00+02'::timestamptz, v_diego, '#3B82F6', 180, 'Configurazione VLAN per nuovi AP WiFi 6 piano 3 e 4.', false, v_marco),
        ('Supporto remoto Supermercato',        'intervention', '2026-06-22 10:00:00+02'::timestamptz, '2026-06-22 11:00:00+02'::timestamptz, v_laura, '#F59E0B', 60, 'Verifica problema connessione bilancia reparto ortofrutta. Assistenza remota.', false, v_marco),
        ('Manutenzione server GDO',             'intervention', '2026-06-24 09:00:00+02'::timestamptz, '2026-06-24 13:00:00+02'::timestamptz, v_laura, '#3B82F6', 240, 'Manutenzione semestrale server Alimentari & Co: pulizia, update, test backup.', false, v_marco),
        ('Ferie Diego Ferraris',                'availability', '2026-06-22 00:00:00+02'::timestamptz, '2026-06-28 23:59:00+02'::timestamptz, v_diego, '#F59E0B', NULL, 'Ferie 22-28 giugno.', true, v_diego),

        ('Check-up Farmacia Galli',             'intervention', '2026-06-26 10:00:00+02'::timestamptz, '2026-06-26 12:00:00+02'::timestamptz, v_sara, '#10B981', 120, 'Check-up trimestrale: pulizia PC, aggiornamenti, verifica backup e terminale ricetta.', false, v_marco),
        ('Riunione fornitori',                  'appointment',  '2026-06-30 09:00:00+02'::timestamptz, '2026-06-30 10:30:00+02'::timestamptz, v_marco, '#8B5CF6', 90, 'Incontro con fornitori hardware per rinnovo parco macchine 2027.', false, v_marco),

        ('Intervento urgente Scuola Da Vinci',  'intervention', '2026-07-01 09:00:00+02'::timestamptz, '2026-07-01 16:00:00+02'::timestamptz, v_laura, '#EF4444', 420, 'Ricognizione completa laboratorio informatico: 5 PC da sostituire, 3 da riparare. Aggiornamento estate.', false, v_marco),
        ('Manutenzione firewall Banca',         'intervention', '2026-07-03 10:00:00+02'::timestamptz, '2026-07-03 14:00:00+02'::timestamptz, v_diego, '#3B82F6', 240, 'Aggiornamento firmware FortiGate + review regole. Pianificare finestra di downtime.', false, v_marco),
        ('Setup postazioni Hotel - alta stagione','intervention','2026-07-06 09:00:00+02'::timestamptz, '2026-07-06 12:00:00+02'::timestamptz, v_laura, '#10B981', 180, 'Configurazione nuove postazioni reception per stagione estiva. Verifica sistema booking.', false, v_marco),
        ('Preventivo Privacy Studio Ferretti',  'intervention', '2026-07-08 10:00:00+02'::timestamptz, '2026-07-08 11:00:00+02'::timestamptz, v_marco, '#8B5CF6', 60, 'Sopralluogo per preventivo adeguamento GDPR e security audit.', false, v_marco),
        ('Supporto POS Ristorante Da Gigi',     'intervention', '2026-07-10 11:00:00+02'::timestamptz, '2026-07-10 12:30:00+02'::timestamptz, v_diego, '#F59E0B', 90, 'Verifica problema stampante fiscale. Possibile sostituzione.', false, v_marco),
        ('Ferie Sara Moretti',                  'availability', '2026-07-13 00:00:00+02'::timestamptz, '2026-07-19 23:59:00+02'::timestamptz, v_sara, '#F59E0B', NULL, 'Ferie 13-19 luglio.', true, v_sara),
        ('Backup migration Banca Etruria',      'intervention', '2026-07-15 09:00:00+02'::timestamptz, '2026-07-15 17:00:00+02'::timestamptz, v_diego, '#EF4444', 480, 'Migrazione backup da NAS a nuovo sistema. Test ripristino. Giornata intera.', false, v_marco),
        ('Aggiornamento PC Beauty Lab',         'intervention', '2026-07-17 10:00:00+02'::timestamptz, '2026-07-17 12:00:00+02'::timestamptz, v_sara, '#10B981', 120, 'Aggiornamento macOS e software CRM su iMac e MacBook. Backup Time Machine.', false, v_marco)
    ) AS t
    WHERE NOT EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.title = t.column1 AND e.start_at = t.column3);

END $$;

-- ============================================================================
-- 27. AUTOMATION RUN LOGS
-- ============================================================================
INSERT INTO public.automation_run_logs (automation_id, status, triggered_by, triggered_at, duration_ms, is_dry_run, actions_executed, trigger_payload)
SELECT a.id, 'success', 'a0000001-0000-4000-8000-000000000001'::uuid, '2026-05-31 10:00:00+02'::timestamptz, floor(random() * 500 + 50)::int, false,
       ('[{"action":"' || a.name || '","status":"completed"}]')::jsonb,
       ('{"trigger":"cron","timestamp":"2026-05-31T08:00:00Z"}')::jsonb
FROM public.automation_flows a
WHERE a.active = true
  AND NOT EXISTS (SELECT 1 FROM public.automation_run_logs l WHERE l.automation_id = a.id)
ON CONFLICT DO NOTHING;

-- Additional random run logs for the past months
INSERT INTO public.automation_run_logs (automation_id, status, triggered_by, triggered_at, duration_ms, is_dry_run, actions_executed, error_message, trigger_payload)
SELECT
    a.id,
    CASE WHEN random() < 0.15 THEN 'error' ELSE 'success' END,
    CASE WHEN random() < 0.3 THEN 'a0000001-0000-4000-8000-000000000001'::uuid ELSE 'a0000001-0000-4000-8000-000000000002'::uuid END,
    ('2026-0' || (floor(random() * 4 + 1)::int) || '-' || lpad((floor(random() * 28 + 1)::int)::text, 2, '0') || ' 08:00:00+02')::timestamptz,
    floor(random() * 1000 + 50)::int,
    false,
    ('[{"action":"' || a.name || '","status":"completed"}]')::jsonb,
    CASE WHEN random() < 0.15 THEN 'Timeout durante verifica condizione: ticket non trovato' ELSE NULL END,
    ('{"trigger":"cron","timestamp":"2026-0' || (floor(random() * 4 + 1)::int) || '-' || lpad((floor(random() * 28 + 1)::int)::text, 2, '0') || 'T08:00:00Z"}')::jsonb
FROM public.automation_flows a
CROSS JOIN generate_series(1, 8)
WHERE a.active = true
ON CONFLICT DO NOTHING;

-- Set last_run_at on flows
UPDATE public.automation_flows SET last_run_at = '2026-05-31 10:00:00+02'::timestamptz WHERE active = true;

-- ============================================================================
-- 28. SEQUENCE ALIGNMENT
-- ============================================================================
-- Align device_asset_seq to the max asset_tag used
SELECT setval('public.device_asset_seq', coalesce(max(substring(asset_tag from '^PCR-([0-9]+)$')::bigint), 0), true)
FROM public.devices
WHERE asset_tag ~ '^PCR-[0-9]+$';

-- ============================================================================
-- 29. CLEANUP
-- ============================================================================
DROP TABLE IF EXISTS _clients;
DROP TABLE IF EXISTS _bundle_ids;

COMMIT;

-- ============================================================================
-- END OF SEED
-- ============================================================================

-- ============================================================================
-- 24. TICKETS (46 ticket con scenari realistici per tutti i clienti)
-- ============================================================================
DO $$
DECLARE
    v_cid      uuid;
    v_did      uuid;
    v_cid2     uuid;
    v_contact  uuid;
    v_marco    uuid := 'a0000001-0000-4000-8000-000000000001'::uuid;
    v_tid      uuid;
    v_tcode    text;
    v_now      timestamptz := '2026-05-31 10:00:00+02'::timestamptz;
BEGIN

    -- 1. PC produzione 1 – rallentamento e freeze intermittenti
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Tecnolab Srl';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-TEC-003';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Tecnolab Srl', 'Latitude 5540', 'Marco Ferrari', 'Marco Ferrari', 'high'::public.ticket_priority, 'in-progress', 'support', 'Windows 11 Pro', 'Gestionale officina, AutoCAD LT', 'Segnalato blocco casuale durante l''uso del gestionale. Riavviando si riprende ma dopo 1-2 ore si ripresenta.', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 2.5, 60, 0, 'EUR', v_now - interval '7 days', v_now - interval '7 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000002'::uuid, v_now - interval '7 days' - interval '75 minutes', v_now - interval '7 days', 150, 'PC produzione 1 – rallentamento e freeze intermittenti'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: PC produzione 1 – rallentamento e freeze intermittenti', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: PC produzione 1 – rallentamento e freeze intermittenti',
           'Ti è stato assegnato un ticket con priorità alta per Tecnolab Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Tecnolab Srl'),
           v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 2. Subentro nuova postazione CAD – reparto progettazione
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Tecnolab Srl';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Tecnolab Srl', 'Precision 3680 Tower', 'Roberto Mancini', 'Roberto Mancini', 'med'::public.ticket_priority, 'pending', 'device', 'Windows 11 Pro', 'SolidWorks, AutoCAD, Office', 'Richiesta nuova postazione per progettazione meccanica. Specifiche: i9-13900, 64GB RAM, RTX A4000, SSD 1TB.', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 0, 60, 3200, 'EUR', v_now - interval '14 days', v_now - interval '14 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'In attesa di ricambio/approvazione. Contattare il cliente per conferma preventivo.', true, v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Subentro nuova postazione CAD – reparto progettazione', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'info', v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Subentro nuova postazione CAD – reparto progettazione',
           'Ti è stato assegnato un ticket con priorità media per Tecnolab Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Tecnolab Srl'),
           v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 3. NAS backup – sostituzione disco guasto
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Tecnolab Srl';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-TEC-NAS1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Tecnolab Srl', 'DS1522+', 'Roberto Mancini', 'Roberto Mancini', 'high'::public.ticket_priority, 'testing', 'maintenance', 'DSM 7.2', 'Hyper Backup, Active Backup for Business', 'Disco 3 in SHR degradato. Sostituire con WD Red 4TB. Verificare integrità volume e ripristino.', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 1, 60, 145, 'EUR', v_now - interval '21 days', v_now - interval '21 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000002'::uuid, v_now - interval '21 days' - interval '30 minutes', v_now - interval '21 days', 60, 'NAS backup – sostituzione disco guasto'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: NAS backup – sostituzione disco guasto', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: NAS backup – sostituzione disco guasto',
           'Ti è stato assegnato un ticket con priorità alta per Tecnolab Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Tecnolab Srl'),
           v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 4. Server ERP – aggiornamento trimestrale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Tecnolab Srl';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-TEC-SRV1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Tecnolab Srl', 'PowerEdge T360', 'Roberto Mancini', 'Roberto Mancini', 'med'::public.ticket_priority, 'completed', 'maintenance', 'Windows Server 2022', 'Mago ERP, SQL Server', 'Patch cumulativa trimestrale. Fermo programmato sabato 15/05 notte.', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 4, 70, 0, 'EUR', v_now - interval '28 days', v_now - interval '28 days', v_now - interval '14 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000002'::uuid, v_now - interval '28 days' - interval '120 minutes', v_now - interval '28 days', 240, 'Server ERP – aggiornamento trimestrale'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Server ERP – aggiornamento trimestrale', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Server ERP – aggiornamento trimestrale',
           'Ti è stato assegnato un ticket con priorità media per Tecnolab Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Tecnolab Srl'),
           v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 5. Stampante laser – non stampa da PC produzione
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Tecnolab Srl';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-TEC-PRN1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Tecnolab Srl', 'LaserJet Pro M404dn', 'Marco Ferrari', 'Marco Ferrari', 'low'::public.ticket_priority, 'completed', 'support', '', '', 'Il driver sulla postazione produzione 2 non trova la stampante. Il LED è verde.', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 0.5, 60, 0, 'EUR', v_now - interval '35 days', v_now - interval '35 days', v_now - interval '7 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'Intervento completato. Verificare con il cliente la soddisfazione. Aggiornare documentazione.', true, v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000002'::uuid, v_now - interval '35 days' - interval '15 minutes', v_now - interval '35 days', 30, 'Stampante laser – non stampa da PC produzione'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Stampante laser – non stampa da PC produzione', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Stampante laser – non stampa da PC produzione',
           'Ti è stato assegnato un ticket con priorità bassa per Tecnolab Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Tecnolab Srl'),
           v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 6. Postazione accettazione 1 – ticket bloccato
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Clinica San Luca Srl';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-CSL-001';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Clinica San Luca Srl', 'OptiPlex Micro 7010', 'Infermiera turno', 'Infermiera turno', 'high'::public.ticket_priority, 'in-progress', 'support', 'Windows 11 Pro', 'Gestionale ricette, Registry MMG', 'Il gestionale ricette si blocca dopo aver inserito 3-4 farmaci. Riavviato ma riaccade dopo pochi minuti.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 1.5, 55, 0, 'EUR', v_now - interval '7 days', v_now - interval '7 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '7 days' - interval '45 minutes', v_now - interval '7 days', 90, 'Postazione accettazione 1 – ticket bloccato'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Postazione accettazione 1 – ticket bloccato', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Postazione accettazione 1 – ticket bloccato',
           'Ti è stato assegnato un ticket con priorità alta per Clinica San Luca Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Clinica San Luca Srl'),
           v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 7. Nuovo PC reparto degenza – configurazione
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Clinica San Luca Srl';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Clinica San Luca Srl', 'OptiPlex Micro 7020', 'Dott.ssa Maria Bianchi', 'Dott.ssa Maria Bianchi', 'med'::public.ticket_priority, 'pending', 'device', 'Windows 11 Pro', 'Cartella clinica, ADT, Office', 'Nuova postazione per caposala reparto degenza. Configurare come da standard aziendale.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 0, 55, 890, 'EUR', v_now - interval '14 days', v_now - interval '14 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Nuovo PC reparto degenza – configurazione', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'info', v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Nuovo PC reparto degenza – configurazione',
           'Ti è stato assegnato un ticket con priorità media per Clinica San Luca Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Clinica San Luca Srl'),
           v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 8. Backup NAS – verifica crittografia
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Clinica San Luca Srl';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-CSL-NAS1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Clinica San Luca Srl', 'DS923+', 'Francesco Neri', 'Francesco Neri', 'med'::public.ticket_priority, 'completed', 'maintenance', 'DSM 7.2', 'Hyper Backup', 'Verifica backup crittografato verso off-site. Test ripristino file random.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 2, 55, 0, 'EUR', v_now - interval '21 days', v_now - interval '21 days', v_now - interval '21 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'Intervento completato. Verificare con il cliente la soddisfazione. Aggiornare documentazione.', true, v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '21 days' - interval '60 minutes', v_now - interval '21 days', 120, 'Backup NAS – verifica crittografia'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Backup NAS – verifica crittografia', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Backup NAS – verifica crittografia',
           'Ti è stato assegnato un ticket con priorità media per Clinica San Luca Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Clinica San Luca Srl'),
           v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 9. Tablet iPad – riconsegna dopo manutenzione
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Clinica San Luca Srl';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-CSL-TAB1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Clinica San Luca Srl', 'iPad 10th Gen', 'Dott.ssa Maria Bianchi', 'Dott.ssa Maria Bianchi', 'low'::public.ticket_priority, 'ready', 'device', 'iPadOS 18', 'Cartella clinica mobile, Messaggistica', 'Aggiornamento iPadOS e configurazione MDM completati. Pronto per la riconsegna.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 0.5, 55, 0, 'EUR', v_now - interval '28 days', v_now - interval '28 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '28 days' - interval '15 minutes', v_now - interval '28 days', 30, 'Tablet iPad – riconsegna dopo manutenzione'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Tablet iPad – riconsegna dopo manutenzione', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'info', v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Tablet iPad – riconsegna dopo manutenzione',
           'Ti è stato assegnato un ticket con priorità bassa per Clinica San Luca Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Clinica San Luca Srl'),
           v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 10. Stacco UPS – segnalazione allarme
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Clinica San Luca Srl';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Clinica San Luca Srl', '', 'Francesco Neri', 'Francesco Neri', 'high'::public.ticket_priority, 'completed', 'support', '', '', 'L''UPS del locale server ha iniziato a emettere allarme acustico intermittente. Verificato: batteria da sostituire.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 1, 55, 280, 'EUR', v_now - interval '35 days', v_now - interval '35 days', v_now - interval '3 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '35 days' - interval '30 minutes', v_now - interval '35 days', 60, 'Stacco UPS – segnalazione allarme'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Stacco UPS – segnalazione allarme', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'critical', v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Stacco UPS – segnalazione allarme',
           'Ti è stato assegnato un ticket con priorità alta per Clinica San Luca Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Clinica San Luca Srl'),
           v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 11. Surface Laptop – sostituzione batteria
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Studio Legale Ferretti';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-FER-001';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Studio Legale Ferretti', 'Surface Laptop 5', 'Avv. Carlo Ferretti', 'Avv. Carlo Ferretti', 'high'::public.ticket_priority, 'in-progress', 'support', 'Windows 11 Pro', 'Office, Lexia, Outlook', 'Batteria dura meno di 1 ora. Da sostituire in garanzia Microsoft Complete.', 'a0000001-0000-4000-8000-000000000003'::uuid, v_marco, 1, 70, 0, 'EUR', v_now - interval '7 days', v_now - interval '7 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'In lavorazione. Necessario ordinare ricambio prima di procedere. Aggiornare ticket quando disponibile.', true, v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000003'::uuid, v_now - interval '7 days' - interval '30 minutes', v_now - interval '7 days', 60, 'Surface Laptop – sostituzione batteria'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Surface Laptop – sostituzione batteria', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000003'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Surface Laptop – sostituzione batteria',
           'Ti è stato assegnato un ticket con priorità alta per Studio Legale Ferretti.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Studio Legale Ferretti'),
           v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 12. Rinnovo certificato SSL – sito web studio
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Studio Legale Ferretti';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Studio Legale Ferretti', '', 'Avv. Carlo Ferretti', 'Avv. Carlo Ferretti', 'med'::public.ticket_priority, 'completed', 'support', '', '', 'Certificato SSL in scadenza il 30/04. Rinnovare con Let''s Encrypt.', 'a0000001-0000-4000-8000-000000000003'::uuid, v_marco, 0.5, 70, 0, 'EUR', v_now - interval '14 days', v_now - interval '14 days', v_now - interval '5 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000003'::uuid, v_now - interval '14 days' - interval '15 minutes', v_now - interval '14 days', 30, 'Rinnovo certificato SSL – sito web studio'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Rinnovo certificato SSL – sito web studio', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000003'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Rinnovo certificato SSL – sito web studio',
           'Ti è stato assegnato un ticket con priorità media per Studio Legale Ferretti.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Studio Legale Ferretti'),
           v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 13. Segreteria – Outlook lento nella ricerca
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Studio Legale Ferretti';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-FER-002';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Studio Legale Ferretti', 'Surface Laptop 5', 'Simonetta Gallo', 'Simonetta Gallo', 'low'::public.ticket_priority, 'completed', 'support', 'Windows 11 Pro', 'Outlook, Office', 'Ricerca email molto lenta, archivio PST da 8GB da ottimizzare.', 'a0000001-0000-4000-8000-000000000003'::uuid, v_marco, 1.5, 70, 0, 'EUR', v_now - interval '21 days', v_now - interval '21 days', v_now - interval '10 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000003'::uuid, v_now - interval '21 days' - interval '45 minutes', v_now - interval '21 days', 90, 'Segreteria – Outlook lento nella ricerca'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Segreteria – Outlook lento nella ricerca', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000003'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Segreteria – Outlook lento nella ricerca',
           'Ti è stato assegnato un ticket con priorità bassa per Studio Legale Ferretti.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Studio Legale Ferretti'),
           v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 14. NAS backup – verifica settimanale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Studio Legale Ferretti';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-FER-NAS1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Studio Legale Ferretti', 'DS220+', 'Simonetta Gallo', 'Simonetta Gallo', 'low'::public.ticket_priority, 'completed', 'maintenance', 'DSM 7.2', 'Hyper Backup', 'Verifica backup settimanale e test ripristino.', 'a0000001-0000-4000-8000-000000000003'::uuid, v_marco, 0.5, 70, 0, 'EUR', v_now - interval '28 days', v_now - interval '28 days', v_now - interval '2 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'Intervento completato. Verificare con il cliente la soddisfazione. Aggiornare documentazione.', true, v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000003'::uuid, v_now - interval '28 days' - interval '15 minutes', v_now - interval '28 days', 30, 'NAS backup – verifica settimanale'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: NAS backup – verifica settimanale', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000003'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: NAS backup – verifica settimanale',
           'Ti è stato assegnato un ticket con priorità bassa per Studio Legale Ferretti.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Studio Legale Ferretti'),
           v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 15. Laboratorio 1 – postazione 5 non si accende
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Istituto Leonardo da Vinci';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-DAV-002';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Istituto Leonardo da Vinci', 'OptiPlex 3040 Micro', 'Luca Conti', 'Luca Conti', 'high'::public.ticket_priority, 'in-progress', 'support', 'Ubuntu 24.04', 'Ubuntu Desktop', 'Postazione 5 lab 1 non dà segno di vita. Alimentatore da verificare.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 1, 50, 0, 'EUR', v_now - interval '35 days', v_now - interval '35 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '35 days' - interval '30 minutes', v_now - interval '35 days', 60, 'Laboratorio 1 – postazione 5 non si accende'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Laboratorio 1 – postazione 5 non si accende', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Laboratorio 1 – postazione 5 non si accende',
           'Ti è stato assegnato un ticket con priorità alta per Istituto Leonardo da Vinci.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Istituto Leonardo da Vinci'),
           v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 16. iPad segreteria – configurazione registro elettronico
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Istituto Leonardo da Vinci';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-DAV-TAB1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Istituto Leonardo da Vinci', 'iPad 9th Gen', 'Prof.ssa Anna Verdi', 'Prof.ssa Anna Verdi', 'med'::public.ticket_priority, 'completed', 'device', 'iPadOS 18', 'Registro elettronico, Nuvola', 'Configurare iPad segreteria con app registro e account docente.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 1, 50, 0, 'EUR', v_now - interval '7 days', v_now - interval '7 days', v_now - interval '12 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '7 days' - interval '30 minutes', v_now - interval '7 days', 60, 'iPad segreteria – configurazione registro elettronico'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: iPad segreteria – configurazione registro elettronico', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: iPad segreteria – configurazione registro elettronico',
           'Ti è stato assegnato un ticket con priorità media per Istituto Leonardo da Vinci.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Istituto Leonardo da Vinci'),
           v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 17. Stampante sala docenti – cambio toner
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Istituto Leonardo da Vinci';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-DAV-PRN1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Istituto Leonardo da Vinci', 'LaserJet M404dn', 'Prof.ssa Anna Verdi', 'Prof.ssa Anna Verdi', 'low'::public.ticket_priority, 'completed', 'support', '', '', 'Toner esaurito. Sostituire con HP 26X originale.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 0.3, 50, 85, 'EUR', v_now - interval '14 days', v_now - interval '14 days', v_now - interval '4 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'Intervento completato. Verificare con il cliente la soddisfazione. Aggiornare documentazione.', true, v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '14 days' - interval '9 minutes', v_now - interval '14 days', 18, 'Stampante sala docenti – cambio toner'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Stampante sala docenti – cambio toner', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Stampante sala docenti – cambio toner',
           'Ti è stato assegnato un ticket con priorità bassa per Istituto Leonardo da Vinci.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Istituto Leonardo da Vinci'),
           v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 18. Richiesta nuovo PC laboratorio 2
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Istituto Leonardo da Vinci';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Istituto Leonardo da Vinci', 'OptiPlex 7020 Micro', 'Luca Conti', 'Luca Conti', 'med'::public.ticket_priority, 'pending', 'device', 'Ubuntu 24.04', 'Ubuntu Desktop, LibreOffice, GIMP', 'Nuova postazione da aggiungere al lab 2. Configurare come le esistenti.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 0, 50, 520, 'EUR', v_now - interval '21 days', v_now - interval '21 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Richiesta nuovo PC laboratorio 2', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'info', v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Richiesta nuovo PC laboratorio 2',
           'Ti è stato assegnato un ticket con priorità media per Istituto Leonardo da Vinci.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Istituto Leonardo da Vinci'),
           v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 19. PC cassa – POS non comunica con gestionale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Ristorante Da Gigi';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-GIG-001';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Ristorante Da Gigi', 'ThinkCentre Neo 50s', 'Sofia Romano', 'Sofia Romano', 'high'::public.ticket_priority, 'in-progress', 'support', 'Windows 11 Pro', 'Gestionale ristorante, POS SumUp', 'Dopo aggiornamento gestionale, il POS non invia più gli scontrini al gestionale stesso.', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 1, 80, 0, 'EUR', v_now - interval '28 days', v_now - interval '28 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000002'::uuid, v_now - interval '28 days' - interval '30 minutes', v_now - interval '28 days', 60, 'PC cassa – POS non comunica con gestionale'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: PC cassa – POS non comunica con gestionale', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: PC cassa – POS non comunica con gestionale',
           'Ti è stato assegnato un ticket con priorità alta per Ristorante Da Gigi.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Ristorante Da Gigi'),
           v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 20. Menu digitale tablet – app crasha
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Ristorante Da Gigi';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-GIG-TAB1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Ristorante Da Gigi', 'Galaxy Tab A8', 'Gigi Marchetti', 'Gigi Marchetti', 'med'::public.ticket_priority, 'completed', 'support', 'Android 14', 'Menu digitale app', 'L''app menu digitale va in crash dopo 10 minuti di inattività.', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 2, 80, 0, 'EUR', v_now - interval '35 days', v_now - interval '35 days', v_now - interval '6 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'Intervento completato. Verificare con il cliente la soddisfazione. Aggiornare documentazione.', true, v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000002'::uuid, v_now - interval '35 days' - interval '60 minutes', v_now - interval '35 days', 120, 'Menu digitale tablet – app crasha'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Menu digitale tablet – app crasha', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Menu digitale tablet – app crasha',
           'Ti è stato assegnato un ticket con priorità media per Ristorante Da Gigi.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Ristorante Da Gigi'),
           v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 21. Stampante scontrini – testine intasate
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Ristorante Da Gigi';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-GIG-POS1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Ristorante Da Gigi', 'TallyDascom T-2260', 'Sofia Romano', 'Sofia Romano', 'med'::public.ticket_priority, 'completed', 'support', '', '', 'Scontrino stampato con righe bianche. Pulizia testina e verifica ribbon.', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 0.5, 80, 15, 'EUR', v_now - interval '7 days', v_now - interval '7 days', v_now - interval '1 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000002'::uuid, v_now - interval '7 days' - interval '15 minutes', v_now - interval '7 days', 30, 'Stampante scontrini – testine intasate'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Stampante scontrini – testine intasate', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Stampante scontrini – testine intasate',
           'Ti è stato assegnato un ticket con priorità media per Ristorante Da Gigi.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Ristorante Da Gigi'),
           v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 22. Banco 1 – terminale ricetta non risponde
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Farmacia Dott. Galli';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-FAR-001';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Farmacia Dott. Galli', 'ThinkCentre M75q Gen 5', 'Farmacista turno', 'Farmacista turno', 'high'::public.ticket_priority, 'in-progress', 'support', 'Windows 11 Pro', 'Gestionale farmacia, Terminale ricetta', 'Il terminale ricetta elettronica non risponde. Il servizio TS potrebbe essere giù.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 0.5, 75, 0, 'EUR', v_now - interval '14 days', v_now - interval '14 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '14 days' - interval '15 minutes', v_now - interval '14 days', 30, 'Banco 1 – terminale ricetta non risponde'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Banco 1 – terminale ricetta non risponde', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Banco 1 – terminale ricetta non risponde',
           'Ti è stato assegnato un ticket con priorità alta per Farmacia Dott. Galli.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Farmacia Dott. Galli'),
           v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 23. PC direzione – aggiornamento gestionale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Farmacia Dott. Galli';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-FAR-003';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Farmacia Dott. Galli', 'ThinkCentre M75q Gen 5', 'Dott. Marco Galli', 'Dott. Marco Galli', 'med'::public.ticket_priority, 'completed', 'support', 'Windows 11 Pro', 'Gestionale farmacia, Office', 'Aggiornamento nuovo gestionale alla versione 2026.1.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 3, 75, 0, 'EUR', v_now - interval '21 days', v_now - interval '21 days', v_now - interval '20 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'Intervento completato. Verificare con il cliente la soddisfazione. Aggiornare documentazione.', true, v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '21 days' - interval '90 minutes', v_now - interval '21 days', 180, 'PC direzione – aggiornamento gestionale'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: PC direzione – aggiornamento gestionale', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: PC direzione – aggiornamento gestionale',
           'Ti è stato assegnato un ticket con priorità media per Farmacia Dott. Galli.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Farmacia Dott. Galli'),
           v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 24. NAS backup – verifica spazio disco
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Farmacia Dott. Galli';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-FAR-NAS1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Farmacia Dott. Galli', 'DS120j', 'Dott. Marco Galli', 'Dott. Marco Galli', 'low'::public.ticket_priority, 'completed', 'maintenance', 'DSM 7.2', 'Hyper Backup', 'Il NAS mostra spazio occupato al 98%. Verificare e archiviare backup vecchi.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 1, 75, 0, 'EUR', v_now - interval '28 days', v_now - interval '28 days', v_now - interval '15 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '28 days' - interval '30 minutes', v_now - interval '28 days', 60, 'NAS backup – verifica spazio disco'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: NAS backup – verifica spazio disco', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: NAS backup – verifica spazio disco',
           'Ti è stato assegnato un ticket con priorità bassa per Farmacia Dott. Galli.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Farmacia Dott. Galli'),
           v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 25. Stampante etichette – codice a barre illeggibile
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Farmacia Dott. Galli';
    SELECT id INTO v_did FROM public.devices WHERE serial = 'SN-FAR-PRN1';
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Farmacia Dott. Galli', 'LaserJet Pro M304a', 'Chiara Rinaldi', 'Chiara Rinaldi', 'med'::public.ticket_priority, 'completed', 'support', '', '', 'Le etichette stampate hanno codice a barre sbiadito. Da verificare toner e impostazioni.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 0.5, 75, 45, 'EUR', v_now - interval '35 days', v_now - interval '35 days', v_now - interval '2 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '35 days' - interval '15 minutes', v_now - interval '35 days', 30, 'Stampante etichette – codice a barre illeggibile'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Stampante etichette – codice a barre illeggibile', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Stampante etichette – codice a barre illeggibile',
           'Ti è stato assegnato un ticket con priorità media per Farmacia Dott. Galli.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Farmacia Dott. Galli'),
           v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 26. Tablet officina – Wi-Fi non funziona
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Autocarrozzeria Mercurio';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Autocarrozzeria Mercurio', 'Galaxy Tab A9+', 'Alessandro Fabbri', 'Alessandro Fabbri', 'high'::public.ticket_priority, 'in-progress', 'support', 'Android 14', 'Gestione officina, CRM', 'Il tablet officina non si connette più al Wi-Fi aziendale. Verificare e riconfigurare.', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 0.5, 75, 0, 'EUR', v_now - interval '7 days', v_now - interval '7 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'In lavorazione. Necessario ordinare ricambio prima di procedere. Aggiornare ticket quando disponibile.', true, v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000002'::uuid, v_now - interval '7 days' - interval '15 minutes', v_now - interval '7 days', 30, 'Tablet officina – Wi-Fi non funziona'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Tablet officina – Wi-Fi non funziona', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Tablet officina – Wi-Fi non funziona',
           'Ti è stato assegnato un ticket con priorità alta per Autocarrozzeria Mercurio.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Autocarrozzeria Mercurio'),
           v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 27. PC ufficio – backup giornaliero non parte
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Autocarrozzeria Mercurio';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Autocarrozzeria Mercurio', 'ThinkCentre Neo 50s', 'Stefano Bianco', 'Stefano Bianco', 'med'::public.ticket_priority, 'completed', 'support', 'Windows 11 Pro', 'Gestione officina, Office, Backup365', 'Backup automatico non parte da 3 giorni. Errore: "Disco di destinazione non raggiungibile".', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 1, 75, 0, 'EUR', v_now - interval '14 days', v_now - interval '14 days', v_now - interval '8 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000002'::uuid, v_now - interval '14 days' - interval '30 minutes', v_now - interval '14 days', 60, 'PC ufficio – backup giornaliero non parte'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: PC ufficio – backup giornaliero non parte', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: PC ufficio – backup giornaliero non parte',
           'Ti è stato assegnato un ticket con priorità media per Autocarrozzeria Mercurio.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Autocarrozzeria Mercurio'),
           v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 28. Reception – check-in bloccato su 2 postazioni
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Hotel Palazzo della Regina';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Hotel Palazzo della Regina', '', 'Matteo Russo', 'Matteo Russo', 'high'::public.ticket_priority, 'in-progress', 'support', 'Windows 11 Pro', 'Gestionale hotel, PMS', 'Il gestionale booking su postazioni 1 e 2 si blocca durante il check-in.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 2, 65, 0, 'EUR', v_now - interval '21 days', v_now - interval '21 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '21 days' - interval '60 minutes', v_now - interval '21 days', 120, 'Reception – check-in bloccato su 2 postazioni'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Reception – check-in bloccato su 2 postazioni', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Reception – check-in bloccato su 2 postazioni',
           'Ti è stato assegnato un ticket con priorità alta per Hotel Palazzo della Regina.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Hotel Palazzo della Regina'),
           v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 29. Wi-Fi ospiti – rallentamento serale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Hotel Palazzo della Regina';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Hotel Palazzo della Regina', '', 'Matteo Russo', 'Matteo Russo', 'med'::public.ticket_priority, 'pending', 'support', '', '', 'Dalle 20:00 alle 23:00 la connessione Wi-Fi degli ospiti diventa molto lenta.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 0, 65, 0, 'EUR', v_now - interval '28 days', v_now - interval '28 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'In attesa di ricambio/approvazione. Contattare il cliente per conferma preventivo.', true, v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Wi-Fi ospiti – rallentamento serale', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'info', v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Wi-Fi ospiti – rallentamento serale',
           'Ti è stato assegnato un ticket con priorità media per Hotel Palazzo della Regina.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Hotel Palazzo della Regina'),
           v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 30. Amministrazione – installazione Office 2026
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Hotel Palazzo della Regina';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Hotel Palazzo della Regina', '', 'Paolo Ferri', 'Paolo Ferri', 'low'::public.ticket_priority, 'completed', 'device', 'Windows 11 Pro', 'Microsoft 365, Excel', 'Aggiornare a Office 2026 le 3 postazioni amministrazione.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 1.5, 65, 480, 'EUR', v_now - interval '35 days', v_now - interval '35 days', v_now - interval '11 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '35 days' - interval '45 minutes', v_now - interval '35 days', 90, 'Amministrazione – installazione Office 2026'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Amministrazione – installazione Office 2026', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Amministrazione – installazione Office 2026',
           'Ti è stato assegnato un ticket con priorità bassa per Hotel Palazzo della Regina.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Hotel Palazzo della Regina'),
           v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 31. Server booking – verifica performance pre-stagione
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Hotel Palazzo della Regina';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Hotel Palazzo della Regina', '', 'Dott.ssa Lucia Contarini', 'Dott.ssa Lucia Contarini', 'high'::public.ticket_priority, 'completed', 'maintenance', 'Windows Server 2022', 'Database PMS, SQL Server', 'Prima dell''alta stagione estiva, verificare performance del server booking.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 3, 65, 0, 'EUR', v_now - interval '7 days', v_now - interval '7 days', v_now - interval '5 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '7 days' - interval '90 minutes', v_now - interval '7 days', 180, 'Server booking – verifica performance pre-stagione'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Server booking – verifica performance pre-stagione', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'critical', v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Server booking – verifica performance pre-stagione',
           'Ti è stato assegnato un ticket con priorità alta per Hotel Palazzo della Regina.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Hotel Palazzo della Regina'),
           v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 32. Cassa 3 – POS non stampa scontrino
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Supermercato Alimentari & Co';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Supermercato Alimentari & Co', 'Epson TM-T88VII', 'Giuseppe Fontana', 'Giuseppe Fontana', 'high'::public.ticket_priority, 'testing', 'support', '', '', 'La stampante POS sulla cassa 3 stampa scontrini bianchi.', 'a0000001-0000-4000-8000-000000000003'::uuid, v_marco, 0.5, 70, 25, 'EUR', v_now - interval '14 days', v_now - interval '14 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'Test in corso. Verificare con utente finale prima di chiudere il ticket.', true, v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000003'::uuid, v_now - interval '14 days' - interval '15 minutes', v_now - interval '14 days', 30, 'Cassa 3 – POS non stampa scontrino'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Cassa 3 – POS non stampa scontrino', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000003'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Cassa 3 – POS non stampa scontrino',
           'Ti è stato assegnato un ticket con priorità alta per Supermercato Alimentari & Co.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Supermercato Alimentari & Co'),
           v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 33. Server gestionale – aggiornamento notturno
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Supermercato Alimentari & Co';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Supermercato Alimentari & Co', 'PowerEdge T160', 'Giuseppe Fontana', 'Giuseppe Fontana', 'med'::public.ticket_priority, 'completed', 'maintenance', 'Windows Server 2022', 'Gestionale GDO, SQL Server', 'Patch cumulativa e riavvio programmato. Fermo notturno 02:00-04:00.', 'a0000001-0000-4000-8000-000000000003'::uuid, v_marco, 3, 70, 0, 'EUR', v_now - interval '21 days', v_now - interval '21 days', v_now - interval '9 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000003'::uuid, v_now - interval '21 days' - interval '90 minutes', v_now - interval '21 days', 180, 'Server gestionale – aggiornamento notturno'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Server gestionale – aggiornamento notturno', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000003'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Server gestionale – aggiornamento notturno',
           'Ti è stato assegnato un ticket con priorità media per Supermercato Alimentari & Co.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Supermercato Alimentari & Co'),
           v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 34. Bilancia pesatura – fuori calibrazione
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Supermercato Alimentari & Co';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Supermercato Alimentari & Co', 'Bilancia Dibal 500', 'Giuseppe Fontana', 'Giuseppe Fontana', 'med'::public.ticket_priority, 'completed', 'support', '', '', 'La bilancia del reparto gastronomia dà peso errato di circa 50g in più.', 'a0000001-0000-4000-8000-000000000003'::uuid, v_marco, 0.5, 70, 0, 'EUR', v_now - interval '28 days', v_now - interval '28 days', v_now - interval '1 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000003'::uuid, v_now - interval '28 days' - interval '15 minutes', v_now - interval '28 days', 30, 'Bilancia pesatura – fuori calibrazione'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Bilancia pesatura – fuori calibrazione', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000003'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Bilancia pesatura – fuori calibrazione',
           'Ti è stato assegnato un ticket con priorità media per Supermercato Alimentari & Co.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Supermercato Alimentari & Co'),
           v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 35. PC reception – software prenotazioni lento
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Centro Estetico Beauty Lab';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Centro Estetico Beauty Lab', '', 'Elena Grecchi', 'Elena Grecchi', 'med'::public.ticket_priority, 'in-progress', 'support', 'Windows 11 Pro', 'Software prenotazioni, CRM, Office', 'Il software prenotazioni impiega 30 secondi per ogni operazione. Ottimizzare.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 2.5, 80, 0, 'EUR', v_now - interval '35 days', v_now - interval '35 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'In lavorazione. Necessario ordinare ricambio prima di procedere. Aggiornare ticket quando disponibile.', true, v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '35 days' - interval '75 minutes', v_now - interval '35 days', 150, 'PC reception – software prenotazioni lento'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: PC reception – software prenotazioni lento', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'info', v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: PC reception – software prenotazioni lento',
           'Ti è stato assegnato un ticket con priorità media per Centro Estetico Beauty Lab.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Centro Estetico Beauty Lab'),
           v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 36. Nuovo tablet estetista – configurazione
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Centro Estetico Beauty Lab';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Centro Estetico Beauty Lab', 'Galaxy Tab A9+', 'Camilla Guerra', 'Camilla Guerra', 'low'::public.ticket_priority, 'completed', 'device', 'Android 14', 'Prenotazioni app, CRM mobile', 'Configurare nuovo tablet per estetiste con app prenotazioni e CRM.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 0.5, 80, 320, 'EUR', v_now - interval '7 days', v_now - interval '7 days', v_now - interval '18 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '7 days' - interval '15 minutes', v_now - interval '7 days', 30, 'Nuovo tablet estetista – configurazione'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Nuovo tablet estetista – configurazione', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Nuovo tablet estetista – configurazione',
           'Ti è stato assegnato un ticket con priorità bassa per Centro Estetico Beauty Lab.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Centro Estetico Beauty Lab'),
           v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 37. Postazione filiale Perugia – accesso negato
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Banca Regionale Etruria';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Banca Regionale Etruria', 'OptiPlex 7090', 'Ing. Paolo Mattei', 'Ing. Paolo Mattei', 'high'::public.ticket_priority, 'in-progress', 'support', 'Windows 11 Pro', 'Core Banking, Office, VPN', 'L''operatore di Perugia non accede al gestionale centrale. Errore: token scaduto.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 1.5, 50, 0, 'EUR', v_now - interval '14 days', v_now - interval '14 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '14 days' - interval '45 minutes', v_now - interval '14 days', 90, 'Postazione filiale Perugia – accesso negato'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Postazione filiale Perugia – accesso negato', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Postazione filiale Perugia – accesso negato',
           'Ti è stato assegnato un ticket con priorità alta per Banca Regionale Etruria.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Banca Regionale Etruria'),
           v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 38. Firewall perimetrale – aggiornamento firmware
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Banca Regionale Etruria';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Banca Regionale Etruria', 'FortiGate 120G', 'Ing. Paolo Mattei', 'Ing. Paolo Mattei', 'high'::public.ticket_priority, 'pending', 'maintenance', 'FortiOS 7.4', '', 'Aggiornamento firmware critico per vulnerabilità CVE. Pianificare fermo notturno.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 0, 50, 0, 'EUR', v_now - interval '21 days', v_now - interval '21 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'In attesa di ricambio/approvazione. Contattare il cliente per conferma preventivo.', true, v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Firewall perimetrale – aggiornamento firmware', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'critical', v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Firewall perimetrale – aggiornamento firmware',
           'Ti è stato assegnato un ticket con priorità alta per Banca Regionale Etruria.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Banca Regionale Etruria'),
           v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 39. Audit trimestrale – verifica sicurezza filiali
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Banca Regionale Etruria';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Banca Regionale Etruria', '', 'Ing. Paolo Mattei', 'Ing. Paolo Mattei', 'med'::public.ticket_priority, 'completed', 'maintenance', '', '', 'Audit trimestrale su 15 filiali: verifica patch, backup, accessi, firewall.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 16, 50, 0, 'EUR', v_now - interval '28 days', v_now - interval '28 days', v_now - interval '25 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '28 days' - interval '480 minutes', v_now - interval '28 days', 960, 'Audit trimestrale – verifica sicurezza filiali'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Audit trimestrale – verifica sicurezza filiali', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Audit trimestrale – verifica sicurezza filiali',
           'Ti è stato assegnato un ticket con priorità media per Banca Regionale Etruria.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Banca Regionale Etruria'),
           v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 40. Nuova workstation filiale Terni – setup
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Banca Regionale Etruria';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Banca Regionale Etruria', 'OptiPlex 7090', 'Dott. Luca Barbieri', 'Dott. Luca Barbieri', 'med'::public.ticket_priority, 'completed', 'device', 'Windows 11 Pro', 'Core Banking, Office, VPN, Citrix', 'Sostituzione postazione filiale Terni. Configurare ambiente blindato.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 3, 50, 1100, 'EUR', v_now - interval '35 days', v_now - interval '35 days', v_now - interval '30 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '35 days' - interval '90 minutes', v_now - interval '35 days', 180, 'Nuova workstation filiale Terni – setup'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Nuova workstation filiale Terni – setup', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Nuova workstation filiale Terni – setup',
           'Ti è stato assegnato un ticket con priorità media per Banca Regionale Etruria.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Banca Regionale Etruria'),
           v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 41. Configurazione nuovo notebook – Marco Villa
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Tecnolab Srl';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Tecnolab Srl', 'ThinkPad X1 Carbon Gen 12', 'Roberto Mancini', 'Roberto Mancini', 'low'::public.ticket_priority, 'ready', 'device', 'Windows 11 Pro', 'Office, AutoCAD Viewer, VPN', 'Nuovo notebook per l''IT manager. Migrazione dati dal vecchio PC.', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 2, 60, 2100, 'EUR', v_now - interval '7 days', v_now - interval '7 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'Ticket in gestione.', true, v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000002'::uuid, v_now - interval '7 days' - interval '60 minutes', v_now - interval '7 days', 120, 'Configurazione nuovo notebook – Marco Villa'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Configurazione nuovo notebook – Marco Villa', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'info', v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Configurazione nuovo notebook – Marco Villa',
           'Ti è stato assegnato un ticket con priorità bassa per Tecnolab Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Tecnolab Srl'),
           v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 42. Attivazione nuova sede – setup infrastruttura
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Clinica San Luca Srl';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Clinica San Luca Srl', '', 'Dott.ssa Maria Bianchi', 'Dott.ssa Maria Bianchi', 'med'::public.ticket_priority, 'pending', 'support', '', '', 'Nuovo ambulatorio. Predisposizione rete, 4 postazioni, 1 stampante, VPN.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 0, 55, 4500, 'EUR', v_now - interval '14 days', v_now - interval '14 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Attivazione nuova sede – setup infrastruttura', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'info', v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Attivazione nuova sede – setup infrastruttura',
           'Ti è stato assegnato un ticket con priorità media per Clinica San Luca Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Clinica San Luca Srl'),
           v_now - interval '14 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 43. Migrazione a Microsoft 365
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Studio Legale Ferretti';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Studio Legale Ferretti', '', 'Avv. Carlo Ferretti', 'Avv. Carlo Ferretti', 'med'::public.ticket_priority, 'pending', 'support', '', 'Microsoft 365 Business Premium', 'Migrare da Exchange on-prem a M365. Posta, calendari, contatti, 1TB documenti.', 'a0000001-0000-4000-8000-000000000003'::uuid, v_marco, 0, 70, 240, 'EUR', v_now - interval '21 days', v_now - interval '21 days', NULL
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Migrazione a Microsoft 365', v_tid, v_marco, 'ticket_created', 'ticket', v_tid::text, 'info', v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000003'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Migrazione a Microsoft 365',
           'Ti è stato assegnato un ticket con priorità media per Studio Legale Ferretti.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Studio Legale Ferretti'),
           v_now - interval '21 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 44. Attacco phishing – analisi e bonifica
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Supermercato Alimentari & Co';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Supermercato Alimentari & Co', '', 'Giuseppe Fontana', 'Giuseppe Fontana', 'high'::public.ticket_priority, 'completed', 'support', '', '', 'Mail phishing ricevuta da 3 utenti. Un utente ha cliccato. Bonifica e verifica.', 'a0000001-0000-4000-8000-000000000003'::uuid, v_marco, 4, 70, 0, 'EUR', v_now - interval '28 days', v_now - interval '28 days', v_now - interval '0.5 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_notes (ticket_id, author_id, content, is_internal, created_at)
    SELECT v_tid, v_marco, 'Intervento completato. Verificare con il cliente la soddisfazione. Aggiornare documentazione.', true, v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000003'::uuid, v_now - interval '28 days' - interval '120 minutes', v_now - interval '28 days', 240, 'Attacco phishing – analisi e bonifica'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Attacco phishing – analisi e bonifica', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'critical', v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000003'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Attacco phishing – analisi e bonifica',
           'Ti è stato assegnato un ticket con priorità alta per Supermercato Alimentari & Co.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Supermercato Alimentari & Co'),
           v_now - interval '28 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 45. Monitoraggio 7/7 – verifica settimanale
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Hotel Palazzo della Regina';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Hotel Palazzo della Regina', '', 'Dott.ssa Lucia Contarini', 'Dott.ssa Lucia Contarini', 'low'::public.ticket_priority, 'completed', 'maintenance', '', 'PRTG, Veeam', 'Verifica settimanale: stato backup, carico server, allarmi PRTG.', 'a0000001-0000-4000-8000-000000000004'::uuid, v_marco, 1, 65, 0, 'EUR', v_now - interval '35 days', v_now - interval '35 days', v_now - interval '1 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000004'::uuid, v_now - interval '35 days' - interval '30 minutes', v_now - interval '35 days', 60, 'Monitoraggio 7/7 – verifica settimanale'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Monitoraggio 7/7 – verifica settimanale', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000004'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Monitoraggio 7/7 – verifica settimanale',
           'Ti è stato assegnato un ticket con priorità bassa per Hotel Palazzo della Regina.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Hotel Palazzo della Regina'),
           v_now - interval '35 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- 46. Sostituzione switch reparto produzione
    SELECT id INTO v_cid FROM public.clients WHERE name = 'Tecnolab Srl';
    v_did := NULL;
    SELECT id INTO v_contact FROM public.client_contacts WHERE client_id = v_cid AND is_primary = true LIMIT 1;

    INSERT INTO public.tickets (client_id, device_id, requester_contact_id, client, model, requester, end_user, priority, status, ticket_type, os, software, notes, assignee_id, created_by, billable_hours, hourly_rate, material_cost, cost_currency, created_at, updated_at, completed_at)
    SELECT v_cid, v_did, v_contact, 'Tecnolab Srl', 'Cisco CBS250-24T-4G', 'Roberto Mancini', 'Roberto Mancini', 'med'::public.ticket_priority, 'completed', 'support', 'Cisco IOS', '', 'Switch produzione non funzionante. Sostituire e riconfigurare VLAN.', 'a0000001-0000-4000-8000-000000000002'::uuid, v_marco, 2, 60, 450, 'EUR', v_now - interval '7 days', v_now - interval '7 days', v_now - interval '22 days'
    RETURNING id, ticket_code INTO v_tid, v_tcode;

    INSERT INTO public.ticket_time_entries (ticket_id, user_id, started_at, ended_at, duration_minutes, description)
    SELECT v_tid, 'a0000001-0000-4000-8000-000000000002'::uuid, v_now - interval '7 days' - interval '60 minutes', v_now - interval '7 days', 120, 'Sostituzione switch reparto produzione'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.activity_log (type, message, ticket_id, actor_id, action_type, entity_type, entity_id, severity, created_at)
    SELECT 'ticket', 'Ticket creato: Sostituzione switch reparto produzione', v_tid, v_marco, 'ticket_completed', 'ticket', v_tid::text, 'info', v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications (user_id, type, title, body, payload, created_at)
    SELECT 'a0000001-0000-4000-8000-000000000002'::uuid, 'ticket_assigned', 'Nuovo ticket assegnato: Sostituzione switch reparto produzione',
           'Ti è stato assegnato un ticket con priorità media per Tecnolab Srl.',
           jsonb_build_object('ticket_id', v_tid::text, 'client_name', 'Tecnolab Srl'),
           v_now - interval '7 days'
    WHERE v_tid IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- Aggiorna la sequenza ticket al massimo valore
    PERFORM setval('public.ticket_seq', (SELECT COALESCE(MAX((substring(ticket_code FROM '^PCT-([0-9]+)$'))::bigint), 0) FROM public.tickets), true);

END $$;
