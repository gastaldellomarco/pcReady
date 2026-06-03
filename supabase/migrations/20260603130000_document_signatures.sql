-- Document signatures table for portal client document signing
CREATE TABLE IF NOT EXISTS public.document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  signature_path TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id
  ON public.document_signatures(document_id);

CREATE INDEX IF NOT EXISTS idx_document_signatures_client_id
  ON public.document_signatures(client_id);

-- RLS: clients can see their own signatures via portal session
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;
