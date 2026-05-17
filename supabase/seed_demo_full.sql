-- Comprehensive demo seed for PCReady development/QA environments.
-- The dataset is deterministic and idempotent: all records use fixed UUIDs or unique keys.
-- Do not run this file in production unless you explicitly want demo data.

BEGIN;

-- -----------------------------------------------------------------------------
-- Demo user references.
-- This seed does not create auth users: it reuses the first three existing users.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM auth.users) < 3 THEN
    RAISE EXCEPTION 'seed_demo_full requires at least 3 existing auth users';
  END IF;
END $$;

INSERT INTO public.profiles (id, full_name, initials, created_at)
VALUES
  ((SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), 'Admin Demo', 'AD', now() - interval '90 days'),
  ((SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), 'Tecnico Demo', 'TD', now() - interval '88 days'),
  ((SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 3), 'Viewer Demo', 'VD', now() - interval '70 days')
ON CONFLICT (id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    initials = EXCLUDED.initials;

INSERT INTO public.user_profiles (
  id,
  display_name,
  avatar_url,
  phone,
  timezone,
  language,
  preferred_theme,
  password_set,
  notify_ticket_assigned,
  notify_ticket_status_changed,
  notify_automation_failed,
  notify_device_status_changed,
  notify_checklist_completed,
  notify_mentions,
  notify_ticket_completed,
  email_notify_ticket_assigned,
  email_notify_ticket_status_changed,
  email_notify_ticket_completed,
  email_notify_automation_failed,
  email_notify_device_status_changed,
  email_notify_checklist_completed,
  email_notify_mentions,
  created_at,
  updated_at
)
VALUES
  (
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1),
    'Admin Demo',
    'https://example.com/avatars/admin-demo.png',
    '+39 02 0000001',
    'Europe/Rome',
    'it',
    'system',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    now() - interval '90 days',
    now() - interval '1 day'
  ),
  (
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2),
    'Tecnico Demo',
    'https://example.com/avatars/tecnico-demo.png',
    '+39 02 0000002',
    'Europe/Rome',
    'it',
    'light',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    now() - interval '88 days',
    now() - interval '2 hours'
  ),
  (
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 3),
    'Viewer Demo',
    'https://example.com/avatars/viewer-demo.png',
    '+39 02 0000003',
    'Europe/Rome',
    'it',
    'dark',
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    now() - interval '70 days',
    now() - interval '3 days'
  )
ON CONFLICT (id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    phone = EXCLUDED.phone,
    timezone = EXCLUDED.timezone,
    language = EXCLUDED.language,
    preferred_theme = EXCLUDED.preferred_theme,
    password_set = EXCLUDED.password_set,
    notify_ticket_assigned = EXCLUDED.notify_ticket_assigned,
    notify_ticket_status_changed = EXCLUDED.notify_ticket_status_changed,
    notify_automation_failed = EXCLUDED.notify_automation_failed,
    notify_device_status_changed = EXCLUDED.notify_device_status_changed,
    notify_checklist_completed = EXCLUDED.notify_checklist_completed,
    notify_mentions = EXCLUDED.notify_mentions,
    notify_ticket_completed = EXCLUDED.notify_ticket_completed,
    email_notify_ticket_assigned = EXCLUDED.email_notify_ticket_assigned,
    email_notify_ticket_status_changed = EXCLUDED.email_notify_ticket_status_changed,
    email_notify_ticket_completed = EXCLUDED.email_notify_ticket_completed,
    email_notify_automation_failed = EXCLUDED.email_notify_automation_failed,
    email_notify_device_status_changed = EXCLUDED.email_notify_device_status_changed,
    email_notify_checklist_completed = EXCLUDED.email_notify_checklist_completed,
    email_notify_mentions = EXCLUDED.email_notify_mentions,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ((SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), 'admin'),
  ((SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), 'tech'),
  ((SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 3), 'viewer')
ON CONFLICT (user_id, role) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Clients, contacts and assets.
-- -----------------------------------------------------------------------------
INSERT INTO public.clients (
  id,
  name,
  company_name,
  vat_number,
  fiscal_code,
  address,
  email,
  phone,
  notes,
  website_url,
  portal_enabled,
  portal_logo_url,
  portal_primary_color,
  portal_welcome_message,
  portal_name,
  created_at,
  updated_at
)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'Tecnolab Srl',
    'Tecnolab Srl',
    'IT12345678901',
    '12345678901',
    'Via Roma 12, 20121 Milano MI',
    'amministrazione@tecnolab.example',
    '+39 02 1234567',
    'Cliente PMI con parco macchine Windows e contratti SLA standard.',
    'https://tecnolab.example',
    true,
    'https://tecnolab.example/logo.png',
    '#1B4FD8',
    'Benvenuto nel portale assistenza Tecnolab.',
    'Portale Tecnolab',
    now() - interval '80 days',
    now() - interval '1 day'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'Clinica San Luca Srl',
    'Clinica San Luca Srl',
    'IT67890123456',
    '67890123456',
    'Via San Luca 18, 50100 Firenze FI',
    'it@clinicasanluca.example',
    '+39 055 1122334',
    'Cliente sanitario con dispositivi critici, backup giornaliero e reperibilità.',
    'https://clinicasanluca.example',
    true,
    'https://clinicasanluca.example/logo.png',
    '#0F766E',
    'Apri richieste e consulta lo stato degli interventi IT della clinica.',
    'Helpdesk Clinica San Luca',
    now() - interval '65 days',
    now() - interval '6 hours'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'Studio Legale Ferretti',
    'Studio Legale Ferretti Associati',
    'IT34567890123',
    '34567890123',
    'Corso Vittorio 45, 10128 Torino TO',
    'segreteria@ferretti.example',
    '+39 011 2345678',
    'Studio professionale con esigenze di cifratura, firma digitale e conservazione documentale.',
    'https://ferretti.example',
    true,
    'https://ferretti.example/logo.png',
    '#7C3AED',
    'Area riservata per richieste IT e aggiornamenti ticket.',
    'Portale Studio Ferretti',
    now() - interval '50 days',
    now() - interval '12 hours'
  )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    company_name = EXCLUDED.company_name,
    vat_number = EXCLUDED.vat_number,
    fiscal_code = EXCLUDED.fiscal_code,
    address = EXCLUDED.address,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    notes = EXCLUDED.notes,
    website_url = EXCLUDED.website_url,
    portal_enabled = EXCLUDED.portal_enabled,
    portal_logo_url = EXCLUDED.portal_logo_url,
    portal_primary_color = EXCLUDED.portal_primary_color,
    portal_welcome_message = EXCLUDED.portal_welcome_message,
    portal_name = EXCLUDED.portal_name,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.client_contacts (
  id,
  client_id,
  first_name,
  last_name,
  full_name,
  email,
  phone,
  role,
  job_title,
  department,
  is_primary,
  notes,
  portal_password_hash,
  portal_password_updated_at,
  created_at,
  updated_at
)
VALUES
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'Luca',
    'Rossi',
    'Luca Rossi',
    'luca.rossi@tecnolab.example',
    '+39 345 1112222',
    'Responsabile IT',
    'IT Manager',
    'IT',
    true,
    'Referente primario per escalation e approvazioni acquisti.',
    'demo-portal-password-hash-luca',
    now() - interval '20 days',
    now() - interval '80 days',
    now() - interval '1 day'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'Alessandro',
    'Romano',
    'Alessandro Romano',
    'alessandro.romano@clinicasanluca.example',
    '+39 345 2121212',
    'Responsabile IT',
    'Responsabile Sistemi',
    'Direzione sanitaria',
    true,
    'Contatto autorizzato per interventi su dispositivi medicali e backup.',
    'demo-portal-password-hash-alessandro',
    now() - interval '18 days',
    now() - interval '65 days',
    now() - interval '6 hours'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'Anna',
    'Galli',
    'Anna Galli',
    'anna.galli@ferretti.example',
    '+39 349 2020202',
    'Amministrativo',
    'Office Manager',
    'Segreteria',
    true,
    'Gestisce richieste software, firme digitali e documentazione.',
    'demo-portal-password-hash-anna',
    now() - interval '14 days',
    now() - interval '50 days',
    now() - interval '12 hours'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'Maria',
    'Conti',
    'Maria Conti',
    'maria.conti@tecnolab.example',
    '+39 347 3334444',
    'Amministrazione',
    'Accounting Specialist',
    'Finance',
    false,
    'Referente per fatture, contratti e scadenze canoni.',
    'demo-portal-password-hash-maria',
    now() - interval '10 days',
    now() - interval '79 days',
    now() - interval '2 days'
  )
ON CONFLICT (id) DO UPDATE
SET client_id = EXCLUDED.client_id,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    job_title = EXCLUDED.job_title,
    department = EXCLUDED.department,
    is_primary = EXCLUDED.is_primary,
    notes = EXCLUDED.notes,
    portal_password_hash = EXCLUDED.portal_password_hash,
    portal_password_updated_at = EXCLUDED.portal_password_updated_at,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.devices (
  id,
  client_id,
  serial,
  model,
  os,
  assigned_to,
  status,
  notes,
  created_by,
  brand,
  device_type,
  cpu_name,
  cpu_cores,
  cpu_frequency_ghz,
  ram_gb,
  ram_type,
  ram_frequency_mhz,
  storage_type,
  storage_capacity_gb,
  storage_drive_count,
  screen_size_inches,
  screen_resolution,
  screen_type,
  wifi,
  bluetooth,
  ethernet,
  os_version,
  os_architecture,
  purchase_date,
  purchase_cost,
  warranty_expiry_date,
  warranty_provider,
  warranty_type,
  warranty_notes,
  location_office,
  location_floor,
  location_desk,
  created_at,
  updated_at
)
VALUES
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'TL-7430-001',
    'Latitude 7430',
    'Windows 11 Pro',
    'Luca Rossi',
    'assigned',
    'Notebook principale del responsabile IT con BitLocker attivo.',
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1),
    'Dell',
    'Notebook',
    'Intel Core i7-1265U',
    10,
    4.80,
    32,
    'LPDDR5',
    5200,
    'NVMe SSD',
    1024,
    1,
    14.0,
    '1920x1080',
    'IPS matte',
    'Intel Wi-Fi 6E AX211',
    'Bluetooth 5.3',
    'USB-C Ethernet Adapter',
    '23H2',
    'x64',
    current_date - interval '420 days',
    1480.00,
    current_date + interval '675 days',
    'Dell ProSupport',
    'onsite',
    'Garanzia estesa fino a fine contratto.',
    'Milano',
    '2',
    'IT-12',
    now() - interval '75 days',
    now() - interval '5 hours'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'CSL-840-014',
    'EliteBook 840 G10',
    'Windows 11 Pro',
    'Alessandro Romano',
    'maintenance',
    'In verifica per sostituzione batteria e test backup agent.',
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2),
    'HP',
    'Notebook',
    'Intel Core i5-1335U',
    10,
    4.60,
    16,
    'DDR5',
    4800,
    'NVMe SSD',
    512,
    1,
    14.0,
    '1920x1200',
    'IPS privacy',
    'Intel Wi-Fi 6E AX211',
    'Bluetooth 5.3',
    '1GbE Dock',
    '23H2',
    'x64',
    current_date - interval '260 days',
    1190.00,
    current_date + interval '835 days',
    'HP Care Pack',
    'onsite',
    'Copertura danni accidentali inclusa.',
    'Firenze',
    '1',
    'LAB-03',
    now() - interval '64 days',
    now() - interval '4 hours'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'SLF-MBP-020',
    'MacBook Pro 14',
    'macOS Sonoma',
    'Anna Galli',
    'assigned',
    'Dispositivo cifrato FileVault con suite Office e firma digitale.',
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1),
    'Apple',
    'Notebook',
    'Apple M3 Pro',
    11,
    4.10,
    18,
    'Unified Memory',
    6400,
    'Apple SSD',
    1024,
    1,
    14.2,
    '3024x1964',
    'Liquid Retina XDR',
    'Wi-Fi 6E',
    'Bluetooth 5.3',
    'USB-C Ethernet Adapter',
    '14.4',
    'arm64',
    current_date - interval '120 days',
    2499.00,
    current_date + interval '610 days',
    'AppleCare for Business',
    'extended',
    'Copertura prioritaria per studio legale.',
    'Torino',
    '3',
    'SEG-07',
    now() - interval '49 days',
    now() - interval '3 hours'
  )
ON CONFLICT (id) DO UPDATE
SET client_id = EXCLUDED.client_id,
    serial = EXCLUDED.serial,
    model = EXCLUDED.model,
    os = EXCLUDED.os,
    assigned_to = EXCLUDED.assigned_to,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    created_by = EXCLUDED.created_by,
    brand = EXCLUDED.brand,
    device_type = EXCLUDED.device_type,
    cpu_name = EXCLUDED.cpu_name,
    cpu_cores = EXCLUDED.cpu_cores,
    cpu_frequency_ghz = EXCLUDED.cpu_frequency_ghz,
    ram_gb = EXCLUDED.ram_gb,
    ram_type = EXCLUDED.ram_type,
    ram_frequency_mhz = EXCLUDED.ram_frequency_mhz,
    storage_type = EXCLUDED.storage_type,
    storage_capacity_gb = EXCLUDED.storage_capacity_gb,
    storage_drive_count = EXCLUDED.storage_drive_count,
    screen_size_inches = EXCLUDED.screen_size_inches,
    screen_resolution = EXCLUDED.screen_resolution,
    screen_type = EXCLUDED.screen_type,
    wifi = EXCLUDED.wifi,
    bluetooth = EXCLUDED.bluetooth,
    ethernet = EXCLUDED.ethernet,
    os_version = EXCLUDED.os_version,
    os_architecture = EXCLUDED.os_architecture,
    purchase_date = EXCLUDED.purchase_date,
    purchase_cost = EXCLUDED.purchase_cost,
    warranty_expiry_date = EXCLUDED.warranty_expiry_date,
    warranty_provider = EXCLUDED.warranty_provider,
    warranty_type = EXCLUDED.warranty_type,
    warranty_notes = EXCLUDED.warranty_notes,
    location_office = EXCLUDED.location_office,
    location_floor = EXCLUDED.location_floor,
    location_desk = EXCLUDED.location_desk,
    updated_at = EXCLUDED.updated_at;

-- -----------------------------------------------------------------------------
-- Configuration entities.
-- -----------------------------------------------------------------------------
INSERT INTO public.checklist_templates (id, name, description, structure, is_default, created_by, created_at, updated_at)
VALUES
  (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    'Preparazione PC aziendale completa',
    'Installazione, sicurezza, software base e consegna utente.',
    '{"setup":{"label":"Preparazione","items":[{"id":"os","text":"Installazione sistema operativo"},{"id":"security","text":"Cifratura e antivirus"},{"id":"apps","text":"Installazione software aziendali"},{"id":"handover","text":"Verbale di consegna firmato"}]}}'::jsonb,
    true,
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1),
    now() - interval '70 days',
    now() - interval '1 day'
  ),
  (
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    'Manutenzione trimestrale workstation',
    'Controlli periodici hardware, aggiornamenti e backup.',
    '{"maintenance":{"label":"Manutenzione","items":[{"id":"updates","text":"Aggiornamenti OS e driver"},{"id":"backup","text":"Verifica ultimo backup"},{"id":"health","text":"Controllo stato disco e batteria"},{"id":"report","text":"Report cliente"}]}}'::jsonb,
    false,
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2),
    now() - interval '60 days',
    now() - interval '2 days'
  )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    structure = EXCLUDED.structure,
    is_default = EXCLUDED.is_default,
    created_by = EXCLUDED.created_by,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.email_templates (id, event_type, subject, body_html, body_text, variables, is_active, last_modified_by, last_modified_at, created_at)
VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'invite', '[{{organization_name}}] Invito account', '<p>Ciao {{user_name}}, imposta la password da {{invite_link}}.</p>', 'Ciao {{user_name}}, imposta la password da {{invite_link}}.', '["organization_name","user_name","invite_link"]'::jsonb, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '2 days', now() - interval '70 days'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'reset_password', '[{{organization_name}}] Reset password', '<p>Usa {{reset_link}} per reimpostare la password.</p>', 'Usa {{reset_link}} per reimpostare la password.', '["organization_name","reset_link"]'::jsonb, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '2 days', now() - interval '70 days'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3', 'confirm_account', '[{{organization_name}}] Conferma account', '<p>Conferma il tuo account: {{confirm_link}}.</p>', 'Conferma il tuo account: {{confirm_link}}.', '["organization_name","confirm_link"]'::jsonb, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '2 days', now() - interval '70 days'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4', 'ticket_assigned', '[{{organization_name}}] Ticket {{ticket_code}} assegnato', '<p>Ticket {{ticket_code}} assegnato a {{user_name}}.</p>', 'Ticket {{ticket_code}} assegnato a {{user_name}}.', '["organization_name","ticket_code","user_name"]'::jsonb, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '2 days', now() - interval '65 days'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5', 'checklist_completed', '[{{organization_name}}] Checklist completata', '<p>Checklist {{checklist_name}} completata per {{ticket_code}}.</p>', 'Checklist {{checklist_name}} completata per {{ticket_code}}.', '["organization_name","checklist_name","ticket_code"]'::jsonb, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '2 days', now() - interval '65 days'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6', 'ticket_completed', '[{{organization_name}}] Ticket {{ticket_code}} completato', '<p>Ticket {{ticket_code}} completato il {{completed_date}}.</p>', 'Ticket {{ticket_code}} completato il {{completed_date}}.', '["organization_name","ticket_code","completed_date"]'::jsonb, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '2 days', now() - interval '60 days'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee7', 'portal_ticket_created', '[{{organization_name}}] Ticket ricevuto', '<p>Richiesta {{ticket_code}} ricevuta dal portale.</p>', 'Richiesta {{ticket_code}} ricevuta dal portale.', '["organization_name","ticket_code"]'::jsonb, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '2 days', now() - interval '20 days'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee8', 'portal_ticket_status_changed', '[{{organization_name}}] Ticket aggiornato', '<p>Ticket {{ticket_code}} ora in stato {{ticket_status}}.</p>', 'Ticket {{ticket_code}} ora in stato {{ticket_status}}.', '["organization_name","ticket_code","ticket_status"]'::jsonb, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '2 days', now() - interval '20 days'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee9', 'portal_public_note_added', '[{{organization_name}}] Nuova nota pubblica', '<p>Nuova nota per {{ticket_code}}: {{note_excerpt}}.</p>', 'Nuova nota per {{ticket_code}}: {{note_excerpt}}.', '["organization_name","ticket_code","note_excerpt"]'::jsonb, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '2 days', now() - interval '20 days'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10', 'portal_ticket_closed_feedback', '[{{organization_name}}] Valuta il ticket', '<p>Lascia un feedback per {{ticket_code}}: {{feedback_link}}.</p>', 'Lascia un feedback per {{ticket_code}}: {{feedback_link}}.', '["organization_name","ticket_code","feedback_link"]'::jsonb, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '2 days', now() - interval '20 days')
ON CONFLICT (event_type) DO UPDATE
SET subject = EXCLUDED.subject,
    body_html = EXCLUDED.body_html,
    body_text = EXCLUDED.body_text,
    variables = EXCLUDED.variables,
    is_active = EXCLUDED.is_active,
    last_modified_by = EXCLUDED.last_modified_by,
    last_modified_at = EXCLUDED.last_modified_at;

INSERT INTO public.scripts (id, name, category, description, language, content, icon, color, created_by, created_at, updated_at)
VALUES
  ('ffffffff-ffff-4fff-8fff-fffffffffff1', 'Inventario hardware dettagliato', 'Inventario', 'Raccoglie CPU, RAM, storage e versione OS.', 'powershell', 'Get-ComputerInfo | Select-Object CsName,OsName,OsVersion,CsProcessors,CsTotalPhysicalMemory', 'terminal', '#2563EB', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '55 days', now() - interval '1 day'),
  ('ffffffff-ffff-4fff-8fff-fffffffffff2', 'Pulizia cache e temp Windows', 'Manutenzione', 'Esegue pulizia sicura delle directory temporanee utente e sistema.', 'powershell', 'Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue', 'trash', '#059669', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '52 days', now() - interval '2 days')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    language = EXCLUDED.language,
    content = EXCLUDED.content,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    created_by = EXCLUDED.created_by,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.automation_rules (id, trigger_text, action_text, active, count, sort, category, description, last_run_at, created_at)
VALUES
  ('abababab-abab-4bab-8bab-ababababab01', 'Ticket alta priorità creato', 'Assegna tecnico e invia notifica immediata', true, 12, 1, 'SLA', 'Automazione dimostrativa per gestione urgenze.', now() - interval '6 hours', now() - interval '45 days'),
  ('abababab-abab-4bab-8bab-ababababab02', 'Checklist completata al 100%', 'Sposta ticket in testing e notifica il cliente', true, 8, 2, 'Checklist', 'Automazione per avanzamento stati da checklist.', now() - interval '1 day', now() - interval '40 days')
ON CONFLICT (id) DO UPDATE
SET trigger_text = EXCLUDED.trigger_text,
    action_text = EXCLUDED.action_text,
    active = EXCLUDED.active,
    count = EXCLUDED.count,
    sort = EXCLUDED.sort,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    last_run_at = EXCLUDED.last_run_at;

INSERT INTO public.automation_flows (
  id,
  name,
  description,
  category,
  active,
  version,
  flow_definition,
  trigger_definition,
  conditions_definition,
  actions_definition,
  schedule_definition,
  summary,
  last_run_at,
  created_by,
  updated_by,
  created_at,
  updated_at
)
VALUES
  (
    'acacacac-acac-4cac-8cac-acacacacac01',
    'Notifica SLA in scadenza',
    'Invia una notifica al tecnico quando un ticket si avvicina alla scadenza SLA.',
    'SLA',
    true,
    2,
    '{"nodes":[{"id":"trigger","type":"trigger","data":{"type":"trigger","triggerType":"ticket_sla_due"}},{"id":"notify","type":"action","data":{"type":"action","actionType":"notify_assignee"}}],"edges":[{"from":"trigger","to":"notify"}]}'::jsonb,
    '{"type":"ticket_sla_due","minutesBefore":60}'::jsonb,
    '{"all":[{"field":"status","operator":"not_in","value":["completed","archived"]}]}'::jsonb,
    '{"actions":[{"type":"notify_assignee","channel":"in_app"}]}'::jsonb,
    '{"type":"interval","everyMinutes":30}'::jsonb,
    'Controllo periodico SLA e notifica tecnico assegnato.',
    now() - interval '30 minutes',
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1),
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1),
    now() - interval '30 days',
    now() - interval '30 minutes'
  )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    active = EXCLUDED.active,
    version = EXCLUDED.version,
    flow_definition = EXCLUDED.flow_definition,
    trigger_definition = EXCLUDED.trigger_definition,
    conditions_definition = EXCLUDED.conditions_definition,
    actions_definition = EXCLUDED.actions_definition,
    schedule_definition = EXCLUDED.schedule_definition,
    summary = EXCLUDED.summary,
    last_run_at = EXCLUDED.last_run_at,
    updated_by = EXCLUDED.updated_by,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.audit_presets (id, name, filters, user_id, created_at, updated_at)
VALUES
  ('adadadad-adad-4dad-8dad-adadadadad01', 'Azioni critiche ultimi 30 giorni', '{"severity":["warning","error"],"range":"30d","entity_type":["tickets","devices"]}'::jsonb, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '15 days', now() - interval '1 day'),
  ('adadadad-adad-4dad-8dad-adadadadad02', 'Attività ticket personali', '{"entity_type":["tickets"],"actor":"me","range":"7d"}'::jsonb, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '10 days', now() - interval '2 days')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    filters = EXCLUDED.filters,
    user_id = EXCLUDED.user_id,
    updated_at = EXCLUDED.updated_at;

-- Minimal technical OAuth client for local API/Swagger tests. Runtime auth codes/consents are not seeded.
INSERT INTO public.oauth_clients (id, client_id, client_secret, name, description, redirect_uris, scopes_allowed, status, last_used_at, created_by, created_at, updated_at)
VALUES (
  'aeaeaeae-aeae-4eae-8eae-aeaeaeaeae01',
  'pcready-demo-client',
  'demo-secret-change-me',
  'PCReady Demo OAuth Client',
  'Client tecnico per test locali OAuth/OpenAPI in ambiente QA.',
  ARRAY['http://localhost:5173/oauth/callback', 'https://example.com/oauth/callback'],
  ARRAY['openid', 'profile', 'email', 'pcready:read']::public.oauth_scope[],
  'active',
  now() - interval '7 days',
  (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1),
  now() - interval '25 days',
  now() - interval '7 days'
)
ON CONFLICT (client_id) DO UPDATE
SET client_secret = EXCLUDED.client_secret,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    redirect_uris = EXCLUDED.redirect_uris,
    scopes_allowed = EXCLUDED.scopes_allowed,
    status = EXCLUDED.status,
    last_used_at = EXCLUDED.last_used_at,
    updated_at = EXCLUDED.updated_at;

-- -----------------------------------------------------------------------------
-- Contracts, bundles and assignments.
-- -----------------------------------------------------------------------------
INSERT INTO public.client_contracts (id, client_id, name, status, billing_period, recurring_fee, included_hours, extra_hourly_rate, start_date, end_date, notes, created_at, updated_at)
VALUES
  ('b0b0b0b0-b0b0-40b0-80b0-b0b0b0b0b001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Contratto assistenza Standard 2026', 'active', 'monthly', 220.00, 8.00, 70.00, current_date - interval '90 days', current_date + interval '275 days', 'Canone mensile con 8 ore incluse e interventi remoti prioritari.', now() - interval '90 days', now() - interval '3 days'),
  ('b0b0b0b0-b0b0-40b0-80b0-b0b0b0b0b002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Contratto sanitario Premium 2026', 'active', 'annual', 4200.00, 60.00, 85.00, current_date - interval '120 days', current_date + interval '245 days', 'SLA avanzato per dispositivi critici e backup.', now() - interval '120 days', now() - interval '2 days')
ON CONFLICT (id) DO UPDATE
SET client_id = EXCLUDED.client_id,
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    billing_period = EXCLUDED.billing_period,
    recurring_fee = EXCLUDED.recurring_fee,
    included_hours = EXCLUDED.included_hours,
    extra_hourly_rate = EXCLUDED.extra_hourly_rate,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    notes = EXCLUDED.notes,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.assistance_bundles (id, name, description, billing_type, fee, currency, included_hours, extra_hourly_rate, sla_response_hours, sla_resolution_hours, included_onsite_visits, remote_support, ticket_priority, auto_renew, active, created_by, created_at, updated_at)
VALUES
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b001', 'Demo Standard PMI', 'Pacchetto con supporto remoto, 20 ore incluse e due visite onsite.', 'annual', 1200.00, 'EUR', 20.00, 70.00, 4.00, 48.00, 2, true, 'med', true, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '45 days', now() - interval '1 day'),
  ('b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b002', 'Demo Premium Sanità', 'Pacchetto premium con SLA rapido, 60 ore e visite onsite incluse.', 'annual', 3600.00, 'EUR', 60.00, 85.00, 1.00, 8.00, 8, true, 'high', true, true, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '45 days', now() - interval '1 day')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    billing_type = EXCLUDED.billing_type,
    fee = EXCLUDED.fee,
    currency = EXCLUDED.currency,
    included_hours = EXCLUDED.included_hours,
    extra_hourly_rate = EXCLUDED.extra_hourly_rate,
    sla_response_hours = EXCLUDED.sla_response_hours,
    sla_resolution_hours = EXCLUDED.sla_resolution_hours,
    included_onsite_visits = EXCLUDED.included_onsite_visits,
    remote_support = EXCLUDED.remote_support,
    ticket_priority = EXCLUDED.ticket_priority,
    auto_renew = EXCLUDED.auto_renew,
    active = EXCLUDED.active,
    created_by = EXCLUDED.created_by,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.client_bundle_assignments (id, client_id, bundle_id, status, start_date, end_date, auto_renew, renewal_mode, custom_fee, custom_included_hours, custom_extra_hourly_rate, custom_sla_response_hours, custom_sla_resolution_hours, custom_included_onsite_visits, notes, created_by, created_at, updated_at)
VALUES
  ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b001', 'active', current_date - interval '90 days', current_date + interval '275 days', true, 'automatic', 1100.00, 22.00, 68.00, 4.00, 36.00, 3, 'Override commerciale concordato per rinnovo annuale Tecnolab.', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '45 days', now() - interval '1 day'),
  ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b002', 'active', current_date - interval '120 days', current_date + interval '245 days', true, 'manual', 3900.00, 65.00, 80.00, 1.00, 6.00, 10, 'Pacchetto con estensione onsite per laboratorio clinico.', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '44 days', now() - interval '2 days')
ON CONFLICT (id) DO UPDATE
SET client_id = EXCLUDED.client_id,
    bundle_id = EXCLUDED.bundle_id,
    status = EXCLUDED.status,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    auto_renew = EXCLUDED.auto_renew,
    renewal_mode = EXCLUDED.renewal_mode,
    custom_fee = EXCLUDED.custom_fee,
    custom_included_hours = EXCLUDED.custom_included_hours,
    custom_extra_hourly_rate = EXCLUDED.custom_extra_hourly_rate,
    custom_sla_response_hours = EXCLUDED.custom_sla_response_hours,
    custom_sla_resolution_hours = EXCLUDED.custom_sla_resolution_hours,
    custom_included_onsite_visits = EXCLUDED.custom_included_onsite_visits,
    notes = EXCLUDED.notes,
    created_by = EXCLUDED.created_by,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.bundle_fee_payments (id, client_bundle_assignment_id, client_id, amount, currency, period_start, period_end, paid_at, status, notes, created_by, created_at)
VALUES
  ('b3b3b3b3-b3b3-43b3-83b3-b3b3b3b3b001', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 1100.00, 'EUR', date_trunc('year', current_date)::date, (date_trunc('year', current_date) + interval '1 year - 1 day')::date, current_date - interval '20 days', 'paid', 'Canone annuale saldato con bonifico SEPA.', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '20 days'),
  ('b3b3b3b3-b3b3-43b3-83b3-b3b3b3b3b002', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 3900.00, 'EUR', date_trunc('year', current_date)::date, (date_trunc('year', current_date) + interval '1 year - 1 day')::date, current_date - interval '35 days', 'paid', 'Canone premium fatturato a inizio contratto.', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '35 days')
ON CONFLICT (id) DO UPDATE
SET client_bundle_assignment_id = EXCLUDED.client_bundle_assignment_id,
    client_id = EXCLUDED.client_id,
    amount = EXCLUDED.amount,
    currency = EXCLUDED.currency,
    period_start = EXCLUDED.period_start,
    period_end = EXCLUDED.period_end,
    paid_at = EXCLUDED.paid_at,
    status = EXCLUDED.status,
    notes = EXCLUDED.notes,
    created_by = EXCLUDED.created_by;

-- -----------------------------------------------------------------------------
-- Tickets and ticket-related domain tables.
-- -----------------------------------------------------------------------------
INSERT INTO public.tickets (
  id,
  ticket_code,
  client,
  model,
  serial,
  requester,
  end_user,
  priority,
  status,
  assignee_id,
  os,
  software,
  notes,
  checklist,
  created_by,
  client_id,
  device_id,
  requester_contact_id,
  template_id,
  checklist_structure,
  ticket_type,
  category,
  closed_at,
  completed_at,
  public_notes,
  source,
  due_date,
  sla_deadline,
  sla_breached,
  sla_response_at,
  repair_cost,
  billable_hours,
  hourly_rate,
  material_cost,
  cost_currency,
  cost_notes,
  bundle_assignment_id,
  bundle_extra_hours,
  bundle_extra_amount,
  onsite_visit,
  sla_response_due_at,
  sla_resolution_due_at,
  created_at,
  updated_at
)
VALUES
  (
    'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001',
    'PCT-90001',
    'Tecnolab Srl',
    'Latitude 7430',
    'TL-7430-001',
    'Luca Rossi',
    'Luca Rossi',
    'high',
    'in-progress',
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2),
    'Windows 11 Pro',
    'Microsoft 365, VPN, EDR',
    'VPN intermittente e profilo Outlook da riconfigurare.',
    '{"os":true,"security":true,"apps":false,"handover":false}'::jsonb,
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    '{"setup":{"label":"Preparazione","items":[{"id":"os","text":"Installazione sistema operativo"},{"id":"security","text":"Cifratura e antivirus"},{"id":"apps","text":"Installazione software aziendali"},{"id":"handover","text":"Verbale di consegna firmato"}]}}'::jsonb,
    'support',
    'Networking',
    NULL,
    NULL,
    'Stiamo verificando la configurazione VPN e aggiorneremo il ticket entro oggi.',
    'internal',
    now() + interval '2 days',
    now() + interval '4 hours',
    false,
    now() - interval '1 hour',
    0.00,
    1.50,
    68.00,
    15.00,
    'EUR',
    'Materiale: adattatore USB-C Ethernet di test.',
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b001',
    0.00,
    0.00,
    false,
    now() + interval '1 hour',
    now() + interval '4 hours',
    now() - interval '1 day',
    now() - interval '30 minutes'
  ),
  (
    'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002',
    'PCT-90002',
    'Clinica San Luca Srl',
    'EliteBook 840 G10',
    'CSL-840-014',
    'Alessandro Romano',
    'Alessandro Romano',
    'high',
    'completed',
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2),
    'Windows 11 Pro',
    'Backup Agent, Gestionale Clinica',
    'Sostituzione batteria completata e backup agent verificato.',
    '{"updates":true,"backup":true,"health":true,"report":true}'::jsonb,
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
    '{"maintenance":{"label":"Manutenzione","items":[{"id":"updates","text":"Aggiornamenti OS e driver"},{"id":"backup","text":"Verifica ultimo backup"},{"id":"health","text":"Controllo stato disco e batteria"},{"id":"report","text":"Report cliente"}]}}'::jsonb,
    'maintenance',
    'Hardware',
    now() - interval '2 days',
    now() - interval '2 days',
    'Intervento completato. Batteria sostituita e backup verificato correttamente.',
    'portal',
    now() - interval '1 day',
    now() - interval '2 days',
    false,
    now() - interval '5 days',
    145.00,
    2.75,
    80.00,
    145.00,
    'EUR',
    'Ricambio batteria originale HP.',
    'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b002',
    0.00,
    0.00,
    true,
    now() - interval '5 days',
    now() - interval '2 days',
    now() - interval '6 days',
    now() - interval '2 days'
  ),
  (
    'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c003',
    'PCT-90003',
    'Studio Legale Ferretti',
    'MacBook Pro 14',
    'SLF-MBP-020',
    'Anna Galli',
    'Anna Galli',
    'med',
    'testing',
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2),
    'macOS Sonoma',
    'Microsoft 365, Firma digitale, VPN SSL',
    'Configurazione firma digitale e accesso VPN per lavoro remoto.',
    '{"os":true,"security":true,"apps":true,"handover":false}'::jsonb,
    (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3',
    'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    '{"setup":{"label":"Preparazione","items":[{"id":"os","text":"Installazione sistema operativo"},{"id":"security","text":"Cifratura e antivirus"},{"id":"apps","text":"Installazione software aziendali"},{"id":"handover","text":"Verbale di consegna firmato"}]}}'::jsonb,
    'device',
    'Onboarding',
    NULL,
    NULL,
    'Configurazione completata, in attesa di test firma digitale con smart card.',
    'internal',
    now() + interval '5 days',
    now() + interval '24 hours',
    false,
    now() - interval '2 hours',
    0.00,
    1.25,
    75.00,
    0.00,
    'EUR',
    'Ore comprese nel contratto; nessun materiale.',
    NULL,
    0.00,
    0.00,
    false,
    now() + interval '4 hours',
    now() + interval '24 hours',
    now() - interval '2 days',
    now() - interval '1 hour'
  )
ON CONFLICT (id) DO UPDATE
SET ticket_code = EXCLUDED.ticket_code,
    client = EXCLUDED.client,
    model = EXCLUDED.model,
    serial = EXCLUDED.serial,
    requester = EXCLUDED.requester,
    end_user = EXCLUDED.end_user,
    priority = EXCLUDED.priority,
    status = EXCLUDED.status,
    assignee_id = EXCLUDED.assignee_id,
    os = EXCLUDED.os,
    software = EXCLUDED.software,
    notes = EXCLUDED.notes,
    checklist = EXCLUDED.checklist,
    created_by = EXCLUDED.created_by,
    client_id = EXCLUDED.client_id,
    device_id = EXCLUDED.device_id,
    requester_contact_id = EXCLUDED.requester_contact_id,
    template_id = EXCLUDED.template_id,
    checklist_structure = EXCLUDED.checklist_structure,
    ticket_type = EXCLUDED.ticket_type,
    category = EXCLUDED.category,
    closed_at = EXCLUDED.closed_at,
    completed_at = EXCLUDED.completed_at,
    public_notes = EXCLUDED.public_notes,
    source = EXCLUDED.source,
    due_date = EXCLUDED.due_date,
    sla_deadline = EXCLUDED.sla_deadline,
    sla_breached = EXCLUDED.sla_breached,
    sla_response_at = EXCLUDED.sla_response_at,
    repair_cost = EXCLUDED.repair_cost,
    billable_hours = EXCLUDED.billable_hours,
    hourly_rate = EXCLUDED.hourly_rate,
    material_cost = EXCLUDED.material_cost,
    cost_currency = EXCLUDED.cost_currency,
    cost_notes = EXCLUDED.cost_notes,
    bundle_assignment_id = EXCLUDED.bundle_assignment_id,
    bundle_extra_hours = EXCLUDED.bundle_extra_hours,
    bundle_extra_amount = EXCLUDED.bundle_extra_amount,
    onsite_visit = EXCLUDED.onsite_visit,
    sla_response_due_at = EXCLUDED.sla_response_due_at,
    sla_resolution_due_at = EXCLUDED.sla_resolution_due_at,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.ticket_notes (id, ticket_id, author_id, content, is_internal, created_at)
VALUES
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c001', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), 'Verificata configurazione VPN: problema riproducibile solo su rete guest cliente.', true, now() - interval '18 hours'),
  ('c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c002', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), 'Batteria sostituita, ciclo di carica completato e backup agent verificato.', false, now() - interval '2 days')
ON CONFLICT (id) DO UPDATE
SET ticket_id = EXCLUDED.ticket_id,
    author_id = EXCLUDED.author_id,
    content = EXCLUDED.content,
    is_internal = EXCLUDED.is_internal;

INSERT INTO public.ticket_attachments (id, ticket_id, note_id, storage_bucket, storage_path, file_name, file_size, mime_type, uploaded_by, created_at)
VALUES
  ('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c001', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c001', 'ticket-documents', 'demo/PCT-90001/vpn-diagnostics.txt', 'vpn-diagnostics.txt', 24576, 'text/plain', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '17 hours'),
  ('c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c002', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002', 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c002', 'ticket-documents', 'demo/PCT-90002/report-intervento.pdf', 'report-intervento.pdf', 524288, 'application/pdf', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '2 days')
ON CONFLICT (id) DO UPDATE
SET ticket_id = EXCLUDED.ticket_id,
    note_id = EXCLUDED.note_id,
    storage_bucket = EXCLUDED.storage_bucket,
    storage_path = EXCLUDED.storage_path,
    file_name = EXCLUDED.file_name,
    file_size = EXCLUDED.file_size,
    mime_type = EXCLUDED.mime_type,
    uploaded_by = EXCLUDED.uploaded_by;

INSERT INTO public.ticket_device_assignments (id, ticket_id, device_id, assigned_at, unassigned_at, assigned_by, notes)
VALUES
  ('c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c001', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', now() - interval '1 day', NULL, (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), 'Associazione iniziale al notebook segnalato dal cliente.'),
  ('c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c002', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', now() - interval '6 days', now() - interval '2 days', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), 'Dispositivo sganciato a ticket completato.')
ON CONFLICT (id) DO UPDATE
SET ticket_id = EXCLUDED.ticket_id,
    device_id = EXCLUDED.device_id,
    assigned_at = EXCLUDED.assigned_at,
    unassigned_at = EXCLUDED.unassigned_at,
    assigned_by = EXCLUDED.assigned_by,
    notes = EXCLUDED.notes;

INSERT INTO public.ticket_device_assignment_history (id, ticket_id, device_id, assignment_id, action, occurred_at, actor_id, changed_fields, notes)
VALUES
  ('c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c001', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c001', 'assigned', now() - interval '1 day', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), '{"device":"TL-7430-001"}'::jsonb, 'Associazione confermata dal tecnico.'),
  ('c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c002', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c002', 'unassigned', now() - interval '2 days', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), '{"status":"completed"}'::jsonb, 'Ticket completato e dispositivo restituito al cliente.')
ON CONFLICT (id) DO UPDATE
SET ticket_id = EXCLUDED.ticket_id,
    device_id = EXCLUDED.device_id,
    assignment_id = EXCLUDED.assignment_id,
    action = EXCLUDED.action,
    occurred_at = EXCLUDED.occurred_at,
    actor_id = EXCLUDED.actor_id,
    changed_fields = EXCLUDED.changed_fields,
    notes = EXCLUDED.notes;

INSERT INTO public.ticket_status_history (id, ticket_id, from_status, to_status, changed_by, changed_at, note)
VALUES
  ('c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c001', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001', NULL, 'pending', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '1 day', 'Ticket creato da chiamata interna.'),
  ('c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c002', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001', 'pending', 'in-progress', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '20 hours', 'Presa in carico tecnico.'),
  ('c5c5c5c5-c5c5-45c5-85c5-c5c5c5c5c003', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002', 'testing', 'completed', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '2 days', 'Collaudo e consegna completati.')
ON CONFLICT (id) DO UPDATE
SET ticket_id = EXCLUDED.ticket_id,
    from_status = EXCLUDED.from_status,
    to_status = EXCLUDED.to_status,
    changed_by = EXCLUDED.changed_by,
    changed_at = EXCLUDED.changed_at,
    note = EXCLUDED.note;

INSERT INTO public.ticket_relations (id, source_ticket_id, target_ticket_id, relation_type, notes, created_by, created_at)
VALUES
  ('c6c6c6c6-c6c6-46c6-86c6-c6c6c6c6c001', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c003', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001', 'blocked_by', 'Test firma digitale subordinato alla stabilità della VPN.', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '1 day')
ON CONFLICT (id) DO UPDATE
SET source_ticket_id = EXCLUDED.source_ticket_id,
    target_ticket_id = EXCLUDED.target_ticket_id,
    relation_type = EXCLUDED.relation_type,
    notes = EXCLUDED.notes,
    created_by = EXCLUDED.created_by;

INSERT INTO public.ticket_time_entries (id, ticket_id, user_id, started_at, ended_at, duration_minutes, description, created_at)
VALUES
  ('c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c001', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '20 hours', now() - interval '18 hours 30 minutes', 90, 'Analisi configurazione VPN e log client.', now() - interval '20 hours'),
  ('c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c002', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '5 days 2 hours', now() - interval '5 days', 120, 'Sostituzione batteria e test backup agent.', now() - interval '5 days')
ON CONFLICT (id) DO UPDATE
SET ticket_id = EXCLUDED.ticket_id,
    user_id = EXCLUDED.user_id,
    started_at = EXCLUDED.started_at,
    ended_at = EXCLUDED.ended_at,
    duration_minutes = EXCLUDED.duration_minutes,
    description = EXCLUDED.description;

INSERT INTO public.ticket_checklist_instances (id, ticket_id, template_id, title, structure, status, assigned_to, section_assignments, completed_by, completion_confirmed, signature_name, created_at, updated_at, completed_at)
VALUES
  ('c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c001', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'Preparazione e verifica VPN', '{"setup":{"items":["os","security","apps","handover"]}}'::jsonb, 'in_progress', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), jsonb_build_object('setup', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2)), (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), false, 'Luca Rossi', now() - interval '22 hours', now() - interval '1 hour', NULL),
  ('c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c002', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'Manutenzione HP EliteBook completata', '{"maintenance":{"items":["updates","backup","health","report"]}}'::jsonb, 'completed', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), jsonb_build_object('maintenance', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2)), (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), true, 'Alessandro Romano', now() - interval '5 days', now() - interval '2 days', now() - interval '2 days')
ON CONFLICT (id) DO UPDATE
SET ticket_id = EXCLUDED.ticket_id,
    template_id = EXCLUDED.template_id,
    title = EXCLUDED.title,
    structure = EXCLUDED.structure,
    status = EXCLUDED.status,
    assigned_to = EXCLUDED.assigned_to,
    section_assignments = EXCLUDED.section_assignments,
    completed_by = EXCLUDED.completed_by,
    completion_confirmed = EXCLUDED.completion_confirmed,
    signature_name = EXCLUDED.signature_name,
    updated_at = EXCLUDED.updated_at,
    completed_at = EXCLUDED.completed_at;

INSERT INTO public.ticket_checklist_responses (id, instance_id, item_key, value, compiled_by, compiled_at)
VALUES
  ('c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c001', 'c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c001', 'os', 'Windows 11 Pro verificato e aggiornato', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '19 hours'),
  ('c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c002', 'c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c001', 'security', 'BitLocker, EDR e firewall attivi', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '18 hours'),
  ('c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c003', 'c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c002', 'report', 'Report PDF consegnato tramite portale cliente', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), now() - interval '2 days')
ON CONFLICT (id) DO UPDATE
SET instance_id = EXCLUDED.instance_id,
    item_key = EXCLUDED.item_key,
    value = EXCLUDED.value,
    compiled_by = EXCLUDED.compiled_by,
    compiled_at = EXCLUDED.compiled_at;

INSERT INTO public.ticket_feedback (id, ticket_id, client_id, contact_id, rating, comment, created_at)
VALUES
  ('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d001', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 5, 'Intervento rapido e documentazione molto chiara.', now() - interval '1 day')
ON CONFLICT (id) DO UPDATE
SET ticket_id = EXCLUDED.ticket_id,
    client_id = EXCLUDED.client_id,
    contact_id = EXCLUDED.contact_id,
    rating = EXCLUDED.rating,
    comment = EXCLUDED.comment;

INSERT INTO public.bundle_usage_entries (id, client_bundle_assignment_id, client_id, ticket_id, time_entry_id, usage_type, used_hours, onsite_visits, extra_hours, extra_amount, description, used_at, created_at, created_by)
VALUES
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d001', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001', NULL, 'remote_hours', 1.50, 0, 0.00, 0.00, 'Analisi VPN coperta dal monte ore Tecnolab.', now() - interval '18 hours', now() - interval '18 hours', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2)),
  ('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d002', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002', NULL, 'onsite_visit', 2.00, 1, 0.00, 0.00, 'Visita onsite per sostituzione batteria inclusa nel pacchetto premium.', now() - interval '5 days', now() - interval '5 days', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2))
ON CONFLICT (id) DO UPDATE
SET client_bundle_assignment_id = EXCLUDED.client_bundle_assignment_id,
    client_id = EXCLUDED.client_id,
    ticket_id = EXCLUDED.ticket_id,
    time_entry_id = EXCLUDED.time_entry_id,
    usage_type = EXCLUDED.usage_type,
    used_hours = EXCLUDED.used_hours,
    onsite_visits = EXCLUDED.onsite_visits,
    extra_hours = EXCLUDED.extra_hours,
    extra_amount = EXCLUDED.extra_amount,
    description = EXCLUDED.description,
    used_at = EXCLUDED.used_at,
    created_by = EXCLUDED.created_by;

-- -----------------------------------------------------------------------------
-- Maintenance and calendar.
-- -----------------------------------------------------------------------------
INSERT INTO public.maintenance_schedules (id, device_id, title, description, recurrence, next_due_date, last_done_date, assigned_to, auto_create_ticket, ticket_template, last_ticket_created_for, due_soon_notified_for, created_at)
VALUES
  ('d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d001', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'Controllo trimestrale notebook Tecnolab', 'Aggiornamenti firmware, salute disco e verifica backup.', 'quarterly', current_date + interval '20 days', current_date - interval '70 days', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), true, '{"priority":"med","ticket_type":"maintenance","category":"Manutenzione programmata"}'::jsonb, current_date - interval '70 days', current_date + interval '20 days', now() - interval '60 days'),
  ('d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d002', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'Verifica backup agent Clinica', 'Controllo schedulazione backup e test restore file campione.', 'monthly', current_date + interval '10 days', current_date - interval '20 days', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), true, '{"priority":"high","ticket_type":"maintenance","category":"Backup"}'::jsonb, current_date - interval '20 days', current_date + interval '10 days', now() - interval '55 days')
ON CONFLICT (id) DO UPDATE
SET device_id = EXCLUDED.device_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    recurrence = EXCLUDED.recurrence,
    next_due_date = EXCLUDED.next_due_date,
    last_done_date = EXCLUDED.last_done_date,
    assigned_to = EXCLUDED.assigned_to,
    auto_create_ticket = EXCLUDED.auto_create_ticket,
    ticket_template = EXCLUDED.ticket_template,
    last_ticket_created_for = EXCLUDED.last_ticket_created_for,
    due_soon_notified_for = EXCLUDED.due_soon_notified_for;

INSERT INTO public.maintenance_history (id, schedule_id, device_id, completed_at, completed_by, notes)
VALUES
  ('d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d001', 'd3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d001', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', now() - interval '70 days', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), 'Aggiornato BIOS, verificato SSD e completato report trimestrale.'),
  ('d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d002', 'd3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d002', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', now() - interval '20 days', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), 'Test restore file riuscito e alert email verificati.')
ON CONFLICT (id) DO UPDATE
SET schedule_id = EXCLUDED.schedule_id,
    device_id = EXCLUDED.device_id,
    completed_at = EXCLUDED.completed_at,
    completed_by = EXCLUDED.completed_by,
    notes = EXCLUDED.notes;

INSERT INTO public.calendar_events (id, title, description, start_at, end_at, all_day, event_type, ticket_id, assignee_id, color, estimated_duration_minutes, notes, created_by, created_at, updated_at)
VALUES
  ('d5d5d5d5-d5d5-45d5-85d5-d5d5d5d5d001', 'Intervento VPN Tecnolab', 'Sessione remota con Luca Rossi per test VPN e Outlook.', now() + interval '3 hours', now() + interval '4 hours 30 minutes', false, 'intervention', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c001', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), '#2563EB', 90, 'Preparare checklist test rete prima della chiamata.', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '1 day', now() - interval '1 hour'),
  ('d5d5d5d5-d5d5-45d5-85d5-d5d5d5d5d002', 'Manutenzione backup Clinica', 'Finestra programmata mensile per backup agent.', (current_date + interval '10 days' + time '09:00')::timestamptz, (current_date + interval '10 days' + time '11:00')::timestamptz, false, 'intervention', 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c002', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 2), '#0F766E', 120, 'Concordare eventuale test restore con referente clinica.', (SELECT id FROM (SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn FROM auth.users) demo_auth_users WHERE rn = 1), now() - interval '5 days', now() - interval '2 days')
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_at = EXCLUDED.start_at,
    end_at = EXCLUDED.end_at,
    all_day = EXCLUDED.all_day,
    event_type = EXCLUDED.event_type,
    ticket_id = EXCLUDED.ticket_id,
    assignee_id = EXCLUDED.assignee_id,
    color = EXCLUDED.color,
    estimated_duration_minutes = EXCLUDED.estimated_duration_minutes,
    notes = EXCLUDED.notes,
    created_by = EXCLUDED.created_by,
    updated_at = EXCLUDED.updated_at;

-- Keep the ticket sequence aligned with explicit demo codes.
SELECT setval('public.ticket_seq', GREATEST((SELECT COALESCE(MAX((substring(ticket_code from '^PCT-([0-9]+)$'))::bigint), 0) FROM public.tickets WHERE ticket_code ~ '^PCT-[0-9]+$'), 90003), true);

COMMIT;


