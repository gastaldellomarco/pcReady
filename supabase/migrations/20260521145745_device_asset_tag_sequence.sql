alter table public.devices
  add column if not exists asset_tag text;

create sequence if not exists public.device_asset_seq start 1;

do $$
declare
  max_asset_number bigint;
begin
  select coalesce(max((substring(asset_tag from '^PCR-([0-9]+)$'))::bigint), 0)
  into max_asset_number
  from public.devices
  where asset_tag ~ '^PCR-[0-9]+$';

  if max_asset_number > 0 then
    perform setval('public.device_asset_seq', max_asset_number, true);
  else
    perform setval('public.device_asset_seq', 1, false);
  end if;
end $$;

create or replace function public.set_device_asset_tag()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  if new.asset_tag is not null and btrim(new.asset_tag) <> '' then
    new.asset_tag := btrim(new.asset_tag);
    return new;
  end if;

  loop
    attempts := attempts + 1;
    if attempts > 25 then
      raise exception 'Impossibile assegnare asset_tag univoco dopo % tentativi', attempts;
    end if;

    candidate := 'PCR-' || lpad(nextval('public.device_asset_seq')::text, 6, '0');
    exit when not exists (select 1 from public.devices d where d.asset_tag = candidate);
  end loop;

  new.asset_tag := candidate;
  return new;
end;
$$;

update public.devices
set asset_tag = 'PCR-' || lpad(nextval('public.device_asset_seq')::text, 6, '0')
where asset_tag is null or btrim(asset_tag) = '';

alter table public.devices
  alter column asset_tag set not null;

alter table public.devices
  drop constraint if exists devices_asset_tag_key;

alter table public.devices
  add constraint devices_asset_tag_key unique (asset_tag);

drop trigger if exists before_device_asset_tag_insert on public.devices;

create trigger before_device_asset_tag_insert
  before insert on public.devices
  for each row
  execute function public.set_device_asset_tag();
