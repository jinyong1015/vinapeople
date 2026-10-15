-- App login users (user | admin) + tighten client RLS on vina tables
-- Existing vina_admin_settings password hash is preserved and seeded as admin user.

create table if not exists public.vina_app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  role text not null check (role in ('user', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint vina_app_users_username_not_blank check (btrim(username) <> ''),
  constraint vina_app_users_username_unique unique (username)
);

create index if not exists vina_app_users_role_idx
  on public.vina_app_users (role);

alter table public.vina_app_users enable row level security;

revoke all on table public.vina_app_users from public;
revoke all on table public.vina_app_users from anon, authenticated;
grant select, insert, update, delete on table public.vina_app_users to service_role;
grant all on table public.vina_app_users to postgres;

comment on table public.vina_app_users is
  '앱 로그인 계정 (user=조회, admin=관리). 클라이언트 직접 접근 불가.';

-- Seed admin from existing password hash (do not reset password)
insert into public.vina_app_users (username, password_hash, role, updated_by)
select
  'admin',
  s.password_hash,
  'admin',
  coalesce(s.updated_by, 'migration')
from public.vina_admin_settings s
where s.id = 'default'
  and s.algorithm = 'bcrypt'
  and s.password_hash like '$2%'
on conflict (username) do nothing;

-- Drop open SELECT policies so anon/authenticated cannot read via PostgREST.
-- Next.js APIs continue to use service_role (bypasses RLS).
drop policy if exists vina_employees_select_all on public.vina_employees;
drop policy if exists vina_employee_uploads_select_all on public.vina_employee_uploads;
drop policy if exists vina_employee_history_select_all on public.vina_employee_history;
drop policy if exists vina_attendance_select_all on public.vina_attendance;
drop policy if exists vina_attendance_uploads_select_all on public.vina_attendance_uploads;

revoke all on table public.vina_employees from anon, authenticated;
revoke all on table public.vina_employee_uploads from anon, authenticated;
revoke all on table public.vina_employee_history from anon, authenticated;
revoke all on table public.vina_attendance from anon, authenticated;
revoke all on table public.vina_attendance_uploads from anon, authenticated;

grant select on table public.vina_employees to service_role;
grant select, insert, update, delete on table public.vina_employees to service_role;
grant select, insert, update, delete on table public.vina_employee_uploads to service_role;
grant select, insert, update, delete on table public.vina_employee_history to service_role;
grant select, insert, update, delete on table public.vina_attendance to service_role;
grant select, insert, update, delete on table public.vina_attendance_uploads to service_role;

-- Photos: keep public read for <img> URLs after login; block client writes (already)
-- Ensure write deny policies remain
drop policy if exists "vina_employee_photos_no_client_insert" on storage.objects;
create policy "vina_employee_photos_no_client_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (false);

drop policy if exists "vina_employee_photos_no_client_update" on storage.objects;
create policy "vina_employee_photos_no_client_update"
  on storage.objects
  for update
  to anon, authenticated
  using (false);

drop policy if exists "vina_employee_photos_no_client_delete" on storage.objects;
create policy "vina_employee_photos_no_client_delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (false);
