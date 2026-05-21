# Mobile Responsiveness Audit - PCReady

Date: 2026-05-21

## Scope

Target breakpoints: 320, 375, 390, 768, 1024 px.

Primary areas reviewed:

- App shell: header, sidebar, mobile navigation sheet, main content container.
- Shared overlays: custom `Modal`, Radix `Dialog`, `AlertDialog`, `Sheet`.
- Shared dense content: `OverflowTable`, tabs, cards, buttons, inputs.
- Core screens touched directly: Dashboard and Inventory.
- Existing areas noted for follow-up: Kanban drag/drop, Calendar dense views, admin audit/OAuth tables, PDF previews.

## Findings

Blocking issues addressed:

- Desktop header CTAs consumed too much mobile width.
- Main content could inherit desktop padding and create cramped layouts.
- Custom modals did not reliably become full-screen on 320-390 px viewports.
- Dialog and alert dialog content could exceed the viewport height.
- Inventory table had too many columns for phones.
- Dashboard stat grid used two columns on the smallest phones.

Medium issues addressed:

- Touch targets on buttons/icon controls were too small in several shared paths.
- Tabs could overflow when many labels were visible.
- Dashboard widget settings drawer had small drag/visibility controls.
- Dense dashboard tables lacked explicit minimum table widths inside scroll containers.

Cosmetic issues addressed:

- Long stat values and labels could overflow cards.
- Mobile card/table containers lacked consistent `min-w-0` and word breaking.

## Implemented Fixes

Shared responsive primitives:

- App shell now uses `min-h-dvh`, `overflow-x-hidden`, mobile padding, and truncating page title.
- Mobile header hides desktop CTAs and exposes a single icon CTA for new tickets.
- Navigation links meet a 44 px touch target.
- Buttons, small buttons, icon buttons, and inputs have mobile-friendly minimum sizes.
- Inputs use 16 px font size on mobile to avoid iOS zoom.
- `break-anywhere`, safe-area, and touch scroll utilities added.

Overlays:

- `src/components/pcready/Modal.tsx` is full-screen on mobile and constrained on desktop.
- `src/components/ui/dialog.tsx` is full-screen/scrollable on mobile and centered on desktop.
- `src/components/ui/alert-dialog.tsx` is inset and scrollable on mobile.
- `src/components/ui/sheet.tsx` close target is touch-friendly.

Dense content:

- `OverflowTable` is a focusable horizontal scroll region with touch scrolling.
- Tabs scroll horizontally on small screens.
- Dashboard stat cards collapse to one column on phones.
- Inventory uses mobile cards below `md`, while keeping the full table for tablet/desktop.

## Manual/Static Checks

Completed:

- ESLint targeted on touched files: passed.
- `git diff --check` on touched files: passed.
- Vite dev server started and returned HTTP 200 once on `127.0.0.1:5177`.

Blocked or incomplete:

- Full `bun run typecheck` still fails due to pre-existing unrelated errors in:
  - `src/__tests__/CreateTicketModal.test.tsx`
  - `src/__tests__/webhook-ssrf.test.ts`
  - `src/components/admin/AdminOAuthTab.tsx`
  - `src/lib/server/attachmentUtils.server.ts`
  - `src/lib/server/staff-auth.server.ts`
  - `vite.config.ts`
- Browser-based visual verification across all breakpoints was not completed because the background dev server did not remain reachable from this shell.

## Residual Risks

- Kanban drag/drop still needs a touch-specific move alternative.
- Calendar day/week layouts need portrait and landscape validation.
- Admin audit/OAuth screens have dense controls and should receive card fallbacks or simplified mobile filters.
- PDF previews/exports are generated artifacts; mobile preview UX may need separate validation.
- Some route-specific tables still rely on horizontal scroll rather than mobile card views.

## Definition Of Done Status

- Audit completed: partial, focused on app shell/shared components/core routes.
- Fix responsive applied to core screens: yes for shell, dashboard, inventory, overlays.
- Breakpoint testing: static and startup checks only; manual visual QA still required.
- Desktop regression risk: mitigated by desktop-only preservation of table and centered dialog behavior.
