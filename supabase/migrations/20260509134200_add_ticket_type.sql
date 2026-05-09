ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_type text NOT NULL DEFAULT 'device';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tickets_ticket_type_check'
      AND conrelid = 'public.tickets'::regclass
  ) THEN
    ALTER TABLE public.tickets
      ADD CONSTRAINT tickets_ticket_type_check
      CHECK (ticket_type IN ('device', 'support', 'maintenance', 'other'));
  END IF;
END $$;

COMMENT ON COLUMN public.tickets.ticket_type IS
  'device = preparazione PC, support = assistenza tecnica, maintenance = manutenzione, other = altro';
