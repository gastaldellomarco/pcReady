ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS portal_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS public_notes text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'internal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tickets_source_check'
      AND conrelid = 'public.tickets'::regclass
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_source_check CHECK (source IN ('internal', 'portal'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS portal_sessions_client_id_idx ON public.portal_sessions(client_id);
CREATE INDEX IF NOT EXISTS portal_sessions_contact_id_idx ON public.portal_sessions(contact_id);
CREATE INDEX IF NOT EXISTS portal_sessions_token_hash_idx ON public.portal_sessions(token_hash);
CREATE INDEX IF NOT EXISTS tickets_client_source_idx ON public.tickets(client_id, source);

ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage portal sessions" ON public.portal_sessions;
CREATE POLICY "Admin manage portal sessions" ON public.portal_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

COMMENT ON COLUMN public.clients.portal_enabled IS 'Controls whether this client can access the customer portal.';
COMMENT ON COLUMN public.tickets.public_notes IS 'Notes visible to the customer portal user.';
COMMENT ON COLUMN public.tickets.source IS 'internal = created by service desk, portal = created by customer portal.';
