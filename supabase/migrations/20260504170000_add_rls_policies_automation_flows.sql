-- Migration: add RLS policies for automation_flows
-- Created: 2026-05-04

BEGIN;

-- Ensure RLS is enabled
ALTER TABLE automation_flows ENABLE ROW LEVEL SECURITY;

-- Allow anyone to SELECT (adjust if you want to restrict reads)
CREATE POLICY "Allow select" ON automation_flows
  FOR SELECT USING (true);

-- Allow insert when the new row's created_by matches the current user
CREATE POLICY "Insert own" ON automation_flows
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Allow updates only by the owner; ensure updated_by is set to the current user
CREATE POLICY "Update own" ON automation_flows
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (updated_by = auth.uid());

-- Allow delete only by the owner
CREATE POLICY "Delete own" ON automation_flows
  FOR DELETE USING (created_by = auth.uid());

COMMIT;

-- NOTES:
-- 1) The service_role bypasses RLS; server-side jobs using the service key can still operate.
-- 2) If you need admin roles, add additional policies that permit admin users (e.g. check a role table or a claim).
