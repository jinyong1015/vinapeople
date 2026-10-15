-- Admin password hash stored in Supabase (service_role only)

create table if not exists public.vina_admin_settings (
  id text primary key default 'default' check (id = 'default'),
  algorithm text not null default 'bcrypt' check (algorithm = 'bcrypt'),
  password_hash text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.vina_admin_settings enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon/authenticated → client deny
revoke all on table public.vina_admin_settings from public;
revoke all on table public.vina_admin_settings from anon, authenticated;
grant select, insert, update, delete on table public.vina_admin_settings to service_role;
