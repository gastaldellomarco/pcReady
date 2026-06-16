-- Composite index for cursor-based pagination on devices (ORDER BY updated_at DESC, id DESC).
-- Replaces the old single-column idx_devices_updated_at_desc which is subsumed by this composite index.

DROP INDEX IF EXISTS idx_devices_updated_at_desc;

CREATE INDEX IF NOT EXISTS idx_devices_updated_at_id_desc
  ON public.devices (updated_at DESC, id DESC);
