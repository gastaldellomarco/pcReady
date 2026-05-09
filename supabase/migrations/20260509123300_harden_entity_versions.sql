ALTER TABLE entity_versions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'entity_versions_operation_check'
  ) THEN
    ALTER TABLE entity_versions
      ADD CONSTRAINT entity_versions_operation_check
      CHECK (operation IN ('create', 'update', 'restore', 'delete'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS entity_versions_unique_version
ON entity_versions (entity_type, entity_id, version_number);

CREATE INDEX IF NOT EXISTS entity_versions_entity_created_desc
ON entity_versions (entity_type, entity_id, created_at DESC);

DROP POLICY IF EXISTS "Users can view entity versions" ON entity_versions;
CREATE POLICY "Users can view entity versions" ON entity_versions
FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can create versions" ON entity_versions;
CREATE POLICY "Authenticated users can create versions" ON entity_versions
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = auth.uid()
  AND operation IN ('create', 'update', 'delete')
);

DROP POLICY IF EXISTS "Admins can restore entity versions" ON entity_versions;
CREATE POLICY "Admins can restore entity versions" ON entity_versions
FOR INSERT TO authenticated
WITH CHECK (
  operation = 'restore'
  AND created_by = auth.uid()
  AND public.get_user_role(auth.uid()) = 'admin'
);
