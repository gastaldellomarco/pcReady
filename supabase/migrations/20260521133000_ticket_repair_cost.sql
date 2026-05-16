alter table public.tickets
  add column if not exists repair_cost numeric;

create index if not exists idx_tickets_repair_cost_maintenance
  on public.tickets (repair_cost)
  where ticket_type = 'maintenance' and repair_cost is not null;
