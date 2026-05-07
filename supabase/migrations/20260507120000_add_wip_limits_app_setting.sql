insert into app_settings (key, value)
values ('wip_limits', '{"pending":20,"in-progress":5,"testing":5,"ready":20}'::jsonb)
on conflict (key) do nothing;
