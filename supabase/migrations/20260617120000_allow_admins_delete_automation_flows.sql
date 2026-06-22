-- Migration: expand automation_flows DELETE RLS to match UI gate
-- Created: 2026-06-17
--
-- Why:
-- The original "Delete own" policy in
-- 20260504170000_add_rls_policies_automation_flows.sql restricted deletes
-- to `created_by = auth.uid()`. The two default seed automations (and any
-- flow created by a different admin/tech) carry a foreign `created_by`,
-- so a legitimate admin who had the "Elimina" button enabled by the
-- application layer (hasPermission("can_manage_automations")) hit an
-- RLS denial: PostgREST returned 0 affected rows, the mutation threw, and
-- the UI toasted a generic "Errore eliminazione".
--
-- This migration drops the narrow policy and replaces it with one that
-- (a) keeps "you can always delete your own row" and
-- (b) lets you delete any flow if your role resolves to the
--     `can_manage_automations` permission — either because your role is
--     'admin' (admin always gets every permission app-side per
--     20260607130000_role_permissions.sql) or because your role is
--     explicitly mapped to `can_manage_automations` in role_permissions.
-- (b) mirrors the hasPermission("can_manage_automations") check on the
-- client, so the UI button and the RLS gate cannot drift apart.
--
-- Safe re-runs: every statement is idempotent (DROP ... IF EXISTS).

BEGIN;

-- 1) Drop the original owner-only DELETE policy
DROP POLICY IF EXISTS "Delete own" ON public.automation_flows;

-- 2) Recreate it broadened: own row OR has the can_manage_automations permission
CREATE POLICY "Delete own or automation manager" ON public.automation_flows
  FOR DELETE
  TO authenticated
  USING (
    -- a) Always allowed to delete your own row
    created_by = auth.uid()
    OR
    -- b) Admin role OR a role explicitly granted can_manage_automations
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND (
          ur.role = 'admin'
          OR EXISTS (
            SELECT 1
            FROM public.role_permissions rp
            -- rp.role is `text` (see 20260607130000_role_permissions.sql), ur.role
            -- is the `public.app_role` enum. Postgres has no implicit text = enum
            -- operator, hence the explicit `::public.app_role` cast.
            WHERE rp.role::public.app_role = ur.role
              AND rp.permission = 'can_manage_automations'
          )
        )
    )
  );

COMMIT;

-- NOTES:
-- 1) service_role bypasses RLS, so server-side cron / Edge Functions using
--    the service key continue to work unchanged.
-- 2) The matching UPDATE policy ("Update own") retains its original semantics
--    on purpose — this migration is deliberately scoped to the DELETE bug
--    reported by the user. If we later want automation managers to also edit
--    any automation_flow, a separate migration should mirror this pattern
--    there.
-- 3) The RLS USING expression intentionally checks role_permissions (in
--    addition to the admin short-circuit) so that if `can_manage_automations`
--    is ever granted to a non-admin role, RLS stays in lock-step with the
--    UI's hasPermission() check without needing a follow-up migration.
