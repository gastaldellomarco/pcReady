-- create automation_flows table
create table if not exists automation_flows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  active boolean not null default false,
  version integer not null default 1,
  flow_definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create index if not exists idx_automation_flows_updated_at on automation_flows(updated_at desc);
