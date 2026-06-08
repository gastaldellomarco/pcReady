-- Script enhancements: parameters, tags, favorites, share links
BEGIN;

-- 1. Parameters column (JSONB array of parameter definitions)
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN scripts.parameters IS
'Array of parameter definitions: [{name, label, type, required}]';

-- 2. Tags column (free text array)
ALTER TABLE scripts
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::text[];

COMMENT ON COLUMN scripts.tags IS
'Free-form tags for granular search and filtering';

-- 3. Script favorites (per-user pinning)
CREATE TABLE IF NOT EXISTS script_favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, script_id)
);

COMMENT ON TABLE script_favorites IS
'Per-user favorite/pinned scripts';

-- Enable RLS on favorites
ALTER TABLE script_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "script_favorites_own" ON script_favorites;
CREATE POLICY "script_favorites_own"
  ON script_favorites
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Script share links (password-protected public sharing)
CREATE TABLE IF NOT EXISTS script_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL,
  is_revoked BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE script_share_links IS
'Password-protected share links for scripts';

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_script_share_links_token
  ON script_share_links(token);

-- Index for listing links per script
CREATE INDEX IF NOT EXISTS idx_script_share_links_script
  ON script_share_links(script_id);

COMMIT;
