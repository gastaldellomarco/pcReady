-- Fase 1 dettaglio ticket: allegati ticket/note e hardening note interne

ALTER TABLE public.ticket_notes
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  note_id uuid REFERENCES public.ticket_notes(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'ticket-documents',
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);

CREATE INDEX IF NOT EXISTS ticket_attachments_ticket_created_idx
  ON public.ticket_attachments(ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ticket_attachments_note_created_idx
  ON public.ticket_attachments(note_id, created_at DESC)
  WHERE note_id IS NOT NULL;

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team can read ticket attachments" ON public.ticket_attachments;
CREATE POLICY "team can read ticket attachments"
  ON public.ticket_attachments FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.profiles));

DROP POLICY IF EXISTS "team can insert ticket attachments" ON public.ticket_attachments;
CREATE POLICY "team can insert ticket attachments"
  ON public.ticket_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND auth.uid() IN (SELECT id FROM public.profiles)
  );

DROP POLICY IF EXISTS "uploader or admin can delete ticket attachments" ON public.ticket_attachments;
CREATE POLICY "uploader or admin can delete ticket attachments"
  ON public.ticket_attachments FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-documents',
  'ticket-documents',
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

DROP POLICY IF EXISTS "team can read ticket documents" ON storage.objects;
CREATE POLICY "team can read ticket documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ticket-documents'
    AND auth.uid() IN (SELECT id FROM public.profiles)
  );

DROP POLICY IF EXISTS "team can upload ticket documents" ON storage.objects;
CREATE POLICY "team can upload ticket documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-documents'
    AND auth.uid() IN (SELECT id FROM public.profiles)
  );

DROP POLICY IF EXISTS "uploader or admin can delete ticket documents" ON storage.objects;
CREATE POLICY "uploader or admin can delete ticket documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ticket-documents'
    AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );

COMMENT ON TABLE public.ticket_attachments IS 'File allegati a ticket o a una singola nota ticket, salvati in Supabase Storage.';
COMMENT ON COLUMN public.ticket_attachments.note_id IS 'Null per allegato generale del ticket; valorizzato per allegato di una specifica nota.';
