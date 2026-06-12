# Checklist Enhancements — Design Spec

**Date:** 2026-06-03
**Status:** Approved
**Page:** `/checklist`

## Summary

Four enhancements to the checklist feature, implemented incrementally in order of complexity:

1. **Categorie / tag template** — Free multi-tags on templates with sidebar filtering
2. **Progress bar per template** — Completion stats in template list based on `ticket_checklist_instances`
3. **Sezioni / gruppi collassabili** — Two-level hierarchy (groups → sections → items) with collapsible sections
4. **Export PDF compilato** — Generate PDF of completed checklist instance via `@react-pdf/renderer`

One feature already exists and requires no work: **Duplica template** (already present as "Duplica" button with `Copy` icon).

## Implementation Approach

**Approach A: Incremental** — each feature in its own DB → UI cycle, smallest first.

Order: Tags → Progress → Groups → PDF

---

## Feature 1: Categorie / Tag Template

### Data Model

Add a `tags` column to `checklist_templates`:

```sql
ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
```

Free-form string array: `["Onboarding", "Security"]`. No separate tables, no referential integrity constraints — YAGNI.

### UI — Template Editor

Below the description field in `TemplateEditor`:
- Tag input field with autocomplete from existing tags
- Tags displayed as removable chips
- Auto-save on blur / Enter

### UI — Sidebar Template List

Filter bar above the template list:
- Most-frequently-used tags (by occurrence count across all templates) shown as toggleable chips
- Text search also matches against tag names
- Client-side filtering (real-time)

### Files Affected

| File | Change |
|---|---|
| Migration `add_checklist_template_tags` | Add `tags text[]` column |
| `src/lib/queries/checklist.ts` | `Template` interface + `tags` in fetch |
| `src/routes/_app/checklist.lazy.tsx` | Tag input in editor, tag filter in sidebar |
| `src/i18n/locales/it/checklist.json` | New i18n keys |
| `src/i18n/locales/en/checklist.json` | New i18n keys |
| `supabase/seed_demo_full.sql` | Tags in seed data |

---

## Feature 2: Progress Bar per Template

### Data

Aggregate query on `ticket_checklist_instances`:

```sql
SELECT template_id,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'completed') AS completed
FROM ticket_checklist_instances
WHERE template_id IS NOT NULL
GROUP BY template_id
```

Mapped as `Record<string, { total: number; completed: number }>`.

### UI — Sidebar

Below the item count in each template card:

```
████████████░░░░  8/12 completate (67%)
```

- Hidden when `total === 0`
- Thin bar (4px), `--success` for completed, `--border2` for remainder
- Mono text: `text-[10px] font-mono text-text3`

### Files Affected

| File | Change |
|---|---|
| `src/lib/queries/checklist.ts` | New `useTemplateCompletionStats()` query |
| `src/routes/_app/checklist.lazy.tsx` | Progress bar in sidebar template card |
| `src/i18n/locales/it/checklist.json` | New i18n keys |

### Performance

Lightweight GROUP BY on FK-indexed column. Invalidated alongside other checklist queries.

---

## Feature 3: Sezioni / Gruppi Collassabili

### Current Model (Flat)

```typescript
type ChecklistStructure = Record<string, {
  label: string;
  items: ChecklistItemDef[];
  assigned_to?: string | null;
}>;
```

### New Model (Two-Level)

```typescript
type ChecklistGroup = {
  label: string;
  collapsed?: boolean;       // persisted collapse state
  sections: Record<string, {
    label: string;
    items: ChecklistItemDef[];
    assigned_to?: string | null;
  }>;
};

type ChecklistStructure = Record<string, ChecklistGroup>;
```

Example:

```json
{
  "grp_hw": {
    "label": "Hardware",
    "collapsed": false,
    "sections": {
      "sec_fisico": {
        "label": "Verifica fisica",
        "items": [{ "id": "i1", "text": "Controllo ventole" }],
        "assigned_to": null
      },
      "sec_bios": {
        "label": "BIOS/UEFI",
        "items": [{ "id": "i2", "text": "Aggiornamento firmware" }]
      }
    }
  }
}
```

### Backward Compatibility

- **Read:** `parseChecklistStructure()` detects old format and auto-wraps ALL existing flat sections into a single default `"Generale"` group
- **Write:** always saves in new format (groups + sections)
- **Migration:** none needed — handled at application level
- **Seed:** update `seed_demo_full.sql` to produce new format

### UI — Editor (Two Levels)

**Level 1 — Groups:** Accordion with expand/collapse toggle
- "Add group" button
- Drag & drop to reorder groups
- Each group shows section + item counts

**Level 2 — Sections (inside expanded group):** Tabs like today
- Sections become collapsible with twistie toggle
- Items, types, drag, technician assignment remain unchanged

### UI — Preview Mode

Collapsed groups visible but dimmed, clickable to expand.

### Files Affected

| File | Change |
|---|---|
| `src/types/checklist-structure.ts` | New `ChecklistGroup`, `ChecklistSection` types; backward-compat parsing |
| `src/lib/pcready.ts` | Update `ChecklistStructure`, `DEFAULT_STRUCTURE` |
| `src/routes/_app/checklist.lazy.tsx` | Two-level UI: groups accordion + collapsible sections |
| `src/lib/queries/checklist.ts` | Update `Template` interface |
| `src/components/pcready/TicketDetailModal.tsx` | Render groups/sections in ticket detail |
| `src/components/pcready/CreateTicketModal.tsx` | Update structure handling |
| `src/i18n/locales/it/checklist.json` | New keys (groups, collapse, expand) |
| `src/i18n/locales/en/checklist.json` | New keys |
| `supabase/seed_demo_full.sql` | New format seed data |

### Risk

`ticket_checklist_instances.structure` is a snapshot. Pre-migration instances have old format. `parseChecklistStructure()` must handle both formats indefinitely.

---

## Feature 4: Export PDF Compilato

### Flow

Same pattern as `ticket-completion.server.ts`:

1. User clicks "Export PDF" on a completed checklist instance (in TicketDetailModal)
2. Server function generates PDF with `@react-pdf/renderer`
3. Uploads to Supabase Storage `completions/` bucket
4. Returns public URL → opens in new tab
5. PDF also attached to ticket attachments (inserts a row into `ticket_attachments` with the Supabase Storage URL)

### PDF Layout (`ChecklistInstancePdf.tsx`)

- **Header:** PCReady logo, checklist title, ticket code, client name
- **Body:** Each group/section rendered with:
  - Group name → section name
  - Items: checked/unchecked boxes, text/number values shown inline
  - Signature at bottom (if `signature_name` present)
- **Footer:** Completion date, completing technician

### Server Function

New function in `src/lib/ticket-completion.server.ts`: `generateChecklistInstancePdf(instanceId)`

### UI Trigger

`Printer` button next to completed instances in `TicketDetailModal` checklist tab, alongside existing "PDF cliente" / "PDF tecnico" buttons.

### Files Affected

| File | Change |
|---|---|
| `src/components/pcready/pdf/ChecklistInstancePdf.tsx` | **New** — PDF document component |
| `src/lib/ticket-completion.server.ts` | New `generateChecklistInstancePdf()` |
| `src/lib/ticket-completion.ts` | Client wrapper |
| `src/components/pcready/TicketDetailModal.tsx` | Export button in checklist view |
| `src/i18n/locales/it/checklist.json` | New i18n keys |
| `src/i18n/locales/en/checklist.json` | New i18n keys |

### Constraints

- Only `status === 'completed'` instances show the button
- Uses existing shared PDF components (`BrandedPage`, `PdfSection`, `pdfPalette`)

---

## Cross-Cutting Concerns

### Versioning

All template changes (including tags, groups) continue to use the existing `createVersion` mechanism via `VersionHistoryDrawer`.

### i18n

New translation keys added to both `it/checklist.json` and `en/checklist.json` for each feature.

### Type Safety

`@/integrations/supabase/types.ts` is auto-generated. Database column additions (tags) will be reflected there after regeneration.

### Testing

- TypeScript typecheck after each feature
- Manual smoke test on `/checklist` page
- Existing checklist tests (`src/__tests__/CreateTicketModal.test.tsx`) should continue to pass

---

## Implementation Order

1. **Tags** — DB migration, queries, UI, i18n
2. **Progress** — Stats query, sidebar progress bar, i18n
3. **Groups** — Type changes, backward-compat parser, editor UI, detail modal, i18n
4. **PDF** — PDF component, server function, UI trigger, i18n
