-- Migration: Add lifecycle tracking columns to devices table
-- Required for: AD/LDAP integration, warranty expiry alerts, asset lifecycle tracking

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS hostname text,
  ADD COLUMN IF NOT EXISTS azure_ad_device_id text,
  ADD COLUMN IF NOT EXISTS last_ad_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS warranty_expiry_notified_for date;

-- Index for AD sync matching by hostname
CREATE INDEX IF NOT EXISTS idx_devices_hostname
  ON public.devices (hostname)
  WHERE hostname IS NOT NULL;

-- Index for AD sync matching by azure_ad_device_id
CREATE INDEX IF NOT EXISTS idx_devices_azure_ad_device_id
  ON public.devices (azure_ad_device_id)
  WHERE azure_ad_device_id IS NOT NULL;

COMMENT ON COLUMN public.devices.hostname IS 'Hostname del computer (per integrazione AD / Azure AD)';
COMMENT ON COLUMN public.devices.azure_ad_device_id IS 'ID del dispositivo in Azure AD / Entra ID';
COMMENT ON COLUMN public.devices.last_ad_sync_at IS 'Timestamp ultima sincronizzazione con Active Directory';
COMMENT ON COLUMN public.devices.warranty_expiry_notified_for IS 'Data scadenza per cui è già stata inviata notifica (evita duplicati)';
