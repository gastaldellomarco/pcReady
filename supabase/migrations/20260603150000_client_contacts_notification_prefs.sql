-- Add notification_preferences JSON column to client_contacts for portal per-event notification config
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
    "ticket_updated": true,
    "ticket_closed": true,
    "document_available": true,
    "bundle_expiring": true
  }'::jsonb;
