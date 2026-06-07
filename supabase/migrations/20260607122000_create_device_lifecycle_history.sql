-- Migration: Create device_lifecycle_history table for tracking lifecycle phase transitions
-- Supports: asset lifecycle tracking — records every phase change with metadata

CREATE TABLE IF NOT EXISTS public.device_lifecycle_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  phase text NOT NULL,
  previous_phase text,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.device_lifecycle_history ENABLE ROW LEVEL SECURITY;

-- Index for efficient device-scoped timeline queries
CREATE INDEX IF NOT EXISTS device_lifecycle_history_device_idx
  ON public.device_lifecycle_history (device_id, changed_at DESC);

-- RLS: all authenticated users can read lifecycle history
DROP POLICY IF EXISTS "All authed read device lifecycle history" ON public.device_lifecycle_history;
CREATE POLICY "All authed read device lifecycle history"
  ON public.device_lifecycle_history
  FOR SELECT TO authenticated
  USING (true);

-- RLS: tech/admin can insert lifecycle history entries
DROP POLICY IF EXISTS "Tech admin insert device lifecycle history" ON public.device_lifecycle_history;
CREATE POLICY "Tech admin insert device lifecycle history"
  ON public.device_lifecycle_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'tech')
  );

-- RLS: admin can delete lifecycle history entries (for corrections)
DROP POLICY IF EXISTS "Admin delete device lifecycle history" ON public.device_lifecycle_history;
CREATE POLICY "Admin delete device lifecycle history"
  ON public.device_lifecycle_history
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Constraint: phase values must be valid lifecycle phases
ALTER TABLE public.device_lifecycle_history
  DROP CONSTRAINT IF EXISTS device_lifecycle_history_phase_check;

ALTER TABLE public.device_lifecycle_history
  ADD CONSTRAINT device_lifecycle_history_phase_check
  CHECK (phase IN ('warehouse', 'configuration', 'deployed', 'repair', 'decommissioned'));

COMMENT ON TABLE public.device_lifecycle_history IS 'Storico transizioni di fase del ciclo di vita dei dispositivi';
COMMENT ON COLUMN public.device_lifecycle_history.phase IS 'Fase in cui è entrato il dispositivo';
COMMENT ON COLUMN public.device_lifecycle_history.previous_phase IS 'Fase precedente (null per la prima transizione)';
