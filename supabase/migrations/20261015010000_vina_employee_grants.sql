-- Table privileges for vina cumulative employees
grant select on table public.vina_employees to anon, authenticated;
grant select on table public.vina_employee_history to anon, authenticated;
grant select on table public.vina_employee_uploads to anon, authenticated;

grant select, insert, update, delete on table public.vina_employees to service_role;
grant select, insert, update, delete on table public.vina_employee_history to service_role;
grant select, insert, update, delete on table public.vina_employee_uploads to service_role;

grant execute on function public.vina_apply_employee_upload(uuid, jsonb) to service_role;
grant execute on function public.vina_rollback_employee_upload(uuid, text) to service_role;
