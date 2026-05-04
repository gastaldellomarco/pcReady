-- Create app_settings table for global application configuration
create table app_settings (
    key text primary key,
    value jsonb,
    updated_at timestamptz default now(),
    updated_by uuid references auth.users
);

-- Enable RLS
alter table app_settings enable row level security;

-- Only admins can read app settings
create policy "Admins can read app settings" on app_settings
    for select using (
        exists (
            select 1 from user_roles
            where user_roles.user_id = auth.uid()
            and user_roles.role = 'admin'
        )
    );

-- Only admins can insert/update app settings
create policy "Admins can manage app settings" on app_settings
    for all using (
        exists (
            select 1 from user_roles
            where user_roles.user_id = auth.uid()
            and user_roles.role = 'admin'
        )
    );

-- Insert default settings
insert into app_settings (key, value) values
    ('organization_name', '"PCReady"'),
    ('default_timezone', '"Europe/Rome"'),
    ('max_devices_per_technician', '10'),
    ('self_registration_enabled', 'false'),
    ('admin_approval_required', 'true'),
    ('support_email', '""');