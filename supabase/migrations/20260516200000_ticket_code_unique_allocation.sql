-- Allinea la sequenza al massimo codice PCT-* esistente (evita collisioni dopo seed/restore).
SELECT setval(
  'public.ticket_seq',
  GREATEST(
    COALESCE(
      (
        SELECT MAX((substring(ticket_code FROM '^PCT-([0-9]+)$'))::bigint)
        FROM public.tickets
        WHERE ticket_code ~ '^PCT-[0-9]+$'
      ),
      0
    ),
    (SELECT last_value FROM public.ticket_seq)
  ),
  true
);

-- Se il prossimo nextval produce ancora un codice già presente (sequenza desincronizzata o import manuali),
-- avanza fino a trovare un codice libero (max 50 tentativi).
CREATE OR REPLACE FUNCTION public.set_ticket_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  attempts int := 0;
  candidate text;
BEGIN
  IF NEW.ticket_code IS NOT NULL AND btrim(NEW.ticket_code) <> '' THEN
    RETURN NEW;
  END IF;

  LOOP
    attempts := attempts + 1;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Impossibile assegnare ticket_code univoco dopo % tentativi', attempts;
    END IF;
    candidate := 'PCT-' || lpad(nextval('public.ticket_seq')::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tickets t WHERE t.ticket_code = candidate);
  END LOOP;

  NEW.ticket_code := candidate;
  RETURN NEW;
END;
$$;
