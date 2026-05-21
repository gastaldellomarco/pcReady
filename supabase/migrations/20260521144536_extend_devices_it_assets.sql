alter table public.devices
  add column if not exists category text,
  add column if not exists device_type text,
  add column if not exists ip_address inet,
  add column if not exists mac_address macaddr,
  add column if not exists location text,
  add column if not exists firmware_version text,
  add column if not exists port_count integer,
  add column if not exists poe_supported boolean,
  add column if not exists toner_model text,
  add column if not exists page_count integer,
  add column if not exists license_expiry date,
  add column if not exists print_technology text,
  add column if not exists vlan_config text,
  add column if not exists rack_position text,
  add column if not exists server_role text;

update public.devices
set
  category = coalesce(nullif(category, ''), 'endpoint'),
  device_type = coalesce(nullif(device_type, ''), 'Desktop')
where category is null
  or category = ''
  or category not in ('endpoint','printing','network','server_infra','mobile','peripheral')
  or device_type is null
  or device_type = '';

alter table public.devices
  alter column category set default 'endpoint',
  alter column category set not null,
  alter column device_type set default 'Desktop',
  alter column device_type set not null;

alter table public.devices
  drop constraint if exists chk_device_category;

alter table public.devices
  add constraint chk_device_category
  check (category in ('endpoint','printing','network','server_infra','mobile','peripheral'));

create index if not exists idx_devices_category on public.devices(category);
create index if not exists idx_devices_type on public.devices(device_type);
create index if not exists idx_devices_ip_address on public.devices(ip_address);
