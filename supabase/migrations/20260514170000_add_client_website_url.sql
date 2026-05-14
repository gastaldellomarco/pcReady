ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS website_url TEXT;
