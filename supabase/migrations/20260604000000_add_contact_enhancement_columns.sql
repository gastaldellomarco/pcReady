-- Add contact enhancement columns: merge tracking, starred, private notes, availability, group FK
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS private_note TEXT,
  ADD COLUMN IF NOT EXISTS availability_status TEXT
    CHECK (availability_status IS NULL OR availability_status IN ('available', 'vacation', 'sick_leave', 'unavailable')),
  ADD COLUMN IF NOT EXISTS return_date DATE,
  ADD COLUMN IF NOT EXISTS group_id UUID; -- FK to contact_groups added in next migration

-- Performance indexes for new filterable columns
CREATE INDEX IF NOT EXISTS idx_client_contacts_is_starred ON public.client_contacts(is_starred) WHERE is_starred;
CREATE INDEX IF NOT EXISTS idx_client_contacts_group_id ON public.client_contacts(group_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_availability ON public.client_contacts(availability_status);
CREATE INDEX IF NOT EXISTS idx_client_contacts_merged_into ON public.client_contacts(merged_into_id);

-- Column documentation
COMMENT ON COLUMN public.client_contacts.merged_into_id IS 'ID del contatto in cui questo è stato unito (merge); NULL se non merged';
COMMENT ON COLUMN public.client_contacts.merged_at IS 'Timestamp del merge, se il contatto è stato assorbito in un altro';
COMMENT ON COLUMN public.client_contacts.is_starred IS 'Flag preferiti per evidenziare i referenti principali';
COMMENT ON COLUMN public.client_contacts.private_note IS 'Note interne visibili solo a tech e admin, non accessibili dal portale';
COMMENT ON COLUMN public.client_contacts.availability_status IS 'Stato disponibilità: available, vacation, sick_leave, unavailable. NULL = disponibile';
COMMENT ON COLUMN public.client_contacts.return_date IS 'Data di rientro prevista quando il contatto non è disponibile';
