-- Create audit_presets table for saved filter views
CREATE TABLE audit_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow each user to have unique preset names
CREATE UNIQUE INDEX idx_audit_presets_user_name ON audit_presets(user_id, name);

ALTER TABLE audit_presets ENABLE ROW LEVEL SECURITY;

-- Users can manage only their own presets
CREATE POLICY "Users can view their own presets"
  ON audit_presets
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own presets"
  ON audit_presets
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own presets"
  ON audit_presets
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own presets"
  ON audit_presets
  FOR DELETE
  USING (user_id = auth.uid());
