alter table public.devices
  add column if not exists brand text;

alter table public.tickets
  add column if not exists category text;
