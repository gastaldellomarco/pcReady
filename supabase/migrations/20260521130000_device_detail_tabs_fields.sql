alter table public.devices
  add column if not exists device_type text,
  add column if not exists location_office text,
  add column if not exists location_floor text,
  add column if not exists location_desk text,
  add column if not exists cpu_name text,
  add column if not exists cpu_frequency_ghz numeric,
  add column if not exists cpu_cores integer,
  add column if not exists ram_gb integer,
  add column if not exists ram_type text,
  add column if not exists ram_frequency_mhz integer,
  add column if not exists storage_type text,
  add column if not exists storage_capacity_gb integer,
  add column if not exists storage_drive_count integer,
  add column if not exists os_version text,
  add column if not exists os_architecture text,
  add column if not exists screen_resolution text,
  add column if not exists screen_size_inches numeric,
  add column if not exists screen_type text,
  add column if not exists wifi text,
  add column if not exists ethernet text,
  add column if not exists bluetooth text,
  add column if not exists purchase_cost numeric;

create index if not exists idx_devices_device_type on public.devices (device_type);
create index if not exists idx_devices_location_office on public.devices (location_office);
