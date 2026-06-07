# Inventory Enhancements — Specification

**Data:** 2026-06-07
**Versione:** 1.0
**Area:** `/inventory` — Gestione dispositivi e asset
**Stato:** Da implementare

---

## Panoramica

Il modulo inventario attuale gestisce dispositivi con virtual list, bulk actions, confronto device, filtri avanzati, QR/barcode scanner, label printing, warranty tracking, calendario manutenzione e import CSV. Questa specifica descrive 7 nuove feature da implementare.

---

## 1. Asset Lifecycle Tracking

### 1.1 Fasi del ciclo di vita

5 fasi definite:

| Fase | Descrizione |
|---|---|
| `warehouse` | In magazzino — ricevuto, stoccato, non ancora configurato |
| `configuration` | In configurazione — in preparazione / imaging |
| `deployed` | Dispiegato — presso il cliente, operativo |
| `repair` | In riparazione — rientrato per riparazione/assistenza |
| `decommissioned` | Dismesso — fuori servizio, da smaltire/riciclare |

Il passaggio di fase è **manuale** (l'utente seleziona la nuova fase dalla scheda device). Non ci sono transizioni forzate.

### 1.2 Documenti allegati alle fasi

- I documenti (fattura, DDT, ecc.) sono **sempre opzionali** in ogni fase.
- Nuovo **bucket Supabase Storage**: `device-documents`
- Nuova tabella: `device_attachments`

#### Tabella `device_attachments`

```sql
CREATE TABLE public.device_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  lifecycle_phase TEXT NOT NULL,  -- 'warehouse','configuration','deployed','repair','decommissioned'
  storage_bucket TEXT NOT NULL DEFAULT 'device-documents',
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(storage_bucket, storage_path)
);
```

- RLS: team può leggere, tech/admin possono inserire, uploader/admin possono cancellare.
- MIME types consentiti: PDF, immagini, documenti Office, testo.
- File size max: 50 MB.

### 1.3 Tabella lifecycle history

```sql
CREATE TABLE public.device_lifecycle_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,  -- la fase in cui è entrato
  previous_phase TEXT,  -- fase precedente (null per la prima)
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Ogni transizione di fase registra automaticamente una entry. La timeline del device detail modal (tab "Storico") deve includere anche le transizioni di lifecycle.

### 1.4 UI

- Nuovo tab "Ciclo di vita" nel `DeviceDetailModal`
- Visualizzazione timeline con le fasi
- Bottone "Cambia fase" con dropdown delle fasi disponibili
- Upload documenti con drag & drop nella fase corrente
- Lista documenti allegati per ogni fase

---

## 2. Deprecazione Automatica

### 2.1 Logica

Un device viene automaticamente flaggato "da sostituire" quando:

1. **Età del device** > `X` anni (calcolata da `purchase_date`, o in mancanza da `created_at`)
2. **Numero ticket** negli ultimi 12 mesi > `Y` (ticket con `device_id` = questo device)

Le soglie sono **configurabili via app settings**:
- `device_deprecation_max_age_years` (default: 3)
- `device_deprecation_max_tickets_12m` (default: 5)

### 2.2 Azione alla deprecazione

Quando scatta la condizione:
1. Cambio stato device → `retired`
2. Notifica in-app a tutti gli admin
3. Registrazione automatica nella `device_lifecycle_history` (fase: `decommissioned`, notes: "Deprecazione automatica: età X anni / Y ticket in 12 mesi")

### 2.3 Implementazione

- Funzione PostgreSQL schedulata via `pg_cron` con esecuzione **settimanale**
- Nuova funzione: `public.evaluate_device_deprecation()`
- Legge le soglie da `public.app_settings`
- Itera i device e applica la regola

```sql
CREATE OR REPLACE FUNCTION public.evaluate_device_deprecation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  max_age_years INT;
  max_tickets_12m INT;
  d RECORD;
  ticket_count INT;
BEGIN
  -- Leggi soglie da app_settings
  SELECT COALESCE((value::jsonb->>'value')::int, 3) INTO max_age_years
    FROM public.app_settings WHERE key = 'device_deprecation_max_age_years';
  SELECT COALESCE((value::jsonb->>'value')::int, 5) INTO max_tickets_12m
    FROM public.app_settings WHERE key = 'device_deprecation_max_tickets_12m';

  FOR d IN
    SELECT id, model, purchase_date, created_at
    FROM public.devices
    WHERE status NOT IN ('retired', 'maintenance')
  LOOP
    -- Controllo età
    DECLARE
      age_date DATE := COALESCE(d.purchase_date, d.created_at::date);
      age_years INT := EXTRACT(YEAR FROM age(CURRENT_DATE, age_date));
    BEGIN
      IF age_years >= max_age_years THEN
        -- Controllo ticket
        SELECT COUNT(*) INTO ticket_count
        FROM public.tickets
        WHERE device_id = d.id AND created_at >= CURRENT_DATE - INTERVAL '12 months';

        IF ticket_count >= max_tickets_12m THEN
          UPDATE public.devices SET status = 'retired' WHERE id = d.id;
          INSERT INTO public.device_lifecycle_history (device_id, phase, previous_phase, notes)
          VALUES (d.id, 'decommissioned', 'deployed',
            format('Deprecazione automatica: età %s anni, %s ticket in 12 mesi', age_years, ticket_count));
          INSERT INTO public.notifications (user_id, type, title, body, payload, link)
          SELECT ur.user_id, 'device_status_changed',
            'Device deprecato: ' || d.model,
            format('Il device %s è stato automaticamente dismesso (età %s anni, %s ticket in 12 mesi).', d.model, age_years, ticket_count),
            jsonb_build_object('device_id', d.id, 'reason', 'deprecation'),
            '/inventory?device=' || d.id
          FROM public.user_roles ur WHERE ur.role = 'admin';
        END IF;
      END IF;
    END;
  END LOOP;
END;
$$;
```

---

## 3. Check-in / Check-out Device

### 3.1 Flusso

- Il check-in/check-out è **legato a un ticket** (non standalone).
- Quando un tecnico apre un ticket e assegna un device, può fare il **check-out** (prendere in carico).
- Quando completa la riparazione, può fare il **check-in** (restituire).

### 3.2 Firma digitale

- Riutilizza la tabella esistente `public.document_signatures`
- Nuovo `document_type`: `device_checkout` / `device_checkin`
- Campi aggiuntivi nella tabella `document_signatures`:
  - `document_type TEXT NOT NULL DEFAULT 'portal_document'`
  - `ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL`
  - `device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL`

### 3.3 Nuova tabella `device_checkouts`

```sql
CREATE TABLE public.device_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkout_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checkin_at TIMESTAMPTZ,
  checkout_signature_id UUID REFERENCES public.document_signatures(id) ON DELETE SET NULL,
  checkin_signature_id UUID REFERENCES public.document_signatures(id) ON DELETE SET NULL,
  condition_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- Un solo checkout attivo per device alla volta (constraint: solo un `checkin_at IS NULL` per `device_id`).
- Il check-in è possibile solo per lo stesso tecnico che ha fatto il check-out (o un admin).

### 3.4 UI

- Nella scheda ticket, se c'è un device assegnato, compare la sezione "Check-in / Check-out"
- Bottone "Check-out dispositivo" → apre dialog con firma digitale
- Bottone "Check-in dispositivo" → apre dialog con firma digitale e note condizioni
- La timeline del device mostra gli eventi di check-in/check-out

### 3.5 Attività

- Registra eventi in `activity_log` per device e ticket.

---

## 4. Integrazione Azure AD / Entra ID

### 4.1 Obiettivo

Sincronizzare automaticamente i computer domain-joined con il loro hostname e utente assegnato.

### 4.2 Dati sincronizzati

- **Hostname** → match con `devices.model` o nuovo campo `devices.hostname`
- **Sistema operativo** → `devices.os`
- **Utente assegnato** → `devices.assigned_to`

Solo **matching** di device esistenti. Non vengono creati nuovi device automaticamente. Il match avviene per:
1. `devices.hostname` = computer hostname (nuovo campo)
2. Fallback: `devices.serial` contenuto nel nome host

### 4.3 Architettura

- **Agent** installato su un server Windows con accesso a Microsoft Graph API
- L'agent interroga Azure AD via Microsoft Graph periodicamente
- Comunica con il backend PCReady via **Supabase Realtime** (WebSocket) o REST API con API key
- I dati vengono inviati a un endpoint dedicato

### 4.4 Nuovo campo tabella devices

```sql
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS hostname TEXT;
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS azure_ad_device_id TEXT;  -- ID del device in Azure AD
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS last_ad_sync_at TIMESTAMPTZ;
```

### 4.5 Server function

```sql
CREATE OR REPLACE FUNCTION public.sync_azure_ad_device(
  _azure_ad_device_id TEXT,
  _hostname TEXT,
  _os TEXT,
  _assigned_to TEXT
) RETURNS SETOF public.devices
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  matched_device devices%ROWTYPE;
BEGIN
  -- Cerca per azure_ad_device_id
  SELECT * INTO matched_device FROM public.devices WHERE azure_ad_device_id = _azure_ad_device_id;
  IF matched_device.id IS NULL THEN
    -- Cerca per hostname
    SELECT * INTO matched_device FROM public.devices WHERE hostname = _hostname;
  END IF;
  IF matched_device.id IS NOT NULL THEN
    UPDATE public.devices
    SET os = COALESCE(NULLIF(_os, ''), devices.os),
        assigned_to = COALESCE(NULLIF(_assigned_to, ''), devices.assigned_to),
        hostname = COALESCE(NULLIF(_hostname, ''), devices.hostname),
        azure_ad_device_id = _azure_ad_device_id,
        last_ad_sync_at = now()
    WHERE id = matched_device.id;
  END IF;
  RETURN QUERY SELECT * FROM public.devices WHERE id = matched_device.id;
END;
$$;
```

### 4.6 Limiti della versione corrente

- Solo Azure AD / Entra ID (no AD on-premises in questa fase)
- Solo matching, no auto-creazione device
- L'agent è un progetto separato (non incluso in questo repo), ma il backend è pronto per ricevere i dati

---

## 5. Software Inventory

### 5.1 Obiettivo

Elenco del software installato per ogni device, sincronizzato via agent PCReady, con alert per versioni obsolete.

### 5.2 Nuova tabella `device_software`

```sql
CREATE TABLE public.device_software (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  software_name TEXT NOT NULL,
  version TEXT NOT NULL,
  publisher TEXT,
  install_date DATE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(device_id, software_name)
);
```

### 5.3 Nuova tabella `software_catalog`

Catalogo centralizzato con le ultime versioni note dei software, per confronto obsolescenza.

```sql
CREATE TABLE public.software_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  latest_version TEXT NOT NULL,
  publisher TEXT,
  category TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.4 Alert obsolescenza

- Confronto: `device_software.version` < `software_catalog.latest_version`
- L'obsolescenza è calcolata lato client (query SQL semplice)
- UI: badge colorato nella scheda device per ogni software obsoleto

### 5.5 Comunicazione agent

- L'agent PCReady comunica via **Supabase Realtime** (WebSocket) o REST API
- Invio batch: l'agent raccoglie l'elenco software e lo invia tutto insieme
- L'endpoint upserta i record in `device_software`
- I software non più presenti vengono marcati (non cancellati) — `last_seen_at` non aggiornato per più di 30 giorni = "non più rilevato"

### 5.6 UI

- Nuovo tab "Software" nel `DeviceDetailModal`
- Tabella con: nome software, versione, publisher, data installazione, stato (aggiornato/obsoleto)
- Badge "Obsoleto" in arancione se versione < latest
- Bottone "Forza refresh" per richiedere un aggiornamento immediato all'agent

---

## 6. Alert Scadenza Garanzia via Email

### 6.1 Logica

- **60 giorni** prima della scadenza della garanzia, invia notifica
- **Destinatari**:
  - Admin dell'organizzazione (in-app notification + email)
  - Contatto principale del cliente proprietario del device (email)
- **Frequenza**: check **settimanale** via `pg_cron`

### 6.2 Trigger

Controllo: device con `warranty_expiry_date` tra `CURRENT_DATE + 60 giorni` e `CURRENT_DATE + 67 giorni` (finestra settimanale per evitare notifiche duplicate).

Tracciamento per evitare duplicati:
```sql
ALTER TABLE public.devices ADD COLUMN IF NOT EXISTS warranty_expiry_notified_for DATE;
```

### 6.3 Funzione PostgreSQL

```sql
CREATE OR REPLACE FUNCTION public.send_warranty_expiry_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  d RECORD;
  client_contact RECORD;
  admin_ids UUID[];
BEGIN
  -- Trova admin
  SELECT array_agg(user_id) INTO admin_ids FROM public.user_roles WHERE role = 'admin';

  FOR d IN
    SELECT dev.*, c.name AS client_name
    FROM public.devices dev
    JOIN public.clients c ON c.id = dev.client_id
    WHERE dev.warranty_expiry_date BETWEEN CURRENT_DATE + 60 AND CURRENT_DATE + 67
      AND (dev.warranty_expiry_notified_for IS NULL OR dev.warranty_expiry_notified_for <> dev.warranty_expiry_date)
      AND dev.status != 'retired'
  LOOP
    -- Notifica agli admin
    IF admin_ids IS NOT NULL THEN
      FOR i IN 1..array_length(admin_ids, 1) LOOP
        INSERT INTO public.notifications (user_id, type, title, body, payload, link)
        VALUES (
          admin_ids[i],
          'device_status_changed',
          'Garanzia in scadenza: ' || d.model,
          format('La garanzia del device %s (%s) scade il %s.', d.model, COALESCE(d.serial, d.asset_tag), d.warranty_expiry_date),
          jsonb_build_object('device_id', d.id, 'warranty_expiry', d.warranty_expiry_date),
          '/inventory?device=' || d.id
        );
      END LOOP;
    END IF;

    -- Notifica al cliente (contatto principale)
    SELECT * INTO client_contact
    FROM public.client_contacts
    WHERE client_id = d.client_id AND role = 'Principal'
    LIMIT 1;

    -- (email inviata via sistema email esistente, usando template warranty_expiring)

    -- Marca come notificato
    UPDATE public.devices
    SET warranty_expiry_notified_for = d.warranty_expiry_date
    WHERE id = d.id;
  END LOOP;
END;
$$;
```

### 6.4 Nuovo template email

- Event type: `warranty_expiring`
- Variabili: `{{device_model}}`, `{{device_serial}}`, `{{warranty_expiry_date}}`, `{{client_name}}`, `{{portal_link}}`

### 6.5 Scheduling

```sql
SELECT cron.schedule(
  'warranty-expiry-alerts-weekly',
  '0 8 * * 1',  -- Ogni lunedì alle 8:00
  'SELECT public.send_warranty_expiry_alerts();'
);
```

---

## 7. Clona Device

### 7.1 Obiettivo

Duplicare la scheda di un device esistente per aggiungere dispositivi identici.

### 7.2 Campi copiati

**Tutti i campi tranne**:
- `id` (nuovo UUID)
- `serial` (svuotato — da compilare manualmente)
- `asset_tag` (auto-generato dal trigger `set_device_asset_tag()`)
- `hostname` (svuotato)
- `azure_ad_device_id` (svuotato)
- `last_ad_sync_at` (null)
- `created_at`, `updated_at` (timestamp correnti)

**Campo `model`**: opzionalmente modificabile prima di confermare il clone. Default: stesso modello con suffisso " (copia)" che l'utente può cambiare.

### 7.3 UI

- Bottone "Clona" nella scheda device (DeviceDetailModal)
- Apre un dialog che mostra i campi che saranno copiati
- Campo `model` editabile con suffisso " (copia)"
- Bottone "Conferma clona" → crea il nuovo device e apre la scheda

### 7.4 Logica

- La clonazione **NON** copia:
  - Documenti allegati
  - Software inventory
  - Cronologia lifecycle
  - Maintenance schedules

---

## 8. Riepilogo Modifiche al Database

### Nuove tabelle

| Tabella | Descrizione |
|---|---|
| `device_attachments` | Documenti allegati alle fasi lifecycle |
| `device_lifecycle_history` | Storico transizioni di fase |
| `device_checkouts` | Check-in / check-out device |
| `device_software` | Software installato per device |
| `software_catalog` | Catalogo versioni software |

### Nuove colonne in `devices`

| Colonna | Tipo | Descrizione |
|---|---|---|
| `hostname` | TEXT | Hostname del computer |
| `azure_ad_device_id` | TEXT | ID dispositivo in Azure AD |
| `last_ad_sync_at` | TIMESTAMPTZ | Ultima sincronizzazione AD |
| `warranty_expiry_notified_for` | DATE | Data per cui è già stata inviata notifica scadenza |

### Modifiche a `document_signatures`

| Colonna | Tipo | Descrizione |
|---|---|---|
| `document_type` | TEXT (new) | Tipo documento: `portal_document`, `device_checkout`, `device_checkin` |
| `ticket_id` | UUID (new, nullable) | Riferimento al ticket |
| `device_id` | UUID (new, nullable) | Riferimento al device |

### Nuove funzioni PostgreSQL

| Funzione | Scheduling |
|---|---|
| `evaluate_device_deprecation()` | Settimanale (lunedì 7:00) |
| `send_warranty_expiry_alerts()` | Settimanale (lunedì 8:00) |
| `sync_azure_ad_device()` | Chiamata via API dall'agent |

### Nuove app settings

| Chiave | Default | Descrizione |
|---|---|---|
| `device_deprecation_max_age_years` | 3 | Età massima device prima della deprecazione |
| `device_deprecation_max_tickets_12m` | 5 | Ticket massimi in 12 mesi prima della deprecazione |

### Nuovo bucket Supabase Storage

| Bucket | MIME types |
|---|---|
| `device-documents` | PDF, immagini, Office, testo |

### Nuovo template email

| Event type | Descrizione |
|---|---|
| `warranty_expiring` | Notifica scadenza garanzia al cliente |

---

## 9. Riepilogo Modifiche UI

### DeviceDetailModal — Nuovi tab

| Tab | Contenuto |
|---|---|
| **Ciclo di vita** | Timeline fasi, bottone cambio fase, upload documenti |
| **Software** | Tabella software installato, badge obsolescenza |

### DeviceDetailModal — Modifiche tab esistenti

- **Info**: Bottone "Clona", campo hostname, dati sync Azure AD
- **Storico**: Include transizioni lifecycle e check-in/check-out

### Inventory Page

- Nuovo filtro per hostname
- Nuovo filtro per fase lifecycle
- Colonna "Fase" opzionale nella tabella
- Badge deprecazione nella riga device

### Ticket Detail

- Sezione "Check-in / Check-out" quando c'è un device assegnato
- Dialog firma digitale per check-out e check-in

### Admin Settings

- Nuove impostazioni per soglie deprecazione
- Configurazione template email warranty_expiring

---

## 10. Priorità di Implementazione

1. **Asset Lifecycle Tracking** (fondamentale per tutte le altre feature di ciclo vita)
2. **Deprecazione Automatica** (dipende dal lifecycle)
3. **Check-in / Check-out Device** (dipende da document_signatures)
4. **Alert Scadenza Garanzia** (indipendente, rapido)
5. **Clona Device** (indipendente, rapido)
6. **Software Inventory** (richiede agent separato)
7. **Integrazione Azure AD** (richiede agent separato)

---

## 11. Note Tecniche

- Tutte le nuove tabelle devono avere **RLS abilitata** con policy coerenti con il modello esistente (read: all authenticated, write: tech/admin, delete: admin).
- Le funzioni `pg_cron` devono essere create con `IF NOT EXISTS` e gestire il caso in cui l'estensione non sia disponibile.
- L'agent PCReady per software inventory e Azure AD è un **progetto separato** — il backend fornisce solo gli endpoint/funzioni di ricezione dati.
- La firma digitale per check-in/check-out riutilizza il flusso esistente di `document_signatures` (canvas → upload Supabase Storage → record DB).
