CREATE TABLE IF NOT EXISTS public.ticket_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL CHECK (length(trim(content)) > 0),
  is_internal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ticket_notes_author_id_profiles_fkey'
      AND conrelid = 'public.ticket_notes'::regclass
  ) THEN
    ALTER TABLE public.ticket_notes
      ADD CONSTRAINT ticket_notes_author_id_profiles_fkey
      FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ticket_notes_ticket_id_created_at_idx ON public.ticket_notes(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_notes_author_id_idx ON public.ticket_notes(author_id);

ALTER TABLE public.ticket_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team can read notes" ON public.ticket_notes;
CREATE POLICY "team can read notes"
  ON public.ticket_notes FOR SELECT
  USING (auth.uid() IN (SELECT id FROM public.profiles));

DROP POLICY IF EXISTS "author can insert" ON public.ticket_notes;
CREATE POLICY "author can insert"
  ON public.ticket_notes FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND auth.uid() IN (SELECT id FROM public.profiles)
  );

DROP POLICY IF EXISTS "author or admin can update notes" ON public.ticket_notes;
CREATE POLICY "author or admin can update notes"
  ON public.ticket_notes FOR UPDATE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "author or admin can delete notes" ON public.ticket_notes;
CREATE POLICY "author or admin can delete notes"
  ON public.ticket_notes FOR DELETE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.ticket_notes IS 'Structured notes and comments attached to tickets. Internal notes are visible only to team users; public notes can be surfaced to the customer portal.';
COMMENT ON COLUMN public.ticket_notes.is_internal IS 'true = team-only internal note, false = visible to customer portal contexts through server-side portal queries.';
