-- OAuth tables for consent flow
CREATE TYPE public.oauth_scope AS ENUM ('openid', 'profile', 'email', 'pcready:read', 'pcready:write', 'pcready:admin');

CREATE TABLE public.oauth_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE,
  client_secret TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  scopes_allowed oauth_scope[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.oauth_clients ENABLE ROW LEVEL SECURITY;

-- Authorization codes table for temporary storage
CREATE TABLE public.oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id TEXT REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE NOT NULL,
  scopes_granted oauth_scope[] NOT NULL,
  redirect_uri TEXT NOT NULL,
  state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
ALTER TABLE public.oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_oauth_authorization_codes_expires_at ON public.oauth_authorization_codes(expires_at);

CREATE TABLE public.oauth_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id TEXT REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE NOT NULL,
  scopes_granted oauth_scope[] NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE (user_id, client_id)
);
ALTER TABLE public.oauth_consents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for oauth_clients
CREATE POLICY "Authenticated users can read oauth_clients"
  ON public.oauth_clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage oauth_clients"
  ON public.oauth_clients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for oauth_authorization_codes (internal, no select policy needed)
CREATE POLICY "Admins can read authorization codes"
  ON public.oauth_authorization_codes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for oauth_consents
CREATE POLICY "Users can read own consents"
  ON public.oauth_consents FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all consents"
  ON public.oauth_consents FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert/update own consents"
  ON public.oauth_consents FOR ALL TO authenticated USING (auth.uid() = user_id);