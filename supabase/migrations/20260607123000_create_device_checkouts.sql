-- Migration: Create device_checkouts table and extend document_signatures for check-in/check-out flow
-- Supports: check-in / check-out device with digital signature

CREATE TABLE IF NOT EXISTS public.device_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  technician_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkout_at timestamptz NOT NULL DEFAULT now(),
  checkin_at timestamptz,
  checkout_signature_id uuid,
  checkin_signature_id uuid,
  condition_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_checkouts ENABLE ROW LEVEL SECURITY;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS device_checkouts_device_idx
  ON public.device_checkouts (device_id, checkout_at DESC);

CREATE INDEX IF NOT EXISTS device_checkouts_ticket_idx
  ON public.device_checkouts (ticket_id);

CREATE INDEX IF NOT EXISTS device_checkouts_technician_idx
  ON public.device_checkouts (technician_id, checkout_at DESC);

-- Partial unique index: only one active checkout per device at a time
CREATE UNIQUE INDEX IF NOT EXISTS device_checkouts_active_device_uq
  ON public.device_checkouts (device_id)
  WHERE checkin_at IS NULL;

-- RLS: all authenticated users can read checkouts
DROP POLICY IF EXISTS "All authed read device checkouts" ON public.device_checkouts;
CREATE POLICY "All authed read device checkouts"
  ON public.device_checkouts
  FOR SELECT TO authenticated
  USING (true);

-- RLS: tech/admin can insert checkouts
DROP POLICY IF EXISTS "Tech admin insert device checkouts" ON public.device_checkouts;
CREATE POLICY "Tech admin insert device checkouts"
  ON public.device_checkouts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = technician_id
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  );

-- RLS: technician or admin can update their own checkouts (for check-in)
DROP POLICY IF EXISTS "Technician or admin update device checkouts" ON public.device_checkouts;
CREATE POLICY "Technician or admin update device checkouts"
  ON public.device_checkouts
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = technician_id
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = technician_id
    OR public.has_role(auth.uid(), 'admin')
  );

-- RLS: admin can delete checkouts
DROP POLICY IF EXISTS "Admin delete device checkouts" ON public.device_checkouts;
CREATE POLICY "Admin delete device checkouts"
  ON public.device_checkouts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.device_checkouts IS 'Registro check-in / check-out dispositivi da parte dei tecnici';
COMMENT ON COLUMN public.device_checkouts.checkout_at IS 'Timestamp di presa in carico del dispositivo';
COMMENT ON COLUMN public.device_checkouts.checkin_at IS 'Timestamp di restituzione del dispositivo (null = ancora in carico)';
COMMENT ON COLUMN public.device_checkouts.condition_notes IS 'Note sulle condizioni del dispositivo al check-in/check-out';

-- Extend document_signatures table with new columns for generic document support
ALTER TABLE public.document_signatures
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'portal_document',
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL;

-- Drop existing unique constraint to allow multiple signatures per document_id across types
ALTER TABLE public.document_signatures
  DROP CONSTRAINT IF EXISTS document_signatures_document_id_contact_id_key;

ALTER TABLE public.document_signatures
  ADD CONSTRAINT document_signatures_document_id_contact_id_type_key
  UNIQUE (document_id, contact_id, document_type);

-- Update RLS policies for document_signatures to reflect extended schema
DROP POLICY IF EXISTS "All authed read document signatures" ON public.document_signatures;
CREATE POLICY "All authed read document signatures"
  ON public.document_signatures
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Tech admin insert document signatures" ON public.document_signatures;
CREATE POLICY "Tech admin insert document signatures"
  ON public.document_signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'tech')
  );

COMMENT ON COLUMN public.document_signatures.document_type IS 'Tipo documento: portal_document, device_checkout, device_checkin';
COMMENT ON COLUMN public.document_signatures.ticket_id IS 'Riferimento opzionale al ticket collegato';
COMMENT ON COLUMN public.document_signatures.device_id IS 'Riferimento opzionale al dispositivo collegato';

-- Add FK references from device_checkouts to document_signatures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'device_checkouts_checkout_signature_id_fkey'
      AND conrelid = 'public.device_checkouts'::regclass
  ) THEN
    ALTER TABLE public.device_checkouts
      ADD CONSTRAINT device_checkouts_checkout_signature_id_fkey
        FOREIGN KEY (checkout_signature_id) REFERENCES public.document_signatures(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'device_checkouts_checkin_signature_id_fkey'
      AND conrelid = 'public.device_checkouts'::regclass
  ) THEN
    ALTER TABLE public.device_checkouts
      ADD CONSTRAINT device_checkouts_checkin_signature_id_fkey
        FOREIGN KEY (checkin_signature_id) REFERENCES public.document_signatures(id) ON DELETE SET NULL;
  END IF;
END $$;
