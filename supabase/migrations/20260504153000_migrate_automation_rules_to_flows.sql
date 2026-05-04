-- Migration: migrate legacy automation_rules into automation_flows
-- Created: 2026-05-04
-- IMPORTANT: Run a DB backup before applying this migration.

BEGIN;

-- Insert legacy rules into automation_flows preserving legacy metadata.
WITH to_migrate AS (
  SELECT ar.*
  FROM automation_rules ar
  WHERE NOT EXISTS (
    SELECT 1 FROM automation_flows af
    WHERE (af.flow_definition -> 'meta' ->> 'legacy_id') = ar.id::text
  )
)
INSERT INTO automation_flows (
  id, name, description, category, active, version, flow_definition, created_at, updated_at, created_by, updated_by
)
SELECT
  gen_random_uuid() AS id,
  COALESCE(NULLIF(split_part(coalesce(trigger_text, ''), E'\n', 1), ''), 'Legacy automation ' || id::text) AS name,
  COALESCE(description, action_text, trigger_text) AS description,
  COALESCE(category, 'Generale') AS category,
  active,
  1 AS version,
  jsonb_build_object(
    'nodes', jsonb_build_array(
      jsonb_build_object(
        'id', 'trigger-'||id::text,
        'type', 'trigger',
        'data', jsonb_build_object('label', trigger_text, 'legacy', true)
      ),
      jsonb_build_object(
        'id', 'action-'||id::text,
        'type', 'action',
        'data', jsonb_build_object('label', action_text, 'legacy', true)
      )
    ),
    'edges', jsonb_build_array(
      jsonb_build_object('id','e-'||id::text, 'source','trigger-'||id::text, 'target','action-'||id::text)
    ),
    'meta', jsonb_build_object(
      'legacy_id', id::text,
      'legacy_count', coalesce(count,0),
      'legacy_trigger_text', trigger_text,
      'legacy_action_text', action_text,
      'migrated_at', now()
    )
  )::jsonb AS flow_definition,
  now() AS created_at,
  now() AS updated_at,
  NULL AS created_by,
  NULL AS updated_by
FROM to_migrate;

-- Return a quick report for manual inspection
SELECT count(*) AS migrated_rows FROM automation_flows af WHERE af.flow_definition -> 'meta' ->> 'migrated_at' IS NOT NULL;

COMMIT;

-- NOTES:
-- 1) This migration preserves legacy metadata in flow_definition.meta. Review and adapt if
--    you prefer separate columns for count/last_run_at.
-- 2) Ensure RLS/policies on automation_flows are configured appropriately after migration.
-- 3) Do NOT DROP automation_rules immediately; keep it as archive until verification.
