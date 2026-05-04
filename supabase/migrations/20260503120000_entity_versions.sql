-- Create entity_versions table for versioning main app entities
-- Drop table if exists to allow re-running migration
DROP TABLE IF EXISTS entity_versions CASCADE;

CREATE TABLE entity_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  version_number integer NOT NULL,
  operation text NOT NULL CHECK (operation IN ('create', 'update', 'restore', 'delete')),
  snapshot jsonb NOT NULL,
  previous_snapshot jsonb,
  changed_fields jsonb,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  app_version text,
  request_id uuid
);

-- Unique constraint to prevent duplicate versions
CREATE UNIQUE INDEX IF NOT EXISTS entity_versions_unique_version
ON entity_versions (entity_type, entity_id, version_number);

-- Index for efficient querying of version history per entity
CREATE INDEX IF NOT EXISTS entity_versions_entity_created_desc
ON entity_versions (entity_type, entity_id, created_at DESC);

-- Enable RLS
ALTER TABLE entity_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view versions for entities they can access
-- (This will be refined based on entity-specific permissions)
DROP POLICY IF EXISTS "Users can view entity versions" ON entity_versions;
CREATE POLICY "Users can view entity versions" ON entity_versions
FOR SELECT USING (true);

-- Policy: Only authenticated users can create versions
DROP POLICY IF EXISTS "Authenticated users can create versions" ON entity_versions;
CREATE POLICY "Authenticated users can create versions" ON entity_versions
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);