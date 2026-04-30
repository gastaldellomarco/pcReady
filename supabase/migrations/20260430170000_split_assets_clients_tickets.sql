CREATE TYPE public.device_status AS ENUM ('available', 'assigned', 'maintenance', 'retired');

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  vat_number TEXT,
  address TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, first_name, last_name, email)
);

CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  serial TEXT,
  model TEXT NOT NULL,
  os TEXT,
  assigned_to TEXT,
  status public.device_status NOT NULL DEFAULT 'available',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX devices_serial_unique_idx
  ON public.devices (lower(serial))
  WHERE serial IS NOT NULL AND btrim(serial) <> '';

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER clients_updated BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER client_contacts_updated BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER devices_updated BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "All authed read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tech/admin insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
CREATE POLICY "Tech/admin update clients" ON public.clients FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
CREATE POLICY "Admin delete clients" ON public.clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "All authed read contacts" ON public.client_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tech/admin insert contacts" ON public.client_contacts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
CREATE POLICY "Tech/admin update contacts" ON public.client_contacts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
CREATE POLICY "Admin delete contacts" ON public.client_contacts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "All authed read devices" ON public.devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Tech/admin insert devices" ON public.devices FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
CREATE POLICY "Tech/admin update devices" ON public.devices FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'));
CREATE POLICY "Admin delete devices" ON public.devices FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requester_contact_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL;

INSERT INTO public.clients (name)
SELECT DISTINCT btrim(client)
FROM public.tickets
WHERE client IS NOT NULL AND btrim(client) <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.devices (client_id, serial, model, os, assigned_to, status, notes, created_by, created_at, updated_at)
SELECT DISTINCT ON (COALESCE(NULLIF(btrim(t.serial), ''), t.id::text))
  c.id,
  NULLIF(btrim(t.serial), ''),
  t.model,
  t.os,
  t.end_user,
  CASE WHEN t.status = 'ready' THEN 'available'::public.device_status ELSE 'maintenance'::public.device_status END,
  t.notes,
  t.created_by,
  t.created_at,
  t.updated_at
FROM public.tickets t
JOIN public.clients c ON c.name = btrim(t.client)
WHERE t.model IS NOT NULL AND btrim(t.model) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.client_contacts (client_id, first_name, role)
SELECT DISTINCT c.id, btrim(t.requester), 'Richiedente'
FROM public.tickets t
JOIN public.clients c ON c.name = btrim(t.client)
WHERE t.requester IS NOT NULL AND btrim(t.requester) <> ''
ON CONFLICT DO NOTHING;

UPDATE public.tickets t
SET client_id = c.id
FROM public.clients c
WHERE t.client_id IS NULL AND c.name = btrim(t.client);

UPDATE public.tickets t
SET device_id = d.id
FROM public.devices d
WHERE t.device_id IS NULL
  AND d.client_id = t.client_id
  AND (
    (t.serial IS NOT NULL AND btrim(t.serial) <> '' AND lower(d.serial) = lower(btrim(t.serial)))
    OR (t.serial IS NULL AND d.model = t.model)
  );

UPDATE public.tickets t
SET requester_contact_id = cc.id
FROM public.client_contacts cc
WHERE t.requester_contact_id IS NULL
  AND cc.client_id = t.client_id
  AND cc.first_name = btrim(t.requester);
