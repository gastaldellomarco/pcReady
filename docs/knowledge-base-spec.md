# Knowledge Base `/docs` — Specification

> **Status:** Approved — Pending Implementation  
> **Date:** 2026-06-05  
> **Author:** Codebuff + Marco G.

---

## 1. Overview

Transform the current `/docs` route from a simple **Swagger UI OpenAPI viewer** into a full **Knowledge Base portal** covering the entire pcReady ecosystem.

### 1.1 Goals

- **Onboarding**: A new developer must be able to clone, configure, and run the project in < 10 minutes using only the KB.
- **Maintainability**: All technical content lives in `.mdx` files, decoupled from React components.
- **Visual clarity**: Mermaid diagrams embedded directly in articles for ER models, data flows, and process lifecycles.
- **Mobile responsive**: Sidebar transforms into a drawer on mobile devices.

### 1.2 What happens to existing `/docs`

| Element | Fate |
|---------|------|
| Swagger UI (`swagger-ui-react`) | **Removed completely** — no longer rendered anywhere on `/docs` |
| OpenAPI spec (`/openapi/openapi.yaml`) | Kept on disk, described textually in the API section via MDX |
| `src/routes/_app/docs.tsx` | Rewritten (route config only) |
| `src/routes/_app/docs.lazy.tsx` | Rewritten (Knowledge Base page component) |
| Existing `docs/` folder | Replaced — old files can be archived/removed; KB lives in `src/content/docs/` |
| `.qoder/repowiki/en/content/` | Not used as source; new content written from scratch |

---

## 2. Access Control

| Role | Can access `/docs`? |
|------|--------------------|
| `admin` | ✅ Yes |
| `tech` | ✅ Yes |
| `viewer` | ❌ No (redirected to `/dashboard`) |

- If unauthenticated or unauthorized, redirect to `/dashboard` (existing behavior preserved).
- Navigation item label stays as "API Docs" in sidebar → update i18n keys to "Knowledge Base".

---

## 3. Content Architecture

### 3.1 File Location

All KB content lives in:

```
src/content/docs/
├── 01-onboarding/
│   ├── _meta.json          (optional ordering metadata)
│   ├── 01-local-setup.mdx
│   ├── 02-env-config.mdx
│   ├── 03-supabase-migrations.mdx
│   └── 04-first-run.mdx
├── 02-architecture/
│   ├── 01-system-overview.mdx
│   ├── 02-data-flow.mdx
│   └── 03-state-management.mdx
├── 03-database/
│   ├── 01-er-model.mdx
│   ├── 02-rls-policies.mdx
│   └── 03-migrations-guide.mdx
├── 04-features/
│   ├── 01-ticket-lifecycle.mdx
│   ├── 02-pdf-generation.mdx
│   └── 03-automation-system.mdx
├── 05-api/
│   ├── 01-supabase-edge-functions.mdx
│   ├── 02-webhooks.mdx
│   └── 03-openapi-spec.mdx
└── index.mdx                (landing page / overview)
```

### 3.2 Five Macro Sections

| # | Section | Purpose |
|---|---------|---------|
| 🚀 | **Onboarding & Setup** | Local install, `.env` configuration, Supabase migrations — get running in < 10 min |
| 🏗️ | **Architecture & Flow** | System diagrams, data flow (UI ⇄ Repositories ⇄ DB), TanStack state management |
| 🗄️ | **Database Schema** | ER model, RLS policies, migration guide |
| ⚙️ | **Feature Lifecycle** | Ticket flow (OPEN ⇄ CLOSED), PDF generation, automations |
| 🔌 | **API & Integrations** | Supabase Edge Functions, webhooks, OpenAPI reference |

### 3.3 Content Format — MDX

- **Engine**: MDX v3 (`.mdx` files), processed by `@mdx-js/rollup` / `@mdx-js/react`
- **Frontmatter**: YAML at top of each file for metadata:
  ```yaml
  ---
  title: "Local Setup"
  description: "How to set up pcReady on your local machine"
  order: 1
  ---
  ```
- **Mermaid diagrams**: Embedded directly via a custom `<Mermaid>` component or code fence:
  ````mdx
  ```mermaid
  erDiagram
    TICKETS ||--o{ TICKET_DEVICE_ASSIGNMENTS : links
  ```
  ````
- **Code blocks**: Syntax highlighting via **Shiki** + copy-to-clipboard button on each block.
- **Language**: English only (KB is developer-facing, English is the lingua franca).

### 3.4 File Naming Convention

Files use numeric prefixes for ordering:
```
01-local-setup.mdx    → renders first
02-env-config.mdx     → renders second
```

Optional `_meta.json` per directory can override labels and order:
```json
{
  "01-local-setup": { "label": "Local Setup", "icon": "Monitor" },
  "02-env-config": { "label": "Environment Variables" }
}
```

---

## 4. UI / Layout Specification

### 4.1 Page Layout — Full Width

- **The main app sidebar (navigation) is hidden** when on `/docs`.
- The KB occupies the full viewport width.
- Layout: **Two columns** — Sidebar (left, ~280px) + Content area (right, fluid).

```
┌──────────────────────────────────────────────────┐
│  [App Header / Breadcrumb]                        │
├────────────┬─────────────────────────────────────┤
│            │                                      │
│  Sidebar   │         Content Area                 │
│  (280px)   │         (fluid)                      │
│            │   ┌─────────────────────────────┐    │
│  🚀 Onboard│   │ # Local Setup               │    │
│    Setup   │   │                              │    │
│    .env    │   │ Content here...              │    │
│    Migrat. │   │                              │    │
│  🏗️ Archit.│   │ ```mermaid                  │    │
│  🗄️ DB     │   │   diagram...                │    │
│  ⚙️ Features│   │ ```                         │    │
│  🔌 API    │   │                              │    │
│            │   └─────────────────────────────┘    │
│            │                                      │
│            │   ┌─── ToC (sticky right) ───┐       │
│            │   │ • Prerequisites           │       │
│            │   │ • Installation            │       │
│            │   │ • Configuration           │       │
│            │   └───────────────────────────┘       │
└────────────┴─────────────────────────────────────┘
```

### 4.2 Sidebar Component

- **Auto-generated** from the filesystem structure under `src/content/docs/`.
- Uses **shadcn/ui** components:
  - `ScrollArea` for scrollable sidebar
  - `Accordion` for collapsible sections
- **Active section highlighting** based on current URL hash.
- Each section has an icon (from `lucide-react`), configured via `_meta.json` or mapped by convention.
- **Mobile**: Sidebar becomes a **Sheet/Drawer** (shadcn/ui `Sheet`) triggered by a hamburger/menu button. Uses `use-mobile.tsx` hook for detection.

### 4.3 Content Area

- Renders the selected `.mdx` file using MDX components.
- **Sticky Table of Contents** on the right side (~200px, hidden on mobile):
  - Auto-generated from `<h2>` and `<h3>` headings in the current article.
  - Highlights the currently visible heading (Intersection Observer).
  - Clicking a ToC item scrolls to that heading.
- **"Last updated" timestamp** displayed at the top of each article:
  - Extracted from the git history of the `.mdx` file at build time.
  - Fallback: file modification time or frontmatter `updatedAt`.
- **Breadcrumb** at top: `Home > Architecture > Data Flow`

### 4.4 Deep Linking (Hash Routing)

- Each article and each heading within an article has an anchor ID.
- URL format: `/docs#03-database/02-rls-policies` or `/docs#03-database/02-rls-policies#row-level-security-basics`
- The sidebar syncs its active state with the URL hash.
- Browser back/forward works correctly.
- Sharing a link takes the user directly to that section.

### 4.5 Landing Page (`index.mdx`)

When no hash is present (bare `/docs`), renders an overview/landing page with:
- Welcome message and KB purpose
- Quick links to each of the 5 macro sections (card grid)
- Link to the OpenAPI spec for API reference

---

## 5. Technical Implementation

### 5.1 Packages to Add

```bash
bun add @mdx-js/react @mdx-js/rollup
bun add shiki          # syntax highlighting
bun add mermaid        # diagram rendering (client-side)
bun add rehype-slug    # auto-add IDs to headings for deep linking
bun add rehype-autolink-headings  # anchor links on headings
bun add remark-frontmatter  # YAML frontmatter parsing
bun add remark-gfm     # GitHub Flavored Markdown (tables, strikethrough, etc.)
```

### 5.2 Vite Configuration

Add MDX plugin to `vite.config.ts`:
```ts
import mdx from '@mdx-js/rollup'

export default defineConfig({
  plugins: [
    // ... existing plugins
    mdx({
      remarkPlugins: [remarkGfm, remarkFrontmatter],
      rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings],
    }),
  ],
})
```

### 5.3 Component Tree

```
src/
├── routes/_app/
│   ├── docs.tsx              (route config — updated metadata)
│   └── docs.lazy.tsx         (KnowledgeBasePage — main component)
├── components/docs/
│   ├── KnowledgeBaseLayout.tsx   (full-width shell, hides main sidebar)
│   ├── DocsSidebar.tsx           (auto-generated sidebar with Accordion)
│   ├── DocsSidebarMobile.tsx     (Sheet/Drawer for mobile)
│   ├── DocsContent.tsx           (MDX renderer + ToC)
│   ├── DocsToC.tsx               (sticky table of contents)
│   ├── DocsBreadcrumb.tsx        (breadcrumb navigation)
│   ├── MermaidDiagram.tsx        (Mermaid renderer wrapper)
│   ├── CodeBlock.tsx             (Shiki syntax highlighting + copy button)
│   └── DocCard.tsx               (used on landing page)
├── content/docs/
│   ├── index.mdx
│   ├── 01-onboarding/
│   ├── 02-architecture/
│   ├── 03-database/
│   ├── 04-features/
│   └── 05-api/
└── lib/
    └── docs.server.ts           (build-time: scan filesystem, read git dates, generate sidebar tree)
```

### 5.4 Build-time Content Index

A server utility (`src/lib/docs.server.ts`) runs at **build time** to:

1. Scan `src/content/docs/` recursively.
2. Parse each `.mdx` file's frontmatter (`title`, `description`, `order`).
3. Read `_meta.json` per directory for label/icon overrides.
4. Extract git last-modified date for each file via `git log -1 --format=%aI -- <file>`.
5. Generate a **sidebar tree** JSON structure used by `DocsSidebar`.
6. Generate a **content map** for hash-based routing.

This data is imported by the client-side components (or passed via a virtual module).

### 5.5 MDX Component Mapping

Custom components provided to `MDXProvider`:

| Markdown element | React component | Notes |
|-----------------|-----------------|-------|
| ` ```mermaid ` | `<MermaidDiagram>` | Client-side rendering with `mermaid` library |
| ` ```ts `, ` ```sql `, etc. | `<CodeBlock>` | Shiki highlighting + copy button |
| `h2`, `h3` | Custom heading with anchor | `rehype-slug` adds IDs; heading rendered with `#` permalink |
| `a` | `<Link>` / `<a>` | External links open in new tab; internal hash links handled by router |
| `table` | Custom table | Styled with Tailwind (border, striped rows) |
| `img` | Custom image | Responsive, lightbox on click? |

### 5.6 Mermaid Integration

```tsx
// src/components/docs/MermaidDiagram.tsx
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "default",         // or sync with app theme (light/dark)
  securityLevel: "loose",
});

export function MermaidDiagram({ children }: { children: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid.render(id, children)
      .then(({ svg }) => setSvg(svg))
      .catch((err) => setError(err.message));
  }, [children]);

  if (error) return <div className="text-danger text-sm">{error}</div>;
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

- Mermaid renders **client-side only** (requires DOM).
- SSR gracefully shows a placeholder/loading state.
- Theme (light/dark) should match the app's current theme.

### 5.7 Code Block with Shiki + Copy

```tsx
// src/components/docs/CodeBlock.tsx
// Uses Shiki for syntax highlighting at build time or client-side
// Includes a "Copy" button (lucide-react Clipboard icon)
// Shows "Copied!" feedback via sonner toast
```

### 5.8 Hash Routing Implementation

- Use `window.location.hash` + `hashchange` event (or TanStack Router's `useLocation`).
- Parse hash format: `#<category>/<file>[/#<heading>]`
- On hash change: load and render the matching `.mdx` file.
- Scroll to heading if specified.

Since TanStack Router uses file-based routing, the hash handling is done **client-side within the `KnowledgeBasePage` component**, not as separate routes.

### 5.9 Mobile Responsiveness

- **Breakpoint**: `< 768px` (Tailwind `md:`)
- **Sidebar**: Hidden by default on mobile; triggered by a hamburger button in the top bar.
- **Drawer**: Uses shadcn/ui `Sheet` component, sliding from the left.
- **ToC**: Hidden on mobile (only sidebar drawer available).
- **Content**: Full width on mobile.
- Detection: Existing `use-mobile.tsx` hook (`src/hooks/use-mobile.tsx`).

---

## 6. Implementation Phases

### Phase 1: Layout & Shell (estimated: 3-4 components)

1. Create `KnowledgeBaseLayout.tsx` — full-width shell, hides main sidebar.
2. Create `DocsSidebar.tsx` — auto-generated from filesystem tree, uses `ScrollArea` + `Accordion`.
3. Create `DocsSidebarMobile.tsx` — `Sheet` wrapper for mobile.
4. Create `DocsContent.tsx` — MDX renderer placeholder.
5. Update `docs.tsx` and `docs.lazy.tsx` — new route configuration.
6. Update `navigation.ts` — change label from "API Docs" to "Knowledge Base".
7. Update i18n (`common.json` IT/EN) — new strings for KB sections.

### Phase 2: Content & MDX Rendering (estimated: 5-7 content files + renderer)

1. Set up MDX processing in Vite config.
2. Create `CodeBlock.tsx` (Shiki + copy).
3. Create `MermaidDiagram.tsx`.
4. Write `index.mdx` (landing page).
5. Write ~15-20 `.mdx` files across 5 sections.
6. Create `DocsToC.tsx` (sticky ToC).
7. Create `docs.server.ts` (build-time content index).
8. Wire up hash routing in `DocsContent.tsx`.

### Phase 3: Polish & Diagram Integration (estimated: remaining diagrams + refinements)

1. Add all Mermaid diagrams to content files.
2. Add "Last updated" timestamps from git.
3. Add breadcrumb navigation.
4. Mobile drawer + hamburger integration.
5. Test full navigation flow and all acceptance criteria.

---

## 7. Acceptance Criteria

| # | Criterion | How to verify |
|---|-----------|---------------|
| AC1 | **Setup Autonomy**: A new developer clones the repo, follows the Onboarding section, and runs the project successfully | Manual walkthrough |
| AC2 | **Mobile Responsive**: Sidebar transforms into drawer on screens < 768px | Resize browser / test on mobile device |
| AC3 | **Content Updatability**: All technical text resides in `.mdx` files; editing a file updates the KB without touching React components | Edit a `.mdx` file, refresh, verify changes |
| AC4 | **Access Control**: `viewer` role redirected away; `admin`/`tech` can access | Test with each role |
| AC5 | **Deep Linking**: Sharing `/docs#03-database/02-rls-policies` opens that article | Copy URL, open in new tab |
| AC6 | **Mermaid Rendering**: ER diagrams and flowcharts render correctly | Verify all diagrams display |
| AC7 | **Code Blocks**: Syntax highlighting works; copy button copies to clipboard | Click copy, paste, verify |
| AC8 | **ToC Navigation**: Clicking ToC item scrolls to heading; current section highlighted | Scroll article, observe ToC |
| AC9 | **Sidebar Auto-generation**: Adding a new `.mdx` file to a content directory automatically appears in the sidebar | Add a test file, refresh |
| AC10 | **Full-width Layout**: Main app sidebar hidden when on `/docs` | Navigate to /docs, verify |

---

## 8. Open Questions / Future Enhancements

| Item | Priority | Notes |
|------|----------|-------|
| **Print/Export to PDF** per article | Low | Nice-to-have for offline reading |
| **Search functionality** | Low | User opted out; could be added later with client-side index |
| **Bilingual content (IT/EN)** | Low | User opted for English only initially |
| **Swagger UI alternative route** | Low | Could add `/api-docs` route later if needed |
| **Dark mode Mermaid theme** | Medium | Sync Mermaid theme with app's light/dark mode |
| **Image lightbox** | Low | For screenshots in onboarding section |

---

## 9. Files to Create

```
src/content/docs/index.mdx
src/content/docs/01-onboarding/01-local-setup.mdx
src/content/docs/01-onboarding/02-env-config.mdx
src/content/docs/01-onboarding/03-supabase-migrations.mdx
src/content/docs/01-onboarding/04-first-run.mdx
src/content/docs/02-architecture/01-system-overview.mdx
src/content/docs/02-architecture/02-data-flow.mdx
src/content/docs/02-architecture/03-state-management.mdx
src/content/docs/03-database/01-er-model.mdx
src/content/docs/03-database/02-rls-policies.mdx
src/content/docs/03-database/03-migrations-guide.mdx
src/content/docs/04-features/01-ticket-lifecycle.mdx
src/content/docs/04-features/02-pdf-generation.mdx
src/content/docs/04-features/03-automation-system.mdx
src/content/docs/05-api/01-supabase-edge-functions.mdx
src/content/docs/05-api/02-webhooks.mdx
src/content/docs/05-api/03-openapi-spec.mdx
src/components/docs/KnowledgeBaseLayout.tsx
src/components/docs/DocsSidebar.tsx
src/components/docs/DocsSidebarMobile.tsx
src/components/docs/DocsContent.tsx
src/components/docs/DocsToC.tsx
src/components/docs/DocsBreadcrumb.tsx
src/components/docs/MermaidDiagram.tsx
src/components/docs/CodeBlock.tsx
src/components/docs/DocCard.tsx
src/lib/docs.server.ts
```

## 10. Files to Modify

```
src/routes/_app/docs.tsx              (update metadata)
src/routes/_app/docs.lazy.tsx         (complete rewrite)
src/lib/navigation.ts                 (update label: "API Docs" → "Knowledge Base")
src/i18n/locales/en/common.json       (add KB-related strings)
src/i18n/locales/it/common.json       (add KB-related strings)
vite.config.ts                        (add MDX plugin)
package.json                          (new dependencies)
```

## 12. Content Outline — Per-Article Detail

> Each article below lists the `###` sections (h2/h3 headings) that will form the ToC,
> the Mermaid diagrams to include, and the code examples/types to show.

---

### 🚀 Section 1: Onboarding & Setup

**Goal**: A new developer clones the repo and runs `bun run dev` in < 10 min.

---

#### 1.1 — `01-local-setup.mdx` — Local Setup

| Field | Value |
|-------|-------|
| **Frontmatter title** | `Local Setup` |
| **Mermaid diagrams** | `graph TB` — Dev toolchain: Bun → Vite → React + Supabase |
| **Code examples** | `bun install`, `bun run dev`, folder structure tree |

**Content sections:**

- **Prerequisites** — Bun >= 1.x, Git, a Supabase account (free tier OK), Node >= 22
- **Cloning the repo** — `git clone`, branch strategy (`main` / `develop`)
- **Installing dependencies** — `bun install`, what `bun.lockb` is, why not npm
- **Project structure tour** — High-level walkthrough of `src/`, `supabase/`, `public/`, `scripts/`, `docs/`
- **Package manager & toolchain** — Bun scripts (`dev`, `build`, `lint`, `typecheck`, `test`), Vite dev server with HMR
- **Windows notes** — Bun works on Windows; some verification commands can use `npm.cmd`

---

#### 1.2 — `02-env-config.mdx` — Environment Variables

| Field | Value |
|-------|-------|
| **Frontmatter title** | `Environment Variables` |
| **Mermaid diagrams** | `flowchart TD` — Client vs server env var flow (VITE_\* → bundle, SUPABASE_\* → server) |
| **Code examples** | `.env.example` contents, `cp .env.example .env.local`, Supabase dashboard screenshots (described) |

**Content sections:**

- **The `.env.example` file** — Template reference, copying to `.env.local`
- **Supabase variables** — `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — where to find them in Supabase dashboard
- **Client vs Server variables** — `VITE_*` prefix (build-time, embedded in bundle) vs unprefixed (runtime, server-only). Security: never put `SERVICE_ROLE_KEY` in a `VITE_*` var
- **SMTP / Email** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` for nodemailer
- **Optional vars** — `VITE_DEPLOYMENT_LABEL`, `VITE_MAINTENANCE_MODE`/`VITE_MAINTENANCE_END`, Upstash Redis for distributed rate limiting
- **CI/CD secrets** — GitHub Secrets needed: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

---

#### 1.3 — `03-supabase-migrations.mdx` — Supabase Migrations

| Field | Value |
|-------|-------|
| **Frontmatter title** | `Supabase Migrations` |
| **Mermaid diagrams** | `flowchart LR` — Migration lifecycle: create → apply → verify → seed |
| **Code examples** | SQL migration snippet (ticket_code trigger), `bun run migrations:check` output |

**Content sections:**

- **What are migrations?** — Versioned SQL files that define the database schema; ordered by timestamp in filename
- **Migration naming convention** — `YYYYMMDDHHMMSS_descriptive_name.sql`
- **Key migrations overview** — Table of the most important migrations: core schema, auth/RBAC, automations, tickets, devices, costs, bundles, calendar, notifications, client portal
- **Applying migrations** — Via Supabase CLI (`supabase db push`) or Supabase dashboard SQL editor
- **The seed system** — `supabase/seed.sql` (base) and `supabase/seed_demo_full.sql` (rich demo data); idempotent with `ON CONFLICT`
- **Validating migrations** — `bun run migrations:check` script (validates filenames, SQL syntax, merge conflicts, dollar-quoted blocks)
- **The `ticket_code` trigger** — Server-side unique code generation via PostgreSQL sequence `ticket_seq`, avoiding client-side collisions

---

#### 1.4 — `04-first-run.mdx` — First Run & Quality Checks

| Field | Value |
|-------|-------|
| **Frontmatter title** | `First Run & Quality Checks` |
| **Mermaid diagrams** | `flowchart TD` — Quality pipeline: lint → typecheck → test → build → deploy |
| **Code examples** | `bun run dev`, `bun run build`, `bun run lint`, `bun run typecheck`, `bun run test` |

**Content sections:**

- **Starting the dev server** — `bun run dev`, what to expect (Vite HMR, TanStack Router devtools)
- **Building for production** — `bun run build` → `dist/`, `bun run preview`
- **Linting** — `bun run lint` (ESLint flat config), Prettier formatting (`bun run format`)
- **Type checking** — `bun run typecheck` (tsc --noEmit), strict mode, path aliases (`@/` → `src/`)
- **Unit tests** — `bun run test` (Vitest), `bun run test:watch`, coverage reports
- **E2E tests** — `bun run test:e2e` (Playwright), test files in `e2e/`: auth-flow, kanban-drag, ticket-flow
- **Database utilities** — `bun run db:backup`, `bun run db:reset`
- **CI/CD pipeline** — GitHub Actions: CI on PR (lint, typecheck, migrations check, build), deploy on push to main (Cloudflare Workers)

---

### 🏗️ Section 2: Architecture & Flow

**Goal**: Understand how data moves through the system, from UI to database and back.

---

#### 2.1 — `01-system-overview.mdx` — System Overview

| Field | Value |
|-------|-------|
| **Frontmatter title** | `System Overview` |
| **Mermaid diagrams** | `graph TB` — Full stack: Browser ↔ Cloudflare Workers ↔ Vite/React ↔ Supabase (Auth, DB, Storage, Realtime) |
| | `graph TB` — Source tree: routes/ → components/ → lib/ → integrations/supabase/ → Postgres |
| **Code examples** | `vite.config.ts` alias config, `tsconfig.json` path aliases, `src/router.tsx` |

**Content sections:**

- **Technology stack** — React 19 + TypeScript, TanStack Router/Start (file-based routing), Vite 7, Supabase (Postgres + Auth + RLS + Realtime), shadcn/ui + Tailwind CSS 4, Cloudflare Workers (Wrangler)
- **High-level architecture** — SPA served by Cloudflare Workers, Supabase as BaaS (auth, database, real-time), no traditional backend server
- **Directory conventions** — What goes where: `src/lib/` (business logic), `src/components/` (UI), `src/routes/` (pages), `src/hooks/` (custom hooks), `src/integrations/` (third-party)
- **Import aliases** — `@/` → `src/`, `@root/` → project root
- **Key libraries** — TanStack Query (server state), React Hook Form + Zod (forms/validation), Recharts (charts), ReactFlow (flow diagrams), CodeMirror (code editor), jsPDF/pdfkit/@react-pdf/renderer (PDFs)

---

#### 2.2 — `02-data-flow.mdx` — Data Flow

| Field | Value |
|-------|-------|
| **Frontmatter title** | `Data Flow` |
| **Mermaid diagrams** | `sequenceDiagram` — Ticket creation: User → CreateTicketModal → createTicket server fn → Supabase → Postgres → ticket_code trigger → response |
| | `sequenceDiagram` — Page load: Route → useQuery → supabase-js → Postgres → RLS check → rows → React render |
| **Code examples** | `createTicket` server function signature, `useQuery` hook usage, Supabase client initialization |

**Content sections:**

- **Request lifecycle** — TanStack Router matches URL → lazy-loads route component → component mounts → queries fire → data renders
- **Server functions** — `createServerFn` pattern: server-only code that runs in Cloudflare Workers, called from client like a regular async function
- **TanStack Query layer** — `useQuery` / `useMutation` for server state; caching, refetching, optimistic updates
- **Supabase client** — Two clients: browser client (`VITE_SUPABASE_*` vars, RLS-enforced) and server client (`SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS)
- **Real-time subscriptions** — Supabase Realtime for live updates on tickets, devices, notifications; `useRealtimeTable` hook
- **File-based routing** — How `src/routes/` maps to URLs; `_app` layout route wrapping authenticated pages

---

#### 2.3 — `03-state-management.mdx` — State Management

| Field | Value |
|-------|-------|
| **Frontmatter title** | `State Management` |
| **Mermaid diagrams** | `graph LR` — State layers: URL state (TanStack Router) → Server state (TanStack Query) → Client state (React useState/useContext) → Form state (React Hook Form) |
| **Code examples** | Auth context, `useTickets` hook, `useAuth` context pattern |

**Content sections:**

- **State architecture** — Four layers of state: URL (router), server (TanStack Query cache), client (React state), form (React Hook Form)
- **Auth context** — `AuthProvider` wraps the app; provides `session`, `profile`, `signOut`, `refreshProfile`; role-based access (`admin`, `tech`, `viewer`)
- **TanStack Query patterns** — Query keys convention, `staleTime` / `gcTime` settings, invalidation after mutations
- **Custom hooks** — `useTickets`, `useDashboardData`, `useAutomationRules`, `useAdminAudit` — each encapsulates a domain's data fetching
- **Real-time hooks** — `useRealtimeTable` for live subscriptions; cleanup on unmount
- **Mobile detection** — `useIsMobile` hook (960px breakpoint) used throughout the app for responsive layouts

---

### 🗄️ Section 3: Database Schema

**Goal**: Understand the data model, relationships, and security policies.

---

#### 3.1 — `01-er-model.mdx` — ER Model

| Field | Value |
|-------|-------|
| **Frontmatter title** | `Entity-Relationship Model` |
| **Mermaid diagrams** | `erDiagram` — Full ER diagram: USERS, ROLES, CLIENTS, CONTACTS, DEVICES, TICKETS, TICKET_DEVICE_ASSIGNMENTS, ENTITIES_VERSIONS, AUTOMATION_FLOWS, CALENDAR_EVENTS, BUNDLES, COSTS, CHECKLIST_TEMPLATES, NOTIFICATIONS |
| | `erDiagram` — Simplified core: CLIENTS → CONTACTS, CLIENTS → DEVICES, CLIENTS → TICKETS, TICKETS → TICKET_DEVICE_ASSIGNMENTS ← DEVICES |
| **Code examples** | SQL DDL snippets for core tables (tickets, devices, clients) |

**Content sections:**

- **Core entities** — `users` (auth, roles), `clients` (companies), `client_contacts` (people at clients), `devices` (physical assets), `tickets` (work items)
- **Join tables** — `ticket_device_assignments` (many-to-many), `user_roles`, `entity_versions` (audit/versioning)
- **Feature entities** — `automation_flows` + `automation_run_logs`, `checklist_templates` + `ticket_checklist_instances`, `calendar_events`, `assistance_bundles` + `bundle_assignments`, `costs` (labor + materials)
- **Auxiliary entities** — `notifications`, `email_templates`, `app_settings`, `oauth_clients`, `activity_log`, `audit_log`
- **Key relationships** — Client owns devices and tickets; tickets reference devices, clients, and contacts; tickets have status history, notes, attachments, time entries, relations
- **Migrations directory** — 85+ migrations in `supabase/migrations/`, chronologically ordered

---

#### 3.2 — `02-rls-policies.mdx` — RLS Policies

| Field | Value |
|-------|-------|
| **Frontmatter title** | `Row-Level Security Policies` |
| **Mermaid diagrams** | `flowchart LR` — RLS decision tree: Is user admin? → full access. Is user tech? → org-scoped CRUD. Is user viewer? → read-only. Is client portal user? → own data only. |
| **Code examples** | RLS policy SQL for tickets table, devices table, automation_flows |

**Content sections:**

- **What is RLS?** — Postgres Row-Level Security: policies attached to tables that filter rows per user
- **Role-based access model** — Three staff roles: `admin` (full access), `tech` (operational CRUD), `viewer` (read-only). Plus `client_user` for portal.
- **Policy examples for `tickets`** — Admins: all rows. Techs: tickets they created or are assigned to. Viewers: read-only on all. Client users: only their company's tickets.
- **Policy examples for `devices`** — Similar scoping by client relationship
- **Policy examples for `automation_flows`** — Admin-only write; techs can read
- **Bypassing RLS** — Server functions use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS when needed (e.g., ticket creation, audit logging)
- **Key migration files** — `*_admin_user_management_rls.sql`, `*_add_rls_policies_automation_flows.sql`, `*_tickets_tech_delete_policy.sql`

---

#### 3.3 — `03-migrations-guide.mdx` — Migrations Guide

| Field | Value |
|-------|-------|
| **Frontmatter title** | `Migrations Guide` |
| **Mermaid diagrams** | `flowchart TD` — Creating a migration: Identify need → Write SQL → Name file correctly → Test locally → Apply to staging → Deploy to production |
| **Code examples** | Migration template with `BEGIN; ... COMMIT;`, validation script output |

**Content sections:**

- **Migration philosophy** — One migration per change, ordered by timestamp, never edit applied migrations
- **File naming** — `YYYYMMDDHHMMSS_descriptive_name.sql`; examples from the project
- **Writing a migration** — Template: `BEGIN;` / `COMMIT;`, idempotent patterns (`IF NOT EXISTS`, `DROP ... IF EXISTS`)
- **Testing migrations** — Apply locally with Supabase CLI, run `bun run migrations:check`
- **Seed data** — `supabase/seed.sql` for essential reference data; `supabase/seed_demo_full.sql` for rich demo data; idempotent with `ON CONFLICT DO NOTHING`
- **Rollback strategy** — Forward-only migrations; rollback = new migration that reverses the change
- **Common patterns** — Adding columns, creating tables, adding RLS policies, creating triggers/functions, backfilling data

---

### ⚙️ Section 4: Feature Lifecycle

**Goal**: Document the business processes digitalized by the application.

---

#### 4.1 — `01-ticket-lifecycle.mdx` — Ticket Lifecycle

| Field | Value |
|-------|-------|
| **Frontmatter title** | `Ticket Lifecycle` |
| **Mermaid diagrams** | `stateDiagram-v2` — pending → in-progress → testing → ready → completed → archived; with conditions (checklist status, SLA triggers) |
| | `sequenceDiagram` — Full ticket flow: Create → Assign → Progress → Complete (with checklist, attachments, time tracking, PDF) |
| **Code examples** | Ticket creation server function, status transition logic, `ticket_status_history` insert |

**Content sections:**

- **Ticket creation** — `CreateTicketModal`: client, contact, device selection; checklist template assignment; priority, type, OS, software fields
- **Ticket codes** — Server-side generation via PostgreSQL sequence `ticket_seq` + trigger; format, uniqueness guarantees
- **Status flow** — `pending` → `in-progress` → `testing` → `ready` → `completed` → `archived`; each transition tracked in `ticket_status_history`
- **Kanban board** — Drag-and-drop status changes; WIP limits per status column; bulk actions
- **Checklist system** — Templates define sections + items; instances created per ticket; progress tracking
- **SLA tracking** — SLA deadlines based on priority/type; warnings and violations tracked
- **Attachments & notes** — File uploads, public/private notes, time tracking entries
- **Ticket relations** — Linking related tickets, device assignments
- **Client portal** — Magic-link login for clients; ticket creation and status viewing

---

#### 4.2 — `02-pdf-generation.mdx` — PDF Generation

| Field | Value |
|-------|-------|
| **Frontmatter title** | `PDF Generation` |
| **Mermaid diagrams** | `flowchart LR` — PDF pipelines: Client-side (jsPDF + autotable → Inventory/Ticket PDFs) vs Server-side (pdfkit → Ticket completion PDF with error fallback) |
| **Code examples** | `InventoryPdf.tsx` component, `TicketListPdf.tsx`, server-side `ticket-completion.server.ts` PDF generation |

**Content sections:**

- **Client-side PDFs** — `@react-pdf/renderer` for Inventory PDF and Ticket List PDF; rendered in-browser, uses current page filters, 500-row limit
- **Server-side PDFs** — `pdfkit` for ticket completion PDFs; generated server-side, attached to ticket, emailed to client
- **PDF components** — `InventoryPdf.tsx`, `TicketListPdf.tsx`, `InvoicePdf.tsx`, `AuditLogReportPdf.tsx`
- **Shared PDF primitives** — `BrandedPage`, `PdfSection`, `PdfTable`, `StatStrip` in `src/components/pcready/pdf/shared.tsx`
- **Error handling** — Graceful fallback: raw valid PDF bytes with error message when pdfkit import fails
- **Design system alignment** — PDF palette (`pdfPalette`) mirrors the app's CSS custom properties
- **Performance** — Row limits (500 max) to prevent browser hang; server-side generation offloads heavy work

---

#### 4.3 — `03-automation-system.mdx` — Automation System

| Field | Value |
|-------|-------|
| **Frontmatter title** | `Automation System` |
| **Mermaid diagrams** | `flowchart TD` — Automation flow: Trigger (ticket.created, ticket.status_changed, schedule) → Conditions (field comparisons) → Actions (update ticket, update device, send email) |
| | `classDiagram` — AutomationFlow, Trigger, Condition, Action, Schedule, RunLog |
| **Code examples** | Flow builder DSL, validation rules, guardrail code |

**Content sections:**

- **Automation architecture** — Flows stored in `automation_flows` table; DSL/JSON structure; executed server-side
- **Triggers** — Event-based: `ticket.created`, `ticket.status_changed`, `device.updated`; Schedule-based: cron expressions
- **Conditions** — Field comparisons (equals, contains, greater than, etc.); AND/OR grouping; variable interpolation
- **Actions** — Update ticket fields, update device fields, send email (via nodemailer + email templates)
- **Flow builder UI** — `AutomationWizard` component: step-by-step wizard (Trigger → Conditions → Actions → Schedule → Review)
- **Validation & guardrails** — `flow-validation.ts`: structural validation of flow JSON; `automation-guardrails.ts`: rate limits, max actions per flow, dry-run mode
- **Run logs** — `GlobalRunLogsPanel`, `RunLogDrawer`: execution history, success/failure, timing
- **KPIs & monitoring** — `AutomationKpiCard`, `AutomationKpiHeader`: success rate, run count, last run time
- **Versioning** — Flows have version numbers and change notes for audit trail

---

### 🔌 Section 5: API & Integrations

**Goal**: Technical specifications for interacting with external systems.

---

#### 5.1 — `01-supabase-edge-functions.mdx` — Supabase Edge Functions / Server Functions

| Field | Value |
|-------|-------|
| **Frontmatter title** | `Supabase Server Functions` |
| **Mermaid diagrams** | `sequenceDiagram` — Client → TanStack Start server fn → Cloudflare Worker → Supabase (auth check → query → RLS) → response |
| **Code examples** | `createServerFn` pattern, rate limiting, auth validation, Supabase admin client usage |

**Content sections:**

- **Server function pattern** — `createServerFn` from TanStack Start: define server-only logic, callable from client like a normal function
- **How they execute** — Run in Cloudflare Workers (not Supabase Edge Functions); access to `SUPABASE_SERVICE_ROLE_KEY`
- **Key server functions** — Ticket creation/completion, device CRUD, automation execution, user management, notification dispatch, PDF generation, audit logging
- **Authentication** — Server functions validate the caller's session token before executing
- **Rate limiting** — In-memory sliding window (single process) or distributed via Upstash Redis; configurable limits per function
- **Error handling** — Structured error responses; logging via `activity_log`
- **File locations** — `src/lib/*.server.ts` (e.g., `ticket-completion.server.ts`, `automation-runs.server.ts`, `notifications.server.ts`)

---

#### 5.2 — `02-webhooks.mdx` — Webhooks & Notifications

| Field | Value |
|-------|-------|
| **Frontmatter title** | `Webhooks & Notifications` |
| **Mermaid diagrams** | `flowchart LR` — Notification pipeline: Event (ticket.created, ticket.completed, SLA breached) → Channel routing (email, in-app, both) → nodemailer / realtime → User |
| **Code examples** | nodemailer transport config, email template usage, notification preferences schema |

**Content sections:**

- **Notification system overview** — Event-driven: actions in the app trigger notifications dispatched to users based on preferences
- **Email notifications** — `nodemailer` with SMTP config; HTML email templates from `email_templates` table; template variables
- **In-app notifications** — Real-time via Supabase Realtime subscriptions; `NotificationBell` + `NotificationInbox` components
- **Notification preferences** — Per-user channel preferences (email on/off, in-app on/off) stored in `user_profiles`; per-notification-type opt-in/out
- **Email templates** — Stored in DB (`email_templates` table): ticket created, ticket completed, SLA warning, etc.; HTML with variable substitution
- **OAuth 2.0** — Server-side OAuth provider for third-party integrations; client management, consent flow, scopes
- **OpenAPI spec** — `/openapi/openapi.yaml` describes available endpoints; used by Swagger UI (previously on /docs)

---

#### 5.3 — `03-openapi-spec.mdx` — OpenAPI Specification

| Field | Value |
|-------|-------|
| **Frontmatter title** | `OpenAPI Specification` |
| **Mermaid diagrams** | None (reference documentation) |
| **Code examples** | YAML snippets from `public/openapi/openapi.yaml`, curl examples, auth header format |

**Content sections:**

- **Where to find the spec** — `public/openapi/openapi.yaml`; auto-generated from server function definitions
- **Authentication** — Bearer JWT (session `access_token`) and `apikey` header (Supabase publishable key)
- **Available endpoints** — Tickets (CRUD, status transitions), Devices (CRUD), Clients & Contacts, Automations (list, trigger), Users (admin), Audit logs, Calendar events
- **Using the spec** — Import into Postman/Insomnia; generate client SDKs; Swagger UI (available at `/openapi/openapi.yaml` directly)
- **Common patterns** — Pagination (`range` headers), filtering (query params), error responses (JSON with `error` field)
- **Rate limits** — Per-endpoint limits documented in the spec; 429 responses with `Retry-After` header

---

## 13. Content Writing Guidelines

### 13.1 MDX Frontmatter Template

Every `.mdx` file starts with:

```yaml
---
title: "Article Title"
description: "One-sentence summary shown in previews and SEO"
order: 1
---
```

### 13.2 Section Structure Convention

Each article should follow this flow:

1. **Opening paragraph** — 2-3 sentences explaining what this article covers and why it matters
2. **Main sections** — `##` headings for major topics, `###` for subtopics (these become the ToC)
3. **Mermaid diagrams** — At least one per article where applicable; placed early to give visual overview
4. **Code examples** — Real code from the project, never invented; use ` ```ts `, ` ```sql `, ` ```bash `, ` ```yaml `
5. **Cross-references** — Link to other KB articles where relevant (e.g., ER Model → RLS Policies)
6. **Callouts** — Use `> **Note:**` blockquotes for warnings, tips, and important caveats

### 13.3 Diagram Conventions

- Use `mermaid` code fences: ` ```mermaid `
- ER diagrams: `erDiagram` for database relationships
- Flowcharts: `flowchart TD` (top-down) or `flowchart LR` (left-right)
- Sequence diagrams: `sequenceDiagram` for request/response flows
- State diagrams: `stateDiagram-v2` for status lifecycles
- Class diagrams: `classDiagram` for type/entity hierarchies

### 13.4 Code Example Conventions

- Always use real code from the project (copy-paste from source files, not invented)
- Show file paths in comments: `// src/lib/tickets.ts`
- Use ` ```ts ` for TypeScript, ` ```sql ` for SQL, ` ```bash ` for terminal commands
- Keep snippets focused (5-20 lines); link to full source file for context

### 13.5 Voice & Tone

- **Professional, direct, instructional** — This is technical documentation for developers
- **Second person** — "You" for the reader ("You can find this in...")
- **Present tense** — "The function creates a ticket" not "The function will create a ticket"
- **Active voice** — "The trigger generates the code" not "The code is generated by the trigger"
- **English only** — KB is developer-facing; English is the lingua franca

---

## 14. Mermaid Diagrams Index

A quick reference of all diagrams to create:

| # | Article | Diagram Type | Description |
|---|---------|-------------|-------------|
| 1 | Local Setup | `graph TB` | Dev toolchain: Bun → Vite → React + Supabase |
| 2 | Env Config | `flowchart TD` | Client vs server env var flow |
| 3 | Supabase Migrations | `flowchart LR` | Migration lifecycle: create → apply → verify → seed |
| 4 | First Run | `flowchart TD` | Quality pipeline: lint → typecheck → test → build → deploy |
| 5 | System Overview | `graph TB` | Full stack architecture |
| 6 | System Overview | `graph TB` | Source tree architecture |
| 7 | Data Flow | `sequenceDiagram` | Ticket creation flow |
| 8 | Data Flow | `sequenceDiagram` | Page load / query flow |
| 9 | State Management | `graph LR` | State layers: URL → Server → Client → Form |
| 10 | ER Model | `erDiagram` | Full entity-relationship diagram |
| 11 | ER Model | `erDiagram` | Simplified core entities |
| 12 | RLS Policies | `flowchart LR` | RLS decision tree by role |
| 13 | Migrations Guide | `flowchart TD` | Creating and applying a migration |
| 14 | Ticket Lifecycle | `stateDiagram-v2` | Ticket status flow |
| 15 | Ticket Lifecycle | `sequenceDiagram` | Full ticket lifecycle |
| 16 | PDF Generation | `flowchart LR` | Client vs server PDF pipelines |
| 17 | Automation System | `flowchart TD` | Trigger → Conditions → Actions |
| 18 | Automation System | `classDiagram` | Automation domain model |
| 19 | Server Functions | `sequenceDiagram` | Client → Worker → Supabase |
| 20 | Webhooks | `flowchart LR` | Notification pipeline |

**Total: 20 Mermaid diagrams across 15 articles**

```
docs/architecture.md          → content moves to src/content/docs/
docs/domain-model.md          → content moves to src/content/docs/
docs/deployment.md            → content moves to src/content/docs/
docs/design-system.md         → content moves to src/content/docs/
docs/BACKUP.md                → archive or incorporate
docs/barcode-inventory.md     → archive or incorporate
docs/database-reset.md        → archive or incorporate
docs/lighthouse-budgets.md    → archive or incorporate
docs/mobile-audit.md          → archive or incorporate
docs/deployment/              → archive or incorporate
docs/superpowers/             → archive (specs kept for reference)
```
