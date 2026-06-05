# Widget Annotations — Design Spec

**Date:** 2026-05-28
**Status:** Approved
**Feature:** Commenti/annotazioni personali sui widget della dashboard

## Overview

Permettere agli utenti di aggiungere note testuali personali ai widget della dashboard, con data opzionale per contestualizzare il commento (es. "picco per aggiornamento Windows del 28/05"). Due modalità di interazione: icona inline sul widget (rapida) e drawer aggregato con tutte le note.

## Requirements Summary

| Aspect      | Decision                                           |
| ----------- | -------------------------------------------------- |
| Visibility  | **Personal** — each user sees only their own notes |
| Granularity | **Widget + optional date**                         |
| Interaction | **Inline icon + aggregated drawer**                |
| Backend     | **Dedicated table** (`widget_annotations`)         |

## Database Schema

```sql
CREATE TABLE public.widget_annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_id     TEXT NOT NULL,   -- Maps to WidgetId type (e.g. "stat-cards", "analytics-card", ...)
  text          TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  note_date     DATE,            -- Optional context date
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_widget_annotations_user ON widget_annotations(user_id);
CREATE INDEX idx_widget_annotations_widget ON widget_annotations(user_id, widget_id);
CREATE INDEX idx_widget_annotations_date  ON widget_annotations(user_id, note_date);

ALTER TABLE public.widget_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own annotations"
  ON public.widget_annotations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- `widget_id` uses string values from the existing `WidgetId` type: `"stat-cards"`, `"analytics-card"`, `"devices-without-ticket"`, `"tickets-without-device"`, `"trend-chart"`, `"recent-tickets"`, `"status-distribution"`, `"technician-heatmap"`, `"recent-activity"`, `"overdue-tickets"`, `"team-activity"`, `"technician-stats"`, `"critical-events"`, `"warranty-overview"`, `"maintenance-overview"`.
- `note_date` is `DATE` (not `TIMESTAMPTZ`) — represents a day, not an instant.
- `text` capped at 500 chars for reasonable note length.
- RLS: simple `user_id = auth.uid()` filter.

## Architecture

### New Files

| File                                                        | Purpose                                            |
| ----------------------------------------------------------- | -------------------------------------------------- |
| `supabase/migrations/20260528150000_widget_annotations.sql` | Migration creating the table                       |
| `src/lib/widget-annotations.ts`                             | Server functions for CRUD (createServerFn pattern) |
| `src/hooks/useWidgetAnnotations.ts`                         | React Query hook for fetch/mutate                  |
| `src/components/dashboard/WidgetAnnotationBadge.tsx`        | Inline sticky-note icon on widget                  |
| `src/components/dashboard/WidgetAnnotationsDrawer.tsx`      | Aggregated drawer listing all notes                |

### Modified Files

| File                                 | Change                                              |
| ------------------------------------ | --------------------------------------------------- |
| `src/routes/_app/dashboard.lazy.tsx` | Integrate badge on widgets, drawer button in header |

### Server Functions (`src/lib/widget-annotations.ts`)

Following existing project patterns (`src/lib/notifications.ts`, `src/lib/user-profile.ts`):

```ts
// Types
export interface WidgetAnnotationRow {
  id: string;
  user_id: string;
  widget_id: string;
  text: string;
  note_date: string | null;
  created_at: string;
  updated_at: string;
}

// CRUD functions
export const listWidgetAnnotations; // fetch all (or by widget_id)
export const createWidgetAnnotation; // insert
export const updateWidgetAnnotation; // update text/date
export const deleteWidgetAnnotation; // delete
```

Each uses `createServerFn({ method: "POST" })` with `accessToken` validation and `supabaseAdmin` (server-side client). No rate limiting needed — ultra-low volume operations.

### Hook (`src/hooks/useWidgetAnnotations.ts`)

```ts
export function useWidgetAnnotations(userId: string, widgetId?: string) {
  // useQuery → listWidgetAnnotations(widgetId?)
  // useMutation → createWidgetAnnotation  (with optimistic update)
  // useMutation → updateWidgetAnnotation  (with optimistic update)
  // useMutation → deleteWidgetAnnotation  (with optimistic update)
  return { annotations, isLoading, create, update, remove };
}
```

### Component Tree

```
DashboardPage
├── Header
│   ├── WidgetSettingsPanel button (existing)
│   └── "Note" button → WidgetAnnotationsDrawer  ← NEW
├── visibleWidgets.map(w => (
│   <div className="relative">
│     <WidgetAnnotationBadge widgetId={w.id} />   ← NEW
│     {renderWidget(w.id, ctx)}
│   </div>
│ ))
```

## UI Design

### WidgetAnnotationBadge

- Positioned `absolute top-2 right-2` on each widget wrapper.
- Uses `StickyNote` icon from Lucide (size `w-4 h-4`).
- Visibility: `opacity-0 group-hover:opacity-100 transition-opacity` (appears on widget hover).
- When notes exist for this widget: shows a small colored dot (`w-2 h-2 rounded-full bg-accent absolute -top-0.5 -right-0.5`).
- Click opens `WidgetAnnotationPopover` (inline Popover from shadcn).
- Mobile: always visible (not hover-dependent).

### WidgetAnnotationPopover (inline, triggered by badge)

- Uses shadcn `Popover` + `PopoverContent` (already in project via NotificationBell).
- Width: `w-72`.
- Header: "Note" title + count badge.
- Body: scrollable list of existing notes, each showing:
  - Text (2-line clamp, `text-[13px]`)
  - Date badge if present (small pill, `text-[11px]`)
  - Edit ✏️ and delete 🗑️ icon buttons (appear on row hover)
- Footer: inline form with:
  - `<textarea>` (3 rows, placeholder "Aggiungi una nota...", `text-[13px]`)
  - Optional `<input type="date">`
  - "Salva" button (or save on Ctrl+Enter / blur with content)
- Empty state: "Nessuna nota per questo widget."

### WidgetAnnotationsDrawer

- Triggered by "Note" button in dashboard header (next to widget settings button).
- Uses shadcn `Drawer` component (already imported in `src/components/pcready/Modal.tsx`).
- Layout:
  - Header: "Le mie annotazioni" title + close button.
  - Filter: horizontal scrollable tabs for widgets that have notes + "Tutti" tab.
  - Content: notes grouped by widget, ordered by `note_date DESC` then `created_at DESC`.
  - Each note card: widget name label, text, date badge, edit/delete actions.
- Empty state: "Nessuna annotazione. Clicca l'icona 📝 su un widget per aggiungerne una."
- Mobile: bottom sheet via `Drawer`.

## Data Flow

```
useWidgetAnnotations(userId, widgetId?)
  ├── useQuery(["widget-annotations", userId, widgetId])
  │     → listWidgetAnnotations({ accessToken, widgetId })
  │     → Supabase RLS filters by user_id automatically
  ├── useMutation → createWidgetAnnotation({ accessToken, annotation })
  │     → Optimistic: append to cache, rollback on error
  ├── useMutation → updateWidgetAnnotation({ accessToken, id, updates })
  │     → Optimistic: update in cache, rollback on error
  └── useMutation → deleteWidgetAnnotation({ accessToken, id })
        → Optimistic: remove from cache, rollback on error
```

React Query `queryClient.invalidateQueries` after mutations to keep drawer and badges in sync.

## Error Handling

- **Fetch failed**: toast error "Errore nel caricamento delle annotazioni", badge hidden.
- **Create/Update failed**: toast error "Salvataggio non riuscito", form text preserved (not lost).
- **Delete failed**: toast error "Eliminazione non riuscita", note remains visible.
- **Optimistic rollback**: React Query `onMutate` with `onError` rollback to previous cache state.

## Testing Plan

| Test file                                                 | Coverage                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `src/__tests__/lib/widget-annotations.test.ts`            | Server functions: CRUD operations, validation, error paths |
| `src/__tests__/hooks/useWidgetAnnotations.test.ts`        | Hook: query/mutation lifecycle, optimistic updates         |
| `src/__tests__/components/WidgetAnnotationBadge.test.tsx` | Component: rendering, click, popover display               |

## Out of Scope

- Shared/team annotations (future possibility)
- Rich text formatting (plain text only)
- Real-time sync across tabs (user-specific, low contention)
- Attachments or links in notes
- Export of annotations
