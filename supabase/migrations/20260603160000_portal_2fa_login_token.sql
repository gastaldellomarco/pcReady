-- Add pending login token column for 2FA enforcement during portal login
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS portal_2fa_pending_login_token TEXT;
