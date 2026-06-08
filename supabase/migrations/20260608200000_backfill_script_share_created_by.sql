-- Backfill script_share_links.created_by
-- Ensures the column exists and marks existing null records.
-- The server function createScriptShareLink now sets created_by
-- for all new links; existing null records remain null since there
-- is no reliable audit trail to determine the creator retroactively.
BEGIN;

-- Ensure the column exists (idempotent)
ALTER TABLE script_share_links
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

COMMIT;
