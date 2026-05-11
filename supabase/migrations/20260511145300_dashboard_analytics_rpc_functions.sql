ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

UPDATE public.tickets
SET closed_at = updated_at
WHERE closed_at IS NULL
  AND status = 'ready';

CREATE OR REPLACE FUNCTION public.set_ticket_closed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ready' AND OLD.status IS DISTINCT FROM 'ready' AND NEW.closed_at IS NULL THEN
    NEW.closed_at = now();
  ELSIF NEW.status IS DISTINCT FROM 'ready' THEN
    NEW.closed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_ticket_closed_at ON public.tickets;
CREATE TRIGGER trg_set_ticket_closed_at
BEFORE UPDATE OF status ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_ticket_closed_at();

CREATE OR REPLACE FUNCTION public.get_tickets_by_month(date_from timestamptz, date_to timestamptz)
RETURNS TABLE(month date, opened bigint, closed bigint, avg_days numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT
      date_trunc('month', date_from)::date AS month_from,
      date_trunc('month', date_to)::date AS month_to,
      date_from AS date_from,
      date_to AS date_to
  ),
  months AS (
    SELECT generate_series(bounds.month_from, bounds.month_to, interval '1 month')::date AS month
    FROM bounds
  ),
  opened AS (
    SELECT date_trunc('month', t.created_at)::date AS month, count(*)::bigint AS total
    FROM public.tickets t, bounds b
    WHERE t.created_at >= b.date_from
      AND t.created_at <= b.date_to
    GROUP BY 1
  ),
  closed AS (
    SELECT
      date_trunc('month', t.closed_at)::date AS month,
      count(*)::bigint AS total,
      round((extract(epoch FROM avg(t.closed_at - t.created_at)) / 86400)::numeric, 2) AS avg_days
    FROM public.tickets t, bounds b
    WHERE t.closed_at IS NOT NULL
      AND t.closed_at >= b.date_from
      AND t.closed_at <= b.date_to
    GROUP BY 1
  )
  SELECT
    m.month,
    coalesce(o.total, 0)::bigint AS opened,
    coalesce(c.total, 0)::bigint AS closed,
    c.avg_days
  FROM months m
  LEFT JOIN opened o ON o.month = m.month
  LEFT JOIN closed c ON c.month = m.month
  ORDER BY m.month;
$$;

CREATE OR REPLACE FUNCTION public.get_technician_kpi(date_from timestamptz, date_to timestamptz)
RETURNS TABLE(technician_id uuid, full_name text, assigned bigint, completed bigint, avg_days numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    t.assignee_id AS technician_id,
    coalesce(nullif(p.full_name, ''), 'Non assegnato') AS full_name,
    count(*) FILTER (WHERE t.created_at >= date_from AND t.created_at <= date_to)::bigint AS assigned,
    count(*) FILTER (WHERE t.closed_at IS NOT NULL AND t.closed_at >= date_from AND t.closed_at <= date_to)::bigint AS completed,
    round((extract(epoch FROM avg(t.closed_at - t.created_at) FILTER (
      WHERE t.closed_at IS NOT NULL AND t.closed_at >= date_from AND t.closed_at <= date_to
    )) / 86400)::numeric, 2) AS avg_days
  FROM public.tickets t
  LEFT JOIN public.profiles p ON p.id = t.assignee_id
  WHERE (t.created_at >= date_from AND t.created_at <= date_to)
     OR (t.closed_at IS NOT NULL AND t.closed_at >= date_from AND t.closed_at <= date_to)
  GROUP BY t.assignee_id, p.full_name
  ORDER BY completed DESC, assigned DESC, full_name;
$$;

CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets (created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_closed_at ON public.tickets (closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_created_at ON public.tickets (assignee_id, created_at);
