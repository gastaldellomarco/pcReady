-- Add preferred_theme column to user_profiles table
alter table public.user_profiles add column if not exists preferred_theme text default 'system';

-- Add check constraint to ensure valid theme values
alter table public.user_profiles drop constraint if exists user_profiles_preferred_theme_check;
alter table public.user_profiles add constraint user_profiles_preferred_theme_check
  check (preferred_theme in ('light', 'dark', 'system'));

-- Update existing rows to have default value
update public.user_profiles set preferred_theme = 'system' where preferred_theme is null;
