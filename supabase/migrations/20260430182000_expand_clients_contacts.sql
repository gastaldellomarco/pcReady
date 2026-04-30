ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_code TEXT;

UPDATE public.clients
SET company_name = name
WHERE company_name IS NULL OR btrim(company_name) = '';

ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE public.client_contacts
SET
  full_name = btrim(concat_ws(' ', first_name, last_name)),
  job_title = COALESCE(job_title, role)
WHERE full_name IS NULL OR btrim(full_name) = '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_company_name_unique_idx
  ON public.clients (lower(company_name))
  WHERE company_name IS NOT NULL AND btrim(company_name) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS client_contacts_one_primary_idx
  ON public.client_contacts (client_id)
  WHERE is_primary;
