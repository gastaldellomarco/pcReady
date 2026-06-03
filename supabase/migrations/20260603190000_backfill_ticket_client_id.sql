-- Backfill client_id on tickets that have a NULL client_id.
-- The original backfill (20260430170000) only matched against clients.name,
-- but many tickets store the company_name in the text `client` field.
-- This migration matches against both name AND company_name, with
-- case-insensitive, whitespace-trimmed comparison.

-- Step 1: Match by company_name (case-insensitive, trimmed)
UPDATE public.tickets t
SET client_id = c.id
FROM public.clients c
WHERE t.client_id IS NULL
  AND btrim(t.client) <> ''
  AND lower(btrim(t.client)) = lower(btrim(c.company_name));

-- Step 2: Match by name (case-insensitive, trimmed) — catches remaining tickets
UPDATE public.tickets t
SET client_id = c.id
FROM public.clients c
WHERE t.client_id IS NULL
  AND btrim(t.client) <> ''
  AND lower(btrim(t.client)) = lower(btrim(c.name));

-- Step 3: Verify — log count of tickets still without client_id for diagnostics
DO $$
DECLARE
  total_tickets int;
  linked_tickets int;
  unlinked_tickets int;
BEGIN
  SELECT count(*) INTO total_tickets FROM public.tickets;
  SELECT count(*) INTO linked_tickets FROM public.tickets WHERE client_id IS NOT NULL;
  unlinked_tickets := total_tickets - linked_tickets;
  RAISE NOTICE 'Backfill complete: % total, % linked, % unlinked',
    total_tickets, linked_tickets, unlinked_tickets;
END $$;
