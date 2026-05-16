-- Fase 2 dettaglio ticket: ticket collegati e tempo lavorato

CREATE TABLE IF NOT EXISTS public.ticket_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  target_ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('blocked_by', 'duplicate_of', 'child_of')),
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_ticket_id <> target_ticket_id),
  UNIQUE (source_ticket_id, target_ticket_id, relation_type)
);

CREATE INDEX IF NOT EXISTS ticket_relations_source_idx
  ON public.ticket_relations(source_ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ticket_relations_target_idx
  ON public.ticket_relations(target_ticket_id, created_at DESC);

ALTER TABLE public.ticket_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team can read ticket relations" ON public.ticket_relations;
CREATE POLICY "team can read ticket relations"
  ON public.ticket_relations FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.profiles));

DROP POLICY IF EXISTS "team can insert ticket relations" ON public.ticket_relations;
CREATE POLICY "team can insert ticket relations"
  ON public.ticket_relations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND auth.uid() IN (SELECT id FROM public.profiles)
  );

DROP POLICY IF EXISTS "creator or admin can delete ticket relations" ON public.ticket_relations;
CREATE POLICY "creator or admin can delete ticket relations"
  ON public.ticket_relations FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.ticket_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_minutes integer,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at > started_at),
  CHECK (duration_minutes IS NULL OR duration_minutes > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS ticket_time_entries_one_active_per_user_idx
  ON public.ticket_time_entries(ticket_id, user_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS ticket_time_entries_ticket_started_idx
  ON public.ticket_time_entries(ticket_id, started_at DESC);

CREATE INDEX IF NOT EXISTS ticket_time_entries_user_started_idx
  ON public.ticket_time_entries(user_id, started_at DESC);

ALTER TABLE public.ticket_time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team can read ticket time entries" ON public.ticket_time_entries;
CREATE POLICY "team can read ticket time entries"
  ON public.ticket_time_entries FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.profiles));

DROP POLICY IF EXISTS "team can insert own ticket time entries" ON public.ticket_time_entries;
CREATE POLICY "team can insert own ticket time entries"
  ON public.ticket_time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() IN (SELECT id FROM public.profiles)
  );

DROP POLICY IF EXISTS "owner or admin can update ticket time entries" ON public.ticket_time_entries;
CREATE POLICY "owner or admin can update ticket time entries"
  ON public.ticket_time_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "owner or admin can delete ticket time entries" ON public.ticket_time_entries;
CREATE POLICY "owner or admin can delete ticket time entries"
  ON public.ticket_time_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.ticket_relations IS 'Relazioni tra ticket: dipendenze, duplicati e parent/child.';
COMMENT ON TABLE public.ticket_time_entries IS 'Intervalli di tempo lavorato su ticket, inclusi timer attivi e inserimenti manuali.';
COMMENT ON COLUMN public.ticket_time_entries.ended_at IS 'Null indica un timer attualmente attivo.';
