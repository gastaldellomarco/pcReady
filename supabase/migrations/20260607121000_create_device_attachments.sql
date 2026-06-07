-- Migration: Create device_attachments table for lifecycle document storage
-- Supports: asset lifecycle tracking document attachments (fattura, DDT, etc.)

CREATE TABLE IF NOT EXISTS public.device_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  lifecycle_phase text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'device-documents',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);

ALTER TABLE public.device_attachments ENABLE ROW LEVEL SECURITY;

-- Index for efficient device-scoped queries
CREATE INDEX IF NOT EXISTS device_attachments_device_phase_idx
  ON public.device_attachments (device_id, lifecycle_phase, created_at DESC);

CREATE INDEX IF NOT EXISTS device_attachments_device_created_idx
  ON public.device_attachments (device_id, created_at DESC);

-- RLS: all authenticated users can read device attachments
DROP POLICY IF EXISTS "All authed read device attachments" ON public.device_attachments;
CREATE POLICY "All authed read device attachments"
  ON public.device_attachments
  FOR SELECT TO authenticated
  USING (true);

-- RLS: tech/admin can insert device attachments
DROP POLICY IF EXISTS "Tech admin insert device attachments" ON public.device_attachments;
CREATE POLICY "Tech admin insert device attachments"
  ON public.device_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'tech'))
  );

-- RLS: uploader or admin can delete device attachments
DROP POLICY IF EXISTS "Uploader or admin delete device attachments" ON public.device_attachments;
CREATE POLICY "Uploader or admin delete device attachments"
  ON public.device_attachments
  FOR DELETE TO authenticated
  USING (
    auth.uid() = uploaded_by
    OR public.has_role(auth.uid(), 'admin')
  );

COMMENT ON TABLE public.device_attachments IS 'Documenti allegati alle fasi del ciclo di vita dei dispositivi (fatture, DDT, ecc.)';
COMMENT ON COLUMN public.device_attachments.lifecycle_phase IS 'Fase del ciclo di vita: warehouse, configuration, deployed, repair, decommissioned';

-- Create storage bucket for device documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'device-documents',
  'device-documents',
  false,
  52428800,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: team can read device documents
DROP POLICY IF EXISTS "team can read device documents" ON storage.objects;
CREATE POLICY "team can read device documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'device-documents'
    AND auth.uid() IN (SELECT id FROM public.profiles)
  );

-- Storage RLS: team can upload device documents
DROP POLICY IF EXISTS "team can upload device documents" ON storage.objects;
CREATE POLICY "team can upload device documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'device-documents'
    AND auth.uid() IN (SELECT id FROM public.profiles)
  );

-- Storage RLS: owner or admin can delete device documents
DROP POLICY IF EXISTS "owner or admin can delete device documents" ON storage.objects;
CREATE POLICY "owner or admin can delete device documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'device-documents'
    AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );
