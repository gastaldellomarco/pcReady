# Contacts Enhancements — Specification

> **Status:** Draft — Awaiting implementation
> **Created:** 2026-06-05
> **Page:** `/contacts` (global rubric) + `/clients` (per-client contacts tab)
> **Interviews:** 4 rounds of user clarification completed

---

## Table of Contents
1. [Current State](#current-state)
2. [Feature 1: Merge Contatti Duplicati](#feature-1-merge-contatti-duplicati)
3. [Feature 2: Import CSV Migliorato](#feature-2-import-csv-migliorato)
4. [Feature 3: Storico Interazioni](#feature-3-storico-interazioni)
5. [Feature 4: Contatti Preferiti / Starred](#feature-4-contatti-preferiti--starred)
6. [Feature 5: Gruppi di Contatti](#feature-5-gruppi-di-contatti)
7. [Feature 6: Campo Note Privato](#feature-6-campo-note-privato)
8. [Feature 7: Stato Disponibilità](#feature-7-stato-disponibilità)
9. [Database Migrations](#database-migrations)
10. [i18n Keys](#i18n-keys)
11. [Implementation Phases](#implementation-phases)

---

## Current State

### Existing files
| File | Role |
|---|---|
| `src/routes/_app/contacts.tsx` | Route definition, meta tags |
| `src/routes/_app/contacts.lazy.tsx` | Main contacts page: `ContactsPage`, `GlobalContactCard`, modals |
| `src/routes/_app/clients.lazy.tsx` | Client detail page with contacts tab, `ImportContactsCsvDialog` |
| `src/lib/queries/clients.ts` | All contact queries: `fetchGlobalContacts`, `useGlobalContactsInfiniteList`, CRUD mutations |
| `src/lib/schemas/clients.ts` | Zod schemas: `ContactSchema`, `ClientSchema` |
| `src/i18n/locales/en/contacts.json` | English translations |
| `src/i18n/locales/it/contacts.json` | Italian translations |
| `supabase/migrations/20260430170000_split_assets_clients_tickets.sql` | Original `client_contacts` table creation |
| `supabase/migrations/20260430182000_expand_clients_contacts.sql` | Added `full_name`, `job_title`, `department`, `is_primary`, `notes` |

### Current `client_contacts` table columns
`id`, `client_id`, `first_name`, `last_name`, `full_name`, `email`, `phone`, `role`, `job_title`, `department`, `is_primary`, `notes`, `preferred_language`, `portal_2fa_enabled`, `portal_2fa_pending_code`, `portal_2fa_pending_expires`, `created_at`, `updated_at`

### Current features on `/contacts`
- Full-text search (name, company, email, phone, role)
- Filters: company, role, department, status (primary / portal active / missing email)
- Virtual list for >20 contacts (desktop grouped by company, mobile flat)
- Edit modal, portal link generation, delete with confirmation
- Portal badge (active / no access)

### Current features on `/clients` → contacts tab
- Contact CRUD (create, edit, delete)
- CSV import (`ImportContactsCsvDialog` — basic, fixed columns)
- Portal link generation/revocation

### No existing
- Duplicate detection or merge
- Starred/favorite contacts
- Contact groups
- Private notes (separate from `notes`)
- Contact availability status
- Interaction history tab per contact

---

## Feature 1: Merge Contatti Duplicati

### Detection Algorithm
- **Fuzzy name** match using Levenshtein or Dice coefficient
- **Exact email** match (case-insensitive, trimmed)
- Both conditions must be satisfied: name similarity ≥ threshold **AND** email equality
- Configurable similarity threshold (default: 0.75 on a 0–1 scale)
- Only compares contacts across the **same** client (not cross-client)

### Detection Flow
1. Background/batch scan: runs when admin opens the merge tool
2. Shows a list of potential duplicate pairs with similarity score
3. User selects a pair to merge → opens the merge wizard

### Merge Wizard
1. **Preview screen**: shows Contact A (survivor) and Contact B (source) side-by-side
2. **Field-by-field conflict resolution**: for each field where both contacts have non-null, different values:
   - Show Contact A value, Contact B value
   - User selects which value to keep (radio button per field)
   - Fields where only one contact has a value are auto-resolved (keep the populated one)
3. **Reassignment summary**:
   - `tickets.requester_contact_id` → reassigned to survivor
   - `portal_sessions.contact_id` → reassigned to survivor
   - `document_signatures.contact_id` → reassigned to survivor
   - Show count of each entity that will be moved
4. **Cleanup choice**:
   - Soft-delete: set `merged_into_id` and `merged_at` on source, filter out from lists
   - Hard-delete: delete source from DB entirely
5. **Execution**: single transaction, log to `activity_log`

### Fields considered for conflict resolution
`full_name`, `first_name`, `last_name`, `email`, `phone`, `job_title`, `department`, `is_primary`, `notes`, `is_starred`, `private_note`, `availability_status`, `return_date`, `group_id`

### Post-merge
- Invalidate all contacts queries (`["clients"]`, `["clients", clientId, "contacts"]`, `["clients", "contacts", "global"]`)
- Toast success message with summary
- Activity log entry: `type: "contact_merged"`, `message: "Contatti uniti: {survivor_name} ← {source_name}"`

### New DB columns on `client_contacts`
```sql
merged_into_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL,
merged_at TIMESTAMPTZ
```

---

## Feature 2: Import CSV Migliorato

### Improvements over existing `ImportContactsCsvDialog`
- **Field mapping UI**: instead of fixed column positions, user maps CSV columns to contact fields via dropdowns
- **Preview**: shows first 5 rows with mapped values before confirming
- **Validation per row**: highlight rows with invalid email, empty name, etc.
- **Duplicate detection during import**: check if email already exists for the same client, flag as "skip" or "update"
- **All fields mappable**: full_name (required), email, phone, job_title, department, notes, is_primary, is_starred

### Mapping UX
1. Upload CSV file
2. System reads headers
3. For each contact field, show a dropdown to select which CSV column maps to it
4. Auto-detect: try to match column names (e.g., "email" → email, "nome" → full_name)
5. Show preview table with 5 rows
6. User confirms → bulk insert

### Edge Cases
- Empty file: error toast
- No valid rows after validation: error message, stay in preview
- CSV encoding: auto-detect UTF-8, Latin-1, Windows-1252
- Large files: chunked read (max 5000 rows per import)
- Duplicate email (same client): show warning, option to skip or update existing
- Required field missing (full_name): row marked invalid, skipped

### vCard (.vcf) Support
- **Deferred to Phase 2** — not in initial implementation
- Future: parse VCard 3.0/4.0 format, extract FN, EMAIL, TEL, TITLE, ORG

---

## Feature 3: Storico Interazioni

### New tab on Contact Detail
- Accessible from the global contacts page by clicking a contact → opens a detail panel/modal with tabs
- One tab is "Interazioni" (or "Attività")

### Data Sources (aggregated, sorted by date DESC)
1. **Ticket**: tickets where `requester_contact_id` matches the contact
   - Show: ticket_code, title (software), status, created_at
   - Clickable → opens ticket detail
2. **Portal sessions**: `portal_sessions` where `contact_id` matches
   - Show: login time (created_at), expiry, revoked status
   - Grouped by session
3. **Email sent**: `activity_log` entries where `entity_type = 'client_contact'` and `action_type = 'email_sent'` and `entity_id` matches contact
   - Show: subject/message, sent_at
   - Requires: email logging to include `entity_type` and `entity_id` referencing the contact

### UI Layout
- Timeline-style list, newest first
- Three visual sections/categories with icons (Ticket, Portal, Email)
- Each item shows: type icon, timestamp, summary text
- Pagination: "Load more" button (fetch 20 at a time)
- Empty state: "Nessuna interazione registrata per questo contatto."

### Technical Notes
- The `activity_log` already supports `entity_type` and `entity_id`. Email sending code (`src/lib/email-templates.server.ts`) currently logs to `activity_log` but may need to add `entity_type: 'client_contact'` and `entity_id: contact.id`.
- `portal_sessions` already has `contact_id` FK
- `tickets` already has `requester_contact_id` FK

---

## Feature 4: Contatti Preferiti / Starred

### Database
```sql
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false;
```

### UI
- **Star icon** on each `GlobalContactCard`: clickable ⭐ toggle
- **New filter option** in the status filter dropdown: "Preferiti" (`starred`)
- Starred contacts are visually highlighted (subtle gold/warn background or border)
- The toggle calls an immediate Supabase update (optimistic UI update)

### Filter Integration
- The existing status filter (`all` | `primary` | `portalActive` | `missingEmail`) gets a new option: `starred`
- When `starred` filter is active, show only contacts with `is_starred = true`
- The star toggle works regardless of current filter

### Permissions
- Admin and tech can toggle star (same as edit permissions)

---

## Feature 5: Gruppi di Contatti

### Database
New table:
```sql
CREATE TABLE public.contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, name)
);
```

New column on `client_contacts`:
```sql
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.contact_groups(id) ON DELETE SET NULL;
```

### Scope
- **Per-client**: each client has its own groups
- One contact belongs to **at most one** group per client
- A contact without a group has `group_id = NULL`

### UI
1. **Group management** on the contacts page:
   - "Gestisci gruppi" button opens a modal
   - CRUD for groups within the selected client
   - Show group name, description, member count
2. **Assign contact to group**:
   - In the edit modal, add a dropdown "Gruppo" (nullable)
   - In the `GlobalContactCard`, show group badge
3. **Filter by group**:
   - New filter dropdown on the contacts page: "Filtra per gruppo"
   - Options: "Tutti i gruppi" + list of client's groups

### Group Actions (Phase 2)
- **Bulk email**: select a group, compose and send email to all members
- **Automation assignment**: assign an automation flow to a group
- **Export CSV**: export group members to CSV

### RLS Policies
```sql
-- All authenticated users can read groups
CREATE POLICY "All authed read contact_groups" ON public.contact_groups
  FOR SELECT TO authenticated USING (true);

-- Tech/admin can insert/update/delete groups
CREATE POLICY "Tech/admin manage contact_groups" ON public.contact_groups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
```

---

## Feature 6: Campo Note Privato

### Database
```sql
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS private_note TEXT;
```

### Behavior
- Simple text field (no versioning/history)
- Editable in the contact edit modal
- **Visibility**: only admin and tech users can see and edit `private_note`
- Hidden from the client portal entirely
- The existing `notes` field remains visible to all authenticated users (current behavior)

### UI
- In the edit modal, add a `Field` labeled "Note privata (visibile solo a tech/admin)"
- In the `GlobalContactCard`, if the user is admin/tech and `private_note` is populated, show a small indicator icon (🔒) with tooltip showing the note
- Color/styling: subtle dashed border or muted background to distinguish from regular notes

### RLS Consideration
The `notes` field is in the same table — RLS currently allows all authenticated users to SELECT. Since `private_note` is a simple column, we could:
- Handle visibility at the application level (don't show in portal API responses)
- Or create a separate RLS policy condition — but simpler to filter at app level

---

## Feature 7: Stato Disponibilità

### Database
```sql
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS availability_status TEXT
    CHECK (availability_status IS NULL OR availability_status IN ('available', 'vacation', 'sick_leave', 'unavailable')),
  ADD COLUMN IF NOT EXISTS return_date DATE;
```

### Behavior
- Manual flag set by tech/admin on the contact
- **Check-on-read**: no background job — when loading the contact, if `return_date` is in the past and `availability_status != 'available'`, display as "Disponibile" without writing to DB
- The actual DB columns are NOT automatically modified; the "auto-reset" is purely presentational
- The user can manually clear the status back to `null` (available)

### UI
- In the edit modal: dropdown for `availability_status` + date picker for `return_date`
- On the `GlobalContactCard`:
  - Badge showing status (e.g., "In ferie", "Non disponibile") with color coding
  - If `return_date` is set, show "Rientro: {date}"
  - If `return_date` is past, show as available (grayed out or not shown)
- Filter option: add "Non disponibili" to status filter to show contacts with active unavailability

### Status Types
| Status | Label IT | Label EN | Color |
|---|---|---|---|
| `available` | Disponibile | Available | green |
| `vacation` | In ferie | On vacation | amber |
| `sick_leave` | In malattia | Sick leave | red |
| `unavailable` | Non disponibile | Unavailable | gray |

---

## Database Migrations

### Migration 1: `YYYYMMDDHHMMSS_add_contact_enhancement_columns.sql`
```sql
-- Columns for merge, star, private notes, availability, groups
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS private_note TEXT,
  ADD COLUMN IF NOT EXISTS availability_status TEXT
    CHECK (availability_status IS NULL OR availability_status IN ('available', 'vacation', 'sick_leave', 'unavailable')),
  ADD COLUMN IF NOT EXISTS return_date DATE,
  ADD COLUMN IF NOT EXISTS group_id UUID; -- FK added in next migration
```

### Migration 2: `YYYYMMDDHHMMSS_create_contact_groups.sql`
```sql
CREATE TABLE public.contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, name)
);

ALTER TABLE public.contact_groups ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.client_contacts
  ADD CONSTRAINT client_contacts_group_id_fkey
    FOREIGN KEY (group_id) REFERENCES public.contact_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_client_contacts_is_starred ON public.client_contacts(is_starred);
CREATE INDEX idx_client_contacts_group_id ON public.client_contacts(group_id);
CREATE INDEX idx_client_contacts_availability ON public.client_contacts(availability_status);

CREATE TRIGGER contact_groups_updated BEFORE UPDATE ON public.contact_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "All authed read contact_groups" ON public.contact_groups
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Tech/admin manage contact_groups" ON public.contact_groups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
```

---

## i18n Keys

New keys needed in `src/i18n/locales/en/contacts.json` and `it/contacts.json`:

### Merge
- `merge.title`, `merge.detectDuplicates`, `merge.noDuplicates`, `merge.potentialDuplicates`
- `merge.wizardTitle`, `merge.fieldConflict`, `merge.keepA`, `merge.keepB`
- `merge.reassignSummary`, `merge.reassignTickets`, `merge.reassignPortalSessions`, `merge.reassignSignatures`
- `merge.cleanupLabel`, `merge.softDelete`, `merge.hardDelete`
- `merge.success`, `merge.error`

### Import
- `import.title`, `import.fieldMapping`, `import.preview`
- `import.columnFor`, `import.skipRow`, `import.updateExisting`, `import.duplicateWarning`
- `import.invalidRows`, `import.rowsImported`, `import.rowsSkipped`

### Interaction History
- `history.title`, `history.empty`, `history.loadMore`
- `history.ticketOpened`, `history.portalLogin`, `history.emailSent`
- `history.ticketClosed`

### Starred
- `starred.toggleOn`, `starred.toggleOff`, `starred.filter`

### Groups
- `groups.title`, `groups.manage`, `groups.create`, `groups.edit`, `groups.delete`
- `groups.name`, `groups.description`, `groups.memberCount`
- `groups.assignLabel`, `groups.noGroup`, `groups.filterLabel`

### Private Notes
- `privateNote.label`, `privateNote.tooltip`, `privateNote.visibleTo`

### Availability
- `availability.label`, `availability.status`, `availability.returnDate`
- `availability.available`, `availability.vacation`, `availability.sickLeave`, `availability.unavailable`
- `availability.filter`, `availability.returnLabel`

---

## Implementation Phases

### Phase 1 — Core (all 7 features, frontend + backend)
1. **DB migrations** (2 new migration files)
2. **Type updates** (`src/integrations/supabase/types.ts` — regenerate)
3. **Query layer** (`src/lib/queries/clients.ts`):
   - New queries: `fetchContactInteractionHistory`, `useContactInteractionHistory`
   - New queries: `fetchContactGroups`, `useContactGroups`, CRUD mutations
   - New queries: `fetchDuplicateCandidates`, `useDuplicateCandidates`
   - New mutation: `mergeContacts`
   - Updated `fetchGlobalContacts` to include `is_starred`, `private_note`, `availability_status`, `return_date`, `group_id`
4. **Schema updates** (`src/lib/schemas/clients.ts`): add new fields to `ContactSchema`
5. **Frontend** (`src/routes/_app/contacts.lazy.tsx`):
   - Star toggle on `GlobalContactCard`
   - New filter "Preferiti"
   - Availability badge on card
   - Group badge on card
   - Private note indicator
   - Contact detail panel/modal with interaction history tab
   - Merge wizard component
6. **Frontend** (`src/routes/_app/clients.lazy.tsx`):
   - Improved CSV import with field mapping
   - Group management UI
   - Group assignment in contact edit modal
   - Private note field in contact modal
   - Availability fields in contact modal
7. **i18n**: all new keys in EN and IT

### Phase 2 — Advanced
1. vCard (.vcf) import support
2. Bulk group actions (email, automation assignment)
3. Email tracking enhancement (log `entity_type` and `entity_id` for contacts)
4. Merge auto-suggest on contact creation (warn if similar contact exists)

---

## Key Design Decisions Summary

| Decision | Choice |
|---|---|
| Merge conflict strategy | Manual field-by-field selection |
| Merge cleanup | Admin chooses soft-delete or hard-delete |
| Import formats Phase 1 | CSV only (vCard deferred) |
| Group membership | One-to-many (one contact → one group) |
| Interaction history sources | Tickets + portal sessions + emails |
| Private notes versioning | Simple text field, no history |
| Availability auto-reset | Check-on-read (no DB write) |
| Group actions | Email + automations + export (Phase 2) |
| Duplicate detection | Fuzzy name + exact email |
| Starred UI | Filter in search bar + star icon on card |
| Merge reassignments | Tickets + portal_sessions + document_signatures |
| Group scope | Per-client |
| CSV field mapping | All fields mappable with dropdown |
| Private note visibility | Admin + tech only |
| DB migration strategy | Dedicated migration files per feature area |

---

## Open Questions for Future
- Should fuzzy name matching use Levenshtein or Dice coefficient? (Levenshtein is simpler, Dice handles reordering better)
- Should the duplicate detection run automatically on page load or on-demand?
- For the interaction history: should we show email content preview or just subject?
- What's the exact similarity threshold for fuzzy name matching? (0.75 proposed, configurable)
