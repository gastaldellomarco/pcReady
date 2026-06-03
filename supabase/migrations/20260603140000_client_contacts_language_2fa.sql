-- Add language preference and 2FA columns to client_contacts for portal
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'it',
  ADD COLUMN IF NOT EXISTS portal_2fa_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS portal_2fa_pending_code TEXT,
  ADD COLUMN IF NOT EXISTS portal_2fa_pending_expires TIMESTAMPTZ;
