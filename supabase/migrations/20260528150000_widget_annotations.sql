-- Migration: Add widget_annotations table for personal widget notes
-- Feature: widget-annotations (2026-05-28)

CREATE TABLE public.widget_annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_id     TEXT NOT NULL,
  text          TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  note_date     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_widget_annotations_user ON widget_annotations(user_id);
CREATE INDEX idx_widget_annotations_widget ON widget_annotations(user_id, widget_id);
CREATE INDEX idx_widget_annotations_date  ON widget_annotations(user_id, note_date);

ALTER TABLE public.widget_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own annotations"
  ON public.widget_annotations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
