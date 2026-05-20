Mobile Responsiveness Audit — pcready

Date: 2026-05-20

Goal

- Make the app fully usable on mobile: responsive layout, touch-friendly controls, no horizontal overflow, accessible basics.

Primary routes (first-pass)

- / (index)
- /auth (login, set-password, callback, 2fa)
- /portal (dashboard, devices, profile, tickets, documents)
- /\_app (dashboard, tickets, kanban, calendar, inventory, clients, contacts, automations, admin, etc.)

Components and areas to review (first-pass, by severity)

Blocking

- Global header/topbar: ensure collapsed / sticky behavior on mobile and visible CTAs.
- Tables used in admin pages (clients, inventory, audit): risk of horizontal overflow and unreadable columns.
- Dialogs/modals (alert-dialog, EmailPreviewDialog, CreateTicketModal): may not fit small screens; need full-screen/drawer fallback.
- Complex interactive components: Kanban (drag/drop), calendar, charts — touch alternatives required.

Medium

- Sidebar: currently has a mobile `Sheet` implementation — verify accessibility, focus management, and closing behavior.
- Dropdowns/popovers/tooltips relying on hover.
- Forms: input sizes, labels, keyboard types, error UX on small screens.

Cosmetic

- Dense cards/widgets with many columns or small text sizes.
- Long tables without prioritized columns.

Quick wins (low-effort, high-impact)

- Ensure `<meta name="viewport" content="width=device-width, initial-scale=1">` present in HTML shell.
- Add `max-w-full` and `overflow-x-auto` wrappers to table containers.
- Convert critical modals to `full-screen` on <480px (or use `Sheet`/Drawer). Ensure scroll-lock.
- Increase default touch target sizes for buttons and icon-only controls via utility class (min-44).
- Add `break-words` and prevent `white-space: nowrap` on long labels.

Breakpoints & strategy

- Mobile-first breakpoints to target: 320, 375, 390, 768, 1024.
- Use Tailwind responsive utilities and a shared spacing/typography scale for mobile density.
- Avoid hover-only interactions; augment with tap affordances.

Suggested next technical steps (prioritized)

1. Implement a project-level `mobile-primitives` stylesheet and Tailwind config adjustments (spacing, touch target utility, safe-area insets).
2. Audit and wrap all tables with an `OverflowTable` wrapper that provides horizontal scroll and an optional card fallback.
3. Convert modals that don't fit into `Sheet` (left/right/bottom) or full-screen dialogs at small widths.
4. Review Kanban + drag/drop: provide a tap-to-move alternative and disable drag-on-touch by default.
5. Update header and sidebar behavior: mobile header with hamburger opening `Sidebar` sheet; ensure focus trap and escape to close.
6. Run manual tests on viewports: 320, 375, 390, 768 (portrait & landscape where relevant).

Files/places to start

- `src/components/ui/sidebar.tsx` — already has mobile `Sheet` behavior; verify focus/escape and hit area.
- `src/components/pcready/CreateTicketModal` — modals need review.
- `src/components/*` (admin, tickets, dashboard) — inspect tables and dense layouts.
- `src/styles.css` and `tailwind.config.ts` — add mobile-friendly variables and utilities.

Acceptance checklist

- No horizontal overflow on target viewports.
- Touch targets >= 44px where applicable.
- Forms readable and usable without zoom.
- Modals usable (full-screen/drawer) with visible CTA.
- Key interactive components have touch-friendly alternatives.

Next action I can take now

- (A) Implement `mobile-primitives` changes in `tailwind.config.ts` + `src/styles.css` (mobile-first spacing, touch target utility, safe-area handling). Or
- (B) Begin converting selected modal (`CreateTicketModal`) to full-screen sheet on small screens and wrap tables with scroll container.

I can implement A or B now — tell me which to start with or I can proceed with A by default.
