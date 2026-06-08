-- Migration: Granular role-based permissions system
-- Table: role_permissions maps roles to named permissions
-- Admins always have all permissions (enforced in application layer)

CREATE TABLE public.role_permissions (
  role        text NOT NULL CHECK (role IN ('admin', 'tech', 'viewer')),
  permission  text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (role, permission)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone can read permissions (needed for auth profile loading)
CREATE POLICY "Anyone can read role_permissions"
  ON public.role_permissions
  FOR SELECT
  USING (true);

-- Only admins can modify permissions (via server functions)
CREATE POLICY "Admins can insert role_permissions"
  ON public.role_permissions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete role_permissions"
  ON public.role_permissions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── Seed default permissions ──

-- Tech: operational permissions (no admin-only actions)
INSERT INTO public.role_permissions (role, permission) VALUES
  ('tech', 'can_view_costs'),
  ('tech', 'can_manage_costs'),
  ('tech', 'can_archive_tickets'),
  ('tech', 'can_export_data'),
  ('tech', 'can_manage_bundles'),
  ('tech', 'can_manage_checklist_templates'),
  ('tech', 'can_delete_devices')
ON CONFLICT (role, permission) DO NOTHING;

-- Viewer: read-only permissions (view costs, export data)
INSERT INTO public.role_permissions (role, permission) VALUES
  ('viewer', 'can_view_costs'),
  ('viewer', 'can_export_data')
ON CONFLICT (role, permission) DO NOTHING;

-- Note: admin is NOT seeded here — admins always get all permissions
-- by application-level bypass (see get-my-auth-profile.ts)

-- ── Atomic replace function for safe permission updates ──

CREATE OR REPLACE FUNCTION public.replace_role_permissions(
  _role text,
  _permissions text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Delete existing permissions for the role
  DELETE FROM public.role_permissions WHERE role = _role;

  -- Insert new permissions (skip if empty array)
  IF array_length(_permissions, 1) > 0 THEN
    INSERT INTO public.role_permissions (role, permission)
    SELECT _role, unnest(_permissions);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_role_permissions(text, text[]) FROM public, anon;
