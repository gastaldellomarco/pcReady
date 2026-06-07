-- Migration: Create device_software and software_catalog tables for software inventory tracking
-- Supports: software inventory with version tracking and obsolescence alerts

CREATE TABLE IF NOT EXISTS public.software_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  latest_version text NOT NULL,
  publisher text,
  category text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.device_software (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  software_name text NOT NULL,
  version text NOT NULL,
  publisher text,
  install_date date,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, software_name)
);

ALTER TABLE public.software_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_software ENABLE ROW LEVEL SECURITY;

-- Realtime support for agent-based software sync
ALTER TABLE public.device_software REPLICA IDENTITY FULL;

-- Trigger for updated_at on software_catalog
DROP TRIGGER IF EXISTS software_catalog_updated ON public.software_catalog;
CREATE TRIGGER software_catalog_updated BEFORE UPDATE ON public.software_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes for software catalog
CREATE INDEX IF NOT EXISTS software_catalog_name_idx
  ON public.software_catalog (name);

CREATE INDEX IF NOT EXISTS software_catalog_publisher_idx
  ON public.software_catalog (publisher)
  WHERE publisher IS NOT NULL;

-- Indexes for device software
CREATE INDEX IF NOT EXISTS device_software_device_idx
  ON public.device_software (device_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS device_software_name_idx
  ON public.device_software (software_name);

-- RLS: software_catalog — all authenticated read, admins manage
DROP POLICY IF EXISTS "All authed read software catalog" ON public.software_catalog;
CREATE POLICY "All authed read software catalog"
  ON public.software_catalog
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin manage software catalog" ON public.software_catalog;
CREATE POLICY "Admin manage software catalog"
  ON public.software_catalog
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS: device_software — all authenticated read, tech/admin manage
DROP POLICY IF EXISTS "All authed read device software" ON public.device_software;
CREATE POLICY "All authed read device software"
  ON public.device_software
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Tech admin insert device software" ON public.device_software;
CREATE POLICY "Tech admin insert device software"
  ON public.device_software
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'tech')
  );

DROP POLICY IF EXISTS "Tech admin update device software" ON public.device_software;
CREATE POLICY "Tech admin update device software"
  ON public.device_software
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'tech')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'tech')
  );

DROP POLICY IF EXISTS "Admin delete device software" ON public.device_software;
CREATE POLICY "Admin delete device software"
  ON public.device_software
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.software_catalog IS 'Catalogo centralizzato delle ultime versioni note dei software, per confronto obsolescenza';
COMMENT ON TABLE public.device_software IS 'Elenco del software installato per ogni dispositivo, sincronizzato via agent';
COMMENT ON COLUMN public.device_software.last_seen_at IS 'Ultima volta che il software è stato rilevato dall''agent (non aggiornato per >30gg = non più rilevato)';
