-- ============================================================
-- PCReady — Schema PostgreSQL/Supabase
-- Versione: 1.0 | Aprile 2026
-- Organizzazione: single-tenant, multi-client
-- ============================================================


-- ============================================================
-- SEZIONE 0: ESTENSIONI
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- SEZIONE 1: TIPI ENUM
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'tech', 'viewer');

CREATE TYPE ticket_status AS ENUM (
  'richiesta',
  'assegnato',
  'setup_os',
  'software',
  'sicurezza_rete',
  'test',
  'qa',
  'pronto',
  'consegnato',
  'bloccato',
  'annullato'
);

CREATE TYPE ticket_priority AS ENUM ('bassa', 'media', 'alta', 'critica');

CREATE TYPE device_type AS ENUM ('desktop', 'notebook', 'workstation', 'server', 'altro');

CREATE TYPE device_status AS ENUM ('disponibile', 'in_provisioning', 'consegnato', 'guasto', 'dismesso');

CREATE TYPE checklist_category AS ENUM ('os_setup', 'software', 'sicurezza', 'rete', 'test_finale', 'altro');

CREATE TYPE checklist_item_status AS ENUM ('pending', 'completato', 'saltato', 'fallito');

CREATE TYPE automation_trigger AS ENUM (
  'checklist_categoria_completata',
  'ticket_stato_cambiato',
  'ticket_creato',
  'ticket_assegnato'
);

CREATE TYPE automation_action AS ENUM (
  'cambia_stato_ticket',
  'assegna_tecnico',
  'aggiungi_commento',
  'invia_notifica'
);

CREATE TYPE activity_entity AS ENUM (
  'ticket', 'profile', 'client', 'device',
  'comment', 'checklist_item', 'automation_rule', 'inventory'
);


-- ============================================================
-- SEZIONE 2: FUNZIONE HELPER updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- SEZIONE 3: PROFILES
-- (estende auth.users di Supabase)
-- ============================================================

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        user_role NOT NULL DEFAULT 'viewer',
  avatar_url  TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_role     ON profiles(role);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-crea il profilo alla registrazione
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'viewer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- SEZIONE 4: CLIENTS
-- ============================================================

CREATE TABLE clients (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_name      ON clients(name);
CREATE INDEX idx_clients_is_active ON clients(is_active);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEZIONE 5: INVENTORY (dispositivi)
-- ============================================================

CREATE TABLE inventory (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_tag     TEXT UNIQUE,               -- es. ASSET-0042
  serial_number TEXT UNIQUE,
  brand         TEXT,
  model         TEXT NOT NULL,
  device_type   device_type NOT NULL DEFAULT 'notebook',
  status        device_status NOT NULL DEFAULT 'disponibile',
  cpu           TEXT,
  ram_gb        SMALLINT,
  storage_gb    SMALLINT,
  os_installed  TEXT,
  notes         TEXT,
  client_id     UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inventory_status      ON inventory(status);
CREATE INDEX idx_inventory_client_id   ON inventory(client_id);
CREATE INDEX idx_inventory_device_type ON inventory(device_type);
CREATE INDEX idx_inventory_serial      ON inventory(serial_number);

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEZIONE 6: TICKETS
-- ID leggibile tipo PCT-001 con sequenza dedicata
-- ============================================================

CREATE SEQUENCE ticket_seq START 1;

CREATE TABLE tickets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_ref    TEXT UNIQUE NOT NULL
                  DEFAULT ('PCT-' || LPAD(nextval('ticket_seq')::TEXT, 3, '0')),
  title         TEXT NOT NULL,
  description   TEXT,
  status        ticket_status NOT NULL DEFAULT 'richiesta',
  priority      ticket_priority NOT NULL DEFAULT 'media',
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  device_id     UUID REFERENCES inventory(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  due_date      DATE,
  closed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Vincolo: ticket chiuso/consegnato deve avere closed_at
  CONSTRAINT chk_closed_at CHECK (
    (status NOT IN ('consegnato', 'annullato')) OR (closed_at IS NOT NULL)
  )
);

CREATE INDEX idx_tickets_status      ON tickets(status);
CREATE INDEX idx_tickets_client_id   ON tickets(client_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_priority    ON tickets(priority);
CREATE INDEX idx_tickets_created_at  ON tickets(created_at DESC);
CREATE INDEX idx_tickets_ticket_ref  ON tickets(ticket_ref);

CREATE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-imposta closed_at quando lo stato diventa consegnato/annullato
CREATE OR REPLACE FUNCTION set_ticket_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('consegnato', 'annullato') AND OLD.status NOT IN ('consegnato', 'annullato') THEN
    NEW.closed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ticket_closed_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_ticket_closed_at();


-- ============================================================
-- SEZIONE 7: COMMENTS
-- ============================================================

CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id  UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  body       TEXT NOT NULL CHECK (char_length(body) > 0),
  is_internal BOOLEAN NOT NULL DEFAULT FALSE, -- note interne non visibili al viewer
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_ticket_id  ON comments(ticket_id);
CREATE INDEX idx_comments_author_id  ON comments(author_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

CREATE TRIGGER trg_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEZIONE 8: CHECKLIST_ITEMS (template globali)
-- Definisce i singoli step riutilizzabili
-- ============================================================

CREATE TABLE checklist_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  description  TEXT,
  category     checklist_category NOT NULL,
  is_required  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_items_category   ON checklist_items(category);
CREATE INDEX idx_checklist_items_sort_order ON checklist_items(sort_order);

CREATE TRIGGER trg_checklist_items_updated_at
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEZIONE 9: TICKET_CHECKLIST
-- Istanza dei checklist_items per ogni ticket
-- ============================================================

CREATE TABLE ticket_checklist (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id        UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE RESTRICT,
  status           checklist_item_status NOT NULL DEFAULT 'pending',
  completed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at     TIMESTAMPTZ,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (ticket_id, checklist_item_id)
);

CREATE INDEX idx_ticket_checklist_ticket_id  ON ticket_checklist(ticket_id);
CREATE INDEX idx_ticket_checklist_status     ON ticket_checklist(status);
CREATE INDEX idx_ticket_checklist_item_id    ON ticket_checklist(checklist_item_id);

CREATE TRIGGER trg_ticket_checklist_updated_at
  BEFORE UPDATE ON ticket_checklist
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-imposta completed_at e completed_by
CREATE OR REPLACE FUNCTION set_checklist_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completato' AND OLD.status != 'completato' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_checklist_completed_at
  BEFORE UPDATE ON ticket_checklist
  FOR EACH ROW EXECUTE FUNCTION set_checklist_completed();


-- ============================================================
-- SEZIONE 10: AUTOMATION_RULES
-- ============================================================

CREATE TABLE automation_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_event   automation_trigger NOT NULL,
  trigger_value   TEXT,    -- es. categoria completata, stato origine
  action_type     automation_action NOT NULL,
  action_payload  JSONB NOT NULL DEFAULT '{}',
  -- Esempio payload: {"new_status": "test"} oppure {"assign_to": "<uuid>"}
  priority        SMALLINT NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_rules_is_active     ON automation_rules(is_active);
CREATE INDEX idx_automation_rules_trigger_event ON automation_rules(trigger_event);

CREATE TRIGGER trg_automation_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- SEZIONE 11: ACTIVITY_LOG (append-only, audit trail)
-- ============================================================

CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type activity_entity NOT NULL,
  entity_id   UUID NOT NULL,
  action      TEXT NOT NULL,          -- es. 'status_changed', 'assigned', 'checklist_completed'
  old_value   JSONB,
  new_value   JSONB,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- NESSUN updated_at: il log è immutabile
);

-- Indici ottimizzati per le query più frequenti
CREATE INDEX idx_activity_log_entity      ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_actor_id    ON activity_log(actor_id);
CREATE INDEX idx_activity_log_created_at  ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_action      ON activity_log(action);

-- Ticket-specific per dashboard rapida
CREATE INDEX idx_activity_log_ticket      ON activity_log(entity_id)
  WHERE entity_type = 'ticket';


-- ============================================================
-- SEZIONE 12: TRIGGER AUTOMATICO ACTIVITY_LOG su TICKETS
-- Traccia ogni cambio di stato o assegnazione
-- ============================================================

CREATE OR REPLACE FUNCTION log_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log cambio stato
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO activity_log (actor_id, entity_type, entity_id, action, old_value, new_value)
    VALUES (
      auth.uid(),
      'ticket',
      NEW.id,
      'status_changed',
      jsonb_build_object('status', OLD.status),
      jsonb_build_object('status', NEW.status)
    );
  END IF;

  -- Log cambio assegnazione
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO activity_log (actor_id, entity_type, entity_id, action, old_value, new_value)
    VALUES (
      auth.uid(),
      'ticket',
      NEW.id,
      'assigned',
      jsonb_build_object('assigned_to', OLD.assigned_to),
      jsonb_build_object('assigned_to', NEW.assigned_to)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_ticket_changes
  AFTER UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION log_ticket_changes();

-- Log creazione ticket
CREATE OR REPLACE FUNCTION log_ticket_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_log (actor_id, entity_type, entity_id, action, new_value)
  VALUES (
    auth.uid(),
    'ticket',
    NEW.id,
    'created',
    jsonb_build_object('ticket_ref', NEW.ticket_ref, 'status', NEW.status, 'priority', NEW.priority)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_ticket_created
  AFTER INSERT ON tickets
  FOR EACH ROW EXECUTE FUNCTION log_ticket_created();

-- Log completamento checklist
CREATE OR REPLACE FUNCTION log_checklist_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completato' AND OLD.status != 'completato' THEN
    INSERT INTO activity_log (actor_id, entity_type, entity_id, action, new_value)
    VALUES (
      auth.uid(),
      'checklist_item',
      NEW.ticket_id,
      'checklist_completed',
      jsonb_build_object('checklist_item_id', NEW.checklist_item_id, 'note', NEW.note)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_log_checklist_completed
  AFTER UPDATE ON ticket_checklist
  FOR EACH ROW EXECUTE FUNCTION log_checklist_completed();


-- ============================================================
-- SEZIONE 13: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Abilita RLS su tutte le tabelle
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_checklist  ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log      ENABLE ROW LEVEL SECURITY;

-- Helper function: ritorna il ruolo dell'utente corrente
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: controlla se l'utente è attivo
CREATE OR REPLACE FUNCTION current_user_is_active()
RETURNS BOOLEAN AS $$
  SELECT is_active FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── PROFILES ──────────────────────────────────────────────

-- Tutti gli utenti autenticati vedono i profili (per assegnazioni, dropdown)
CREATE POLICY "profiles_select_authenticated"
  ON profiles FOR SELECT
  TO authenticated
  USING (current_user_is_active() = TRUE);

-- Ogni utente può aggiornare solo il proprio profilo
CREATE POLICY "profiles_update_self"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));
  -- Non può auto-promuoversi di ruolo

-- Admin può aggiornare tutti i profili (incluso cambio ruolo)
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (current_user_role() = 'admin');

-- Solo admin inserisce nuovi profili manualmente (normalmente via trigger)
CREATE POLICY "profiles_insert_admin"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (current_user_role() = 'admin');

-- ── CLIENTS ───────────────────────────────────────────────

CREATE POLICY "clients_select_all"
  ON clients FOR SELECT
  TO authenticated
  USING (current_user_is_active() = TRUE);

CREATE POLICY "clients_insert_admin_tech"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (current_user_role() IN ('admin', 'tech'));

CREATE POLICY "clients_update_admin_tech"
  ON clients FOR UPDATE
  TO authenticated
  USING (current_user_role() IN ('admin', 'tech'));

CREATE POLICY "clients_delete_admin"
  ON clients FOR DELETE
  TO authenticated
  USING (current_user_role() = 'admin');

-- ── INVENTORY ─────────────────────────────────────────────

CREATE POLICY "inventory_select_all"
  ON inventory FOR SELECT
  TO authenticated
  USING (current_user_is_active() = TRUE);

CREATE POLICY "inventory_insert_admin_tech"
  ON inventory FOR INSERT
  TO authenticated
  WITH CHECK (current_user_role() IN ('admin', 'tech'));

CREATE POLICY "inventory_update_admin_tech"
  ON inventory FOR UPDATE
  TO authenticated
  USING (current_user_role() IN ('admin', 'tech'));

CREATE POLICY "inventory_delete_admin"
  ON inventory FOR DELETE
  TO authenticated
  USING (current_user_role() = 'admin');

-- ── TICKETS ───────────────────────────────────────────────

-- Tutti leggono tutti i ticket (organizzazione singola)
CREATE POLICY "tickets_select_all"
  ON tickets FOR SELECT
  TO authenticated
  USING (current_user_is_active() = TRUE);

-- Admin e tech possono creare ticket
CREATE POLICY "tickets_insert_admin_tech"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_is_active() = TRUE
    AND current_user_role() IN ('admin', 'tech')
  );

-- Admin aggiorna tutto; tech aggiorna solo i ticket assegnati a lui
CREATE POLICY "tickets_update_admin"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    current_user_is_active() = TRUE
    AND current_user_role() = 'admin'
  );

CREATE POLICY "tickets_update_tech_assigned"
  ON tickets FOR UPDATE
  TO authenticated
  USING (
    current_user_is_active() = TRUE
    AND current_user_role() = 'tech'
    AND assigned_to = auth.uid()
  );

-- Solo admin può eliminare ticket
CREATE POLICY "tickets_delete_admin"
  ON tickets FOR DELETE
  TO authenticated
  USING (
    current_user_is_active() = TRUE
    AND current_user_role() = 'admin'
  );

-- Additional explicit policy mirroring proposal: guard INSERT/UPDATE/DELETE
-- in case other tooling references this policy name directly.
CREATE POLICY "only_tech_admin_can_write"
  ON tickets
  FOR ALL
  TO authenticated
  USING (
    current_user_is_active() = TRUE
    AND current_user_role() IN ('admin', 'tech')
  )
  WITH CHECK (
    current_user_is_active() = TRUE
    AND current_user_role() IN ('admin', 'tech')
  );

-- ── COMMENTS ──────────────────────────────────────────────

-- Viewer NON vede commenti interni
CREATE POLICY "comments_select_viewer"
  ON comments FOR SELECT
  TO authenticated
  USING (
    current_user_is_active() = TRUE
    AND (
      is_internal = FALSE
      OR current_user_role() IN ('admin', 'tech')
    )
  );

CREATE POLICY "comments_insert_admin_tech"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (current_user_role() IN ('admin', 'tech'));

-- Modifica solo il proprio commento (o admin)
CREATE POLICY "comments_update_own_or_admin"
  ON comments FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR current_user_role() = 'admin'
  );

CREATE POLICY "comments_delete_own_or_admin"
  ON comments FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR current_user_role() = 'admin'
  );

-- ── CHECKLIST_ITEMS (template) ────────────────────────────

CREATE POLICY "checklist_items_select_all"
  ON checklist_items FOR SELECT
  TO authenticated
  USING (current_user_is_active() = TRUE);

CREATE POLICY "checklist_items_write_admin"
  ON checklist_items FOR ALL
  TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- ── TICKET_CHECKLIST ──────────────────────────────────────

CREATE POLICY "ticket_checklist_select_all"
  ON ticket_checklist FOR SELECT
  TO authenticated
  USING (current_user_is_active() = TRUE);

-- Admin o tech assegnato al ticket
CREATE POLICY "ticket_checklist_insert_admin_tech"
  ON ticket_checklist FOR INSERT
  TO authenticated
  WITH CHECK (
    current_user_role() = 'admin'
    OR (
      current_user_role() = 'tech'
      AND EXISTS (
        SELECT 1 FROM tickets
        WHERE id = ticket_checklist.ticket_id
          AND assigned_to = auth.uid()
      )
    )
  );

CREATE POLICY "ticket_checklist_update_admin_tech"
  ON ticket_checklist FOR UPDATE
  TO authenticated
  USING (
    current_user_role() = 'admin'
    OR (
      current_user_role() = 'tech'
      AND EXISTS (
        SELECT 1 FROM tickets
        WHERE id = ticket_checklist.ticket_id
          AND assigned_to = auth.uid()
      )
    )
  );

CREATE POLICY "ticket_checklist_delete_admin"
  ON ticket_checklist FOR DELETE
  TO authenticated
  USING (current_user_role() = 'admin');

-- ── AUTOMATION_RULES ──────────────────────────────────────

-- Solo admin gestisce le automazioni
CREATE POLICY "automation_rules_select_admin_tech"
  ON automation_rules FOR SELECT
  TO authenticated
  USING (current_user_role() IN ('admin', 'tech'));

CREATE POLICY "automation_rules_write_admin"
  ON automation_rules FOR ALL
  TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- ── ACTIVITY_LOG ──────────────────────────────────────────

-- Tutti leggono il log (auditing trasparente)
CREATE POLICY "activity_log_select_all"
  ON activity_log FOR SELECT
  TO authenticated
  USING (current_user_is_active() = TRUE);

-- Nessuno può inserire manualmente: solo via SECURITY DEFINER functions
-- (le policy INSERT sono assenti di default → blocco implicito)
-- I trigger usano SECURITY DEFINER e bypassano RLS


-- ============================================================
-- SEZIONE 14: VIEWS UTILI
-- ============================================================

-- Vista ticket arricchita per la dashboard
CREATE OR REPLACE VIEW v_tickets_dashboard AS
SELECT
  t.id,
  t.ticket_ref,
  t.title,
  t.status,
  t.priority,
  t.due_date,
  t.created_at,
  t.updated_at,
  t.closed_at,
  c.name                          AS client_name,
  p_assigned.full_name            AS assigned_to_name,
  p_created.full_name             AS created_by_name,
  d.model                         AS device_model,
  d.serial_number                 AS device_serial,
  -- Percentuale completamento checklist
  COALESCE(
    ROUND(
      100.0 * COUNT(tc.id) FILTER (WHERE tc.status = 'completato')
      / NULLIF(COUNT(tc.id), 0)
    ), 0
  )                               AS checklist_pct
FROM tickets t
JOIN clients  c             ON c.id = t.client_id
LEFT JOIN profiles p_assigned ON p_assigned.id = t.assigned_to
LEFT JOIN profiles p_created  ON p_created.id  = t.created_by
LEFT JOIN inventory d         ON d.id = t.device_id
LEFT JOIN ticket_checklist tc ON tc.ticket_id = t.id
GROUP BY t.id, c.name, p_assigned.full_name, p_created.full_name, d.model, d.serial_number;

-- Vista KPI sintetica per la dashboard home
CREATE OR REPLACE VIEW v_kpi_summary AS
SELECT
  COUNT(*) FILTER (WHERE status NOT IN ('consegnato','annullato'))  AS tickets_aperti,
  COUNT(*) FILTER (WHERE status = 'consegnato')                     AS tickets_consegnati,
  COUNT(*) FILTER (WHERE status = 'bloccato')                       AS tickets_bloccati,
  COUNT(*) FILTER (WHERE priority = 'critica'
                   AND status NOT IN ('consegnato','annullato'))     AS tickets_critici,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600
  ) FILTER (WHERE closed_at IS NOT NULL), 1)                        AS avg_hours_to_close
FROM tickets;


-- ============================================================
-- SEZIONE 15: SEED DATI MINIMI
-- ============================================================

-- Admin di default (password da settare via Supabase Auth Dashboard)
-- L'UUID deve corrispondere a quello creato in auth.users
-- Qui usiamo un placeholder: in produzione eseguire dopo la creazione utente

-- Profilo admin seed (eseguire DOPO aver creato l'utente in Supabase Auth)
-- INSERT INTO profiles (id, full_name, email, role)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'Admin PCReady', 'admin@pcready.local', 'admin');

-- Tecnico seed
-- INSERT INTO profiles (id, full_name, email, role)
-- VALUES ('00000000-0000-0000-0000-000000000002', 'Mario Rossi', 'mario.rossi@pcready.local', 'tech');

-- Viewer seed
-- INSERT INTO profiles (id, full_name, email, role)
-- VALUES ('00000000-0000-0000-0000-000000000003', 'Laura Bianchi', 'laura.bianchi@pcready.local', 'viewer');

-- Clienti di esempio
INSERT INTO clients (id, name, contact_name, contact_email, is_active)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Acme S.r.l.',      'Giovanni Ferri',  'g.ferri@acme.it',      TRUE),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'TechCorp S.p.A.',  'Silvia Marino',   's.marino@techcorp.it', TRUE),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Studio Legale Neri','Carlo Neri',     'c.neri@nerilaw.it',    TRUE);

-- Checklist items standard per provisioning PC
INSERT INTO checklist_items (title, category, is_required, sort_order) VALUES
  -- OS Setup
  ('Installazione OS (Windows 11 / Ubuntu LTS)',  'os_setup',  TRUE,  10),
  ('Aggiornamenti sistema operativo applicati',   'os_setup',  TRUE,  20),
  ('Driver hardware installati e verificati',     'os_setup',  TRUE,  30),
  ('Hostname configurato secondo naming convention', 'os_setup', TRUE, 40),
  -- Software
  ('Suite Office / LibreOffice installata',       'software',  TRUE,  10),
  ('Browser aziendale configurato',               'software',  TRUE,  20),
  ('Client VPN installato e testato',             'software',  FALSE, 30),
  ('Antivirus/EDR installato e aggiornato',       'software',  TRUE,  40),
  ('Software specifico cliente installato',       'software',  FALSE, 50),
  -- Sicurezza
  ('Bitlocker / cifratura disco abilitata',       'sicurezza', TRUE,  10),
  ('Password policy configurata',                 'sicurezza', TRUE,  20),
  ('Firewall OS abilitato',                       'sicurezza', TRUE,  30),
  ('Account admin locale disabilitato',           'sicurezza', FALSE, 40),
  ('Certificati aziendali installati',            'sicurezza', FALSE, 50),
  -- Rete
  ('Configurazione IP / DHCP verificata',         'rete',      TRUE,  10),
  ('Connettività internet testata',               'rete',      TRUE,  20),
  ('Accesso risorse condivise verificato',        'rete',      FALSE, 30),
  ('Stampante di rete configurata',               'rete',      FALSE, 40),
  -- Test finale
  ('Riavvio post-configurazione eseguito',        'test_finale', TRUE, 10),
  ('Login utente finale testato',                 'test_finale', TRUE, 20),
  ('Funzionalità applicazioni verificate',        'test_finale', TRUE, 30),
  ('Documentazione asset aggiornata',             'test_finale', TRUE, 40);

-- Inventory di esempio
INSERT INTO inventory (id, asset_tag, serial_number, brand, model, device_type, status, ram_gb, storage_gb, client_id)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'ASSET-001', 'SN-DELL-00123', 'Dell',   'Latitude 5540',  'notebook',  'disponibile',    16, 512, NULL),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ASSET-002', 'SN-LENO-00456', 'Lenovo', 'ThinkPad X1 Carbon', 'notebook', 'disponibile', 32, 1024, NULL),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'ASSET-003', 'SN-HP-00789',   'HP',     'EliteDesk 800',  'desktop',   'disponibile',    8,  256, NULL);

-- Automation rules di esempio
INSERT INTO automation_rules (name, trigger_event, trigger_value, action_type, action_payload, is_active, priority)
VALUES
  (
    'Auto → Test dopo checklist sicurezza',
    'checklist_categoria_completata',
    'sicurezza',
    'cambia_stato_ticket',
    '{"new_status": "test"}',
    TRUE, 10
  ),
  (
    'Auto → In Lavorazione quando assegnato',
    'ticket_assegnato',
    NULL,
    'cambia_stato_ticket',
    '{"new_status": "assegnato"}',
    TRUE, 5
  ),
  (
    'Auto → Log nota su blocco',
    'ticket_stato_cambiato',
    'bloccato',
    'aggiungi_commento',
    '{"body": "⚠️ Ticket bloccato automaticamente. Verifica le note tecniche.", "is_internal": true}',
    TRUE, 20
  );

-- ============================================================
-- FINE SCHEMA PCReady v1.0
-- ============================================================
