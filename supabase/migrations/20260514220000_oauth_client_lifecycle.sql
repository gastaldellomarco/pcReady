-- OAuth client lifecycle: status, last activity timestamp.

CREATE TYPE public.oauth_client_status AS ENUM ('active', 'disabled', 'revoked');

ALTER TABLE public.oauth_clients
  ADD COLUMN IF NOT EXISTS status public.oauth_client_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

COMMENT ON COLUMN public.oauth_clients.status IS 'active = consent/token flow allowed; disabled = admin pause; revoked = terminal, cannot re-enable.';
COMMENT ON COLUMN public.oauth_clients.last_used_at IS 'Last time the client participated in a successful OAuth server step (e.g. consent code issued).';

CREATE INDEX IF NOT EXISTS idx_oauth_clients_status ON public.oauth_clients (status);
