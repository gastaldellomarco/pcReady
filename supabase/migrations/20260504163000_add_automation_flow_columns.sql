-- Migration: add structured columns to automation_flows and populate from flow_definition.meta
-- Created: 2026-05-04

BEGIN;

ALTER TABLE automation_flows
  ADD COLUMN IF NOT EXISTS trigger_definition jsonb,
  ADD COLUMN IF NOT EXISTS conditions_definition jsonb,
  ADD COLUMN IF NOT EXISTS actions_definition jsonb,
  ADD COLUMN IF NOT EXISTS schedule_definition jsonb,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz;

-- Populate new columns from flow_definition.meta.wizard when present
UPDATE automation_flows
SET
  trigger_definition = CASE WHEN flow_definition ? 'meta' AND (flow_definition -> 'meta') ? 'wizard'
    THEN (flow_definition -> 'meta' -> 'wizard' -> 'trigger_definition')
    ELSE NULL END,
  actions_definition = CASE WHEN flow_definition ? 'meta' AND (flow_definition -> 'meta') ? 'wizard'
    THEN (flow_definition -> 'meta' -> 'wizard' -> 'actions_definition')
    ELSE NULL END,
  conditions_definition = CASE WHEN flow_definition ? 'meta' AND (flow_definition -> 'meta') ? 'wizard'
    THEN (flow_definition -> 'meta' -> 'wizard' -> 'conditions_definition')
    ELSE NULL END,
  schedule_definition = CASE WHEN flow_definition ? 'meta' AND (flow_definition -> 'meta') ? 'wizard'
    THEN (flow_definition -> 'meta' -> 'wizard' -> 'schedule_definition')
    ELSE NULL END,
  summary = COALESCE(
    (flow_definition -> 'meta' ->> 'summary'),
    (flow_definition -> 'meta' -> 'wizard' ->> 'summary')
  ),
  last_run_at = CASE
    WHEN (flow_definition -> 'meta' ->> 'last_run_at') IS NOT NULL THEN (flow_definition -> 'meta' ->> 'last_run_at')::timestamptz
    ELSE NULL
  END
WHERE (flow_definition ? 'meta');

-- Add index for last_run_at for faster queries
CREATE INDEX IF NOT EXISTS idx_automation_flows_last_run_at ON automation_flows (last_run_at);

COMMIT;

-- NOTES:
-- 1) This migration keeps metadata in JSONB and also creates dedicated columns for easier querying.
-- 2) The migration only copies values when present under flow_definition.meta.wizard or meta.
-- 3) Review and add triggers if you want to keep columns in sync when flow_definition changes.
