-- Vista compatibile "automation_runs" sullo storico reale (tabella automation_run_logs).
-- security_invoker: le policy RLS della tabella base si applicano al chiamante.

create or replace view public.automation_runs
  with (security_invoker = true) as
select
  arl.id,
  arl.automation_id as flow_id,
  coalesce(
    arl.trigger_payload ->> '_automation_trigger',
    arl.trigger_payload ->> 'source',
    'unspecified'
  ) as trigger,
  case
    when arl.status = 'error' then 'error'
    else 'success'
  end as status,
  arl.error_message,
  arl.duration_ms,
  arl.trigger_payload as input,
  arl.actions_executed as output,
  arl.triggered_at as started_at,
  arl.triggered_at + (coalesce(arl.duration_ms, 0) * interval '1 millisecond') as finished_at
from public.automation_run_logs arl;

comment on view public.automation_runs is
  'Alias lettura dello storico esecuzioni (automation_run_logs): flow_id, trigger, input/output, timestamp.';

grant select on public.automation_runs to authenticated, service_role;
