insert into app_settings (key, value)
values
  ('os_options', '["Windows 11 Pro","Windows 10 Pro","Ubuntu 22.04 LTS","macOS (BYOD)"]'::jsonb),
  ('device_brands', '["Dell","HP","Lenovo","Apple","Asus","Acer","Microsoft"]'::jsonb),
  ('ticket_categories', '[]'::jsonb)
on conflict (key) do nothing;