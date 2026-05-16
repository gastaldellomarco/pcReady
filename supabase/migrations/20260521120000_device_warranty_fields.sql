alter table public.devices
  add column if not exists purchase_date date,
  add column if not exists warranty_expiry_date date,
  add column if not exists warranty_type text,
  add column if not exists warranty_provider text,
  add column if not exists warranty_notes text;

alter table public.devices
  drop constraint if exists devices_warranty_type_check;

alter table public.devices
  add constraint devices_warranty_type_check
  check (
    warranty_type is null
    or warranty_type in ('standard', 'extended', 'onsite', 'none')
  );

create index if not exists idx_devices_warranty_expiry_date
  on public.devices (warranty_expiry_date)
  where warranty_expiry_date is not null;
