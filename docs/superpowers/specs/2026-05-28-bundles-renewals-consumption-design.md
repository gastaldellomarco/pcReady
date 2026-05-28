# Bundles Renewals And Consumption Design

Date: 2026-05-28

## Context

The `/bundles` page already manages assistance package catalog, client assignments, usage summaries, payments, and billing tabs. The database already includes the core tables `assistance_bundles`, `client_bundle_assignments`, `bundle_usage_entries`, `bundle_fee_payments`, usage summary views, `auto_renew` fields, and notification types for bundle events.

The selected product direction is a bundle assignment console: the client assignment becomes the operational center for renewals, service breakdown, usage by ticket, alerts, payments, and monthly reporting.

## Goals

- Automatically renew eligible bundle assignments at expiry.
- Notify technicians and/or clients when usage reaches a configurable threshold.
- Support multi-service bundles such as remote hours, on-site hours, and visits.
- Show renewal history inside the assignment detail.
- Compare catalog bundles when choosing a package for a client.
- Show which tickets consumed bundle resources, split by service line.
- Create custom client-specific bundles that are not published in the catalog.
- Export a monthly PDF statement for transparent client reporting.

## Non-Goals

- No external payment processor integration.
- No automatic email delivery scheduler in the first implementation; PDF generation and in-app/email-ready data are in scope.
- No separate public pricing page.
- No changes to ticket lifecycle semantics beyond bundle usage attribution.

## UX Design

`/bundles` remains the single entry point, but the page shifts from four independent tabs to a console layout.

The main page keeps high-level actions and metrics. A left assignment list lets the user select a client bundle assignment. The right detail panel contains nested sections:

- Overview: client, bundle, status, dates, effective price, service allowances, usage progress, threshold state, next payment.
- Consumi per ticket: tickets linked to the assignment, grouped by ticket and split into remote hours, on-site hours, visits, extras, and amount.
- Rinnovi: renewal chain with previous assignments, renewal dates, generated assignments, and amounts.
- Pagamenti: payments and scheduled payments for the selected assignment.
- Report PDF: monthly period selector and export button for a client-facing statement.

The catalog stays available and gains a comparison view. Admins can select two to four bundles and compare price, billing type, service allowances, SLA, extra rate, priority, and auto-renew defaults. Custom client-specific bundles appear in assignment flows and client detail, but are hidden from the general catalog unless explicitly marked as published.

## Data Model

Add bundle service lines:

- `bundle_service_lines`
- `id`
- `bundle_id`
- `service_type`: `remote_hours`, `onsite_hours`, `onsite_visit`, `extra`
- `label`
- `included_quantity`
- `unit`: `hours`, `visits`, `items`
- `extra_rate`
- `sort_order`

Extend `assistance_bundles`:

- `published boolean not null default true`
- `client_id uuid null references clients(id)` for custom client-only bundles
- `is_custom boolean not null default false`

Extend `client_bundle_assignments`:

- `renewed_from_assignment_id uuid null references client_bundle_assignments(id)`
- `renewed_to_assignment_id uuid null references client_bundle_assignments(id)`
- `renewed_at timestamptz`
- `usage_alert_threshold_percent numeric(5,2) default 80`
- `notify_technician boolean default true`
- `notify_client boolean default false`
- `last_usage_alert_sent_at timestamptz`
- `last_usage_alert_percent numeric(5,2)`
- `assigned_technician_id uuid null references profiles(id)`

Extend `bundle_usage_entries`:

- `service_line_id uuid null references bundle_service_lines(id)`
- keep `usage_type` for backward compatibility and derive it from the service line when available.

Create views:

- `bundle_assignment_service_usage_summary`: service-line usage totals, remaining quantity, extras, and percent.
- `bundle_ticket_usage_summary`: one row per ticket and service line, including ticket code/title, used quantity, extra quantity, and extra amount.
- `bundle_renewal_history`: renewal chain rows with previous/current assignment IDs, dates, status, and payment amount.

## Business Logic

Auto-renewal runs as a database function callable from the app. The first implementation exposes it as a staff action from the assignment detail; a scheduled cron runner can call the same function in a later project without changing the data model.

`renew_bundle_assignment(assignment_id uuid, created_by uuid)`

The function validates that the assignment is active, has `auto_renew = true`, `renewal_mode = automatic`, and has an end date. It creates the next assignment using the same client, bundle, custom overrides, alert settings, and notes. The new period starts the day after the old `end_date`; its end date is computed from bundle billing type. It marks the old assignment as `renewed`, links old and new rows, and creates a pending `bundle_fee_payments` row for the new period.

Usage alerting is evaluated when bundle usage is synced from a ticket time entry and when usage summaries are refreshed from the UI. If usage crosses the configured threshold and the assignment has not already sent an alert for the same or higher percent band, the system creates:

- an internal notification for the assigned technician, or for admins/techs if no assignment technician exists;
- optionally a client-facing notification/email payload for the primary portal contact when `notify_client` is true.

Alert bands should avoid spam. The first implementation sends at most one alert per assignment per threshold crossing, unless the threshold is edited upward or the assignment renews.

## PDF Report

The monthly statement uses the existing PDF export pattern in the app. It includes:

- client and bundle assignment header;
- report month;
- included services and consumption totals;
- ticket-level usage table;
- extra hours/visits and extra amount;
- payments for the period;
- renewal status and next expiry date.

The export action lives in the selected assignment detail and can also be available from the monthly usage panel.

## Permissions And Security

- Admins manage catalog bundles, custom bundles, comparison, renewal execution, and payment records.
- Techs can manage assignments, view usage, export reports, and trigger renewal when they already have assignment permissions.
- Viewers can read catalog, assignments, usage, and reports.
- Custom client-specific bundles are readable by authenticated staff, but list queries must distinguish published catalog rows from client-specific rows.
- RLS remains enabled on all new tables in `public`.
- No authorization logic uses user-editable metadata.

## Implementation Plan Outline

1. Add migration for service lines, custom bundle flags, assignment renewal/alert fields, usage service-line relation, views, indexes, RLS, and renewal function.
2. Update generated database types and `src/lib/bundles.ts` selectors, types, queries, and mutations.
3. Extend bundle and assignment forms for service lines, custom/published state, alert threshold, notification recipients, and assigned technician.
4. Refactor `/bundles` into the assignment console layout while preserving existing catalog, usage, and billing behavior.
5. Add catalog comparison UI.
6. Add usage-by-ticket UI and monthly PDF report.
7. Seed demo data for multi-service lines, custom bundles, renewal history, scheduled payments, threshold scenarios, and ticket usage detail.
8. Add focused tests for renewal function behavior, bundle query helpers, and the main UI flows.

## Testing

- Migration smoke test on local Supabase reset.
- SQL tests or direct verification queries for `renew_bundle_assignment`.
- Unit tests for date period computation and usage threshold helper.
- React tests for catalog comparison, assignment detail rendering, and usage-by-ticket rows.
- PDF export test following the existing export test pattern.
- Manual browser verification of `/bundles` on desktop and mobile.

## Phase Decisions

- Client notifications create in-app notification records and email-ready payloads in phase 1. Automatic email delivery is delegated to the existing email event system in a later project.
- Renewal execution is staff-triggered in phase 1. Scheduled renewal is out of scope for this implementation, but it will reuse `renew_bundle_assignment`.
