-- Genera ticket_code lato database per evitare collisioni tra client concorrenti.
CREATE SEQUENCE IF NOT EXISTS public.ticket_seq START 1;

DO $$
DECLARE
  max_ticket_number bigint;
BEGIN
  SELECT COALESCE(MAX((substring(ticket_code from '^PCT-([0-9]+)$'))::bigint), 0)
  INTO max_ticket_number
  FROM public.tickets
  WHERE ticket_code ~ '^PCT-[0-9]+$';

  IF max_ticket_number > 0 THEN
    PERFORM setval('public.ticket_seq', max_ticket_number, true);
  ELSE
    PERFORM setval('public.ticket_seq', 1, false);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_ticket_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.ticket_code IS NULL OR btrim(NEW.ticket_code) = '' THEN
    NEW.ticket_code := 'PCT-' || lpad(nextval('public.ticket_seq')::text, 5, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_ticket_insert ON public.tickets;

CREATE TRIGGER before_ticket_insert
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  WHEN (NEW.ticket_code IS NULL OR btrim(NEW.ticket_code) = '')
  EXECUTE FUNCTION public.set_ticket_code();
