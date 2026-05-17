# pcReady design system v2

## Colori

I token ufficiali sono definiti in `src/styles.css`, esposti a Tailwind tramite `@theme` e replicati in `src/lib/design-system.ts` per componenti TypeScript, SVG, Recharts e PDF.

| Token | Light | Dark | Uso |
| --- | --- | --- | --- |
| `--color-primary` | `#2563EB` | `#2563EB` | bottoni primari, link, highlight |
| `--color-primary-hover` | `#1D4ED8` | `#1D4ED8` | hover primario |
| `--color-primary-light` | `#DBEAFE` | `#1E3A5F` | badge e selezioni |
| `--color-success` | `#16A34A` | `#4ADE80` | completato, SLA OK, stato attivo |
| `--color-warning` | `#D97706` | `#FBBF24` | scadenze e attenzione |
| `--color-danger` | `#DC2626` | `#F87171` | errori, SLA violato, eliminazione |
| `--color-info` | `#0D9488` | `#2DD4BF` | informazioni e automazioni |
| `--color-text-primary` | `#0F172A` | `#F1F5F9` | testo principale |
| `--color-text-secondary` | `#64748B` | `#94A3B8` | testo secondario |
| `--color-text-muted` | `#94A3B8` | `#64748B` | hint e disabilitati |
| `--color-border` | `#E2E8F0` | `#1E293B` | bordi e separatori |
| `--color-surface` | `#F8FAFC` | `#0F172A` | background pagina |
| `--color-card` | `#FFFFFF` | `#1E293B` | card, modal, dropdown |

## Tipografia

- UI: `Geist`, fallback `Inter`, `system-ui`, `sans-serif`.
- Monospace: `Geist Mono`, fallback `JetBrains Mono`, `ui-monospace`, `monospace`.
- Scala Tailwind custom: `text-xs` 11px, `text-sm` 13px, `text-base` 15px, `text-md` 17px, `text-lg` 20px, `text-xl` 24px, `text-2xl` 30px.

Usare `font-mono` per codici ticket, seriali dispositivi, ID tecnici e valori tabellari compatti.

## Mappature semantiche

- Ticket: `pending` warning, `in-progress` primary, `completed`/`ready` success, `archived` neutral.
- SLA: OK success, in scadenza warning, violato danger.
- Garanzie: valida success, scadenza/urgente warning, scaduta danger, N/D muted.
- Grafici: primary, success, info, warning, danger, purple.

## Branding

Gli asset SVG sono in `public/`:

- `favicon.svg`
- `app-icon.svg`
- `logo.svg` / `logo-horizontal.svg`
- `logo-vertical.svg`
- `logo-dark.svg`
- `logo-mono.svg`

Il componente React riutilizzabile è `src/components/brand/AppLogo.tsx`.
