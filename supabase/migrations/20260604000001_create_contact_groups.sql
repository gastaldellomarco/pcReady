-- Create contact_groups table for per-client contact grouping
CREATE TABLE IF NOT EXISTS public.contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, name)
);

ALTER TABLE public.contact_groups ENABLE ROW LEVEL SECURITY;

-- Attach FK from client_contacts.group_id to contact_groups (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_contacts_group_id_fkey'
      AND conrelid = 'public.client_contacts'::regclass
  ) THEN
    ALTER TABLE public.client_contacts
      ADD CONSTRAINT client_contacts_group_id_fkey
        FOREIGN KEY (group_id) REFERENCES public.contact_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Column & table documentation
COMMENT ON COLUMN public.client_contacts.group_id IS 'Gruppo di contatti a cui appartiene il referente (one-to-many, per-cliente)';
COMMENT ON TABLE public.contact_groups IS 'Gruppi di contatti per cliente, usati per organizzazione e azioni bulk';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS contact_groups_updated ON public.contact_groups;
CREATE TRIGGER contact_groups_updated BEFORE UPDATE ON public.contact_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: all authenticated users can read groups
DROP POLICY IF EXISTS "All authed read contact_groups" ON public.contact_groups;
CREATE POLICY "All authed read contact_groups" ON public.contact_groups
  FOR SELECT TO authenticated USING (true);

-- RLS: tech/admin can insert/update/delete groups
DROP POLICY IF EXISTS "Tech/admin manage contact_groups" ON public.contact_groups;
CREATE POLICY "Tech/admin manage contact_groups" ON public.contact_groups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
