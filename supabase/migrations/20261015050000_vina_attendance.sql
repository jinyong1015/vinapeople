-- VINA attendance (근태현황) — independent of personnel Excel replace flow

create table if not exists public.vina_attendance_uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by text,
  total_count integer not null default 0,
  new_count integer not null default 0,
  changed_count integer not null default 0,
  unchanged_count integer not null default 0,
  error_count integer not null default 0,
  unmatched_count integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'applied', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vina_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.vina_employees (id) on delete set null,
  employee_no text not null,
  attendance_date date not null,
  name_snapshot text not null default '',
  department_snapshot text not null default '',
  shift text not null default '',
  reason text not null default '',
  remarks text not null default '',
  person_count numeric,
  month_value integer,
  day_value integer,
  -- NO: 사유 유형 코드 (동일 날짜·사번에 결근/퇴사 등 복수 기록 구분)
  no_value integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_upload_id uuid references public.vina_attendance_uploads (id) on delete set null,
  constraint vina_attendance_employee_no_not_blank check (btrim(employee_no) <> ''),
  constraint vina_attendance_uniq unique (attendance_date, employee_no, no_value)
);

create index if not exists vina_attendance_date_idx
  on public.vina_attendance (attendance_date desc);
create index if not exists vina_attendance_employee_no_idx
  on public.vina_attendance (employee_no);
create index if not exists vina_attendance_employee_id_idx
  on public.vina_attendance (employee_id);
create index if not exists vina_attendance_reason_idx
  on public.vina_attendance (reason);
create index if not exists vina_attendance_uploads_uploaded_at_idx
  on public.vina_attendance_uploads (uploaded_at desc);

alter table public.vina_attendance enable row level security;
alter table public.vina_attendance_uploads enable row level security;

grant select on table public.vina_attendance to anon, authenticated;
grant select on table public.vina_attendance_uploads to anon, authenticated;
grant select, insert, update, delete on table public.vina_attendance to service_role;
grant select, insert, update, delete on table public.vina_attendance_uploads to service_role;

drop policy if exists vina_attendance_select_all on public.vina_attendance;
create policy vina_attendance_select_all
  on public.vina_attendance
  for select
  to anon, authenticated
  using (true);

drop policy if exists vina_attendance_uploads_select_all on public.vina_attendance_uploads;
create policy vina_attendance_uploads_select_all
  on public.vina_attendance_uploads
  for select
  to anon, authenticated
  using (true);

-- Atomic apply: upsert by (attendance_date, employee_no, no_value)
create or replace function public.vina_apply_attendance_upload(
  p_upload_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upload public.vina_attendance_uploads%rowtype;
  v_item jsonb;
  v_now timestamptz := now();
  v_new integer := 0;
  v_changed integer := 0;
  v_unchanged integer := 0;
  v_existing public.vina_attendance%rowtype;
  v_employee_no text;
  v_date date;
  v_no integer;
  v_emp_id uuid;
  v_changed_flag boolean;
begin
  select * into v_upload
  from public.vina_attendance_uploads
  where id = p_upload_id
  for update;

  if not found then
    raise exception 'attendance upload not found: %', p_upload_id;
  end if;

  if v_upload.status = 'applied' then
    raise exception 'attendance upload already applied: %', p_upload_id;
  end if;

  for v_item in
    select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_employee_no := nullif(trim(coalesce(v_item ->> 'employee_no', '')), '');
    if v_employee_no is null then
      raise exception 'attendance row missing employee_no';
    end if;

    v_date := (v_item ->> 'attendance_date')::date;
    if v_date is null then
      raise exception 'attendance row missing attendance_date';
    end if;

    v_no := coalesce(nullif(v_item ->> 'no_value', '')::integer, 0);

    select id into v_emp_id
    from public.vina_employees
    where employee_no = v_employee_no
    limit 1;

    select * into v_existing
    from public.vina_attendance
    where attendance_date = v_date
      and employee_no = v_employee_no
      and no_value = v_no
    for update;

    if not found then
      insert into public.vina_attendance (
        employee_id, employee_no, attendance_date,
        name_snapshot, department_snapshot, shift, reason, remarks,
        person_count, month_value, day_value, no_value,
        created_at, updated_at, last_upload_id
      ) values (
        v_emp_id,
        v_employee_no,
        v_date,
        coalesce(v_item ->> 'name_snapshot', ''),
        coalesce(v_item ->> 'department_snapshot', ''),
        coalesce(v_item ->> 'shift', ''),
        coalesce(v_item ->> 'reason', ''),
        coalesce(v_item ->> 'remarks', ''),
        nullif(v_item ->> 'person_count', '')::numeric,
        nullif(v_item ->> 'month_value', '')::integer,
        nullif(v_item ->> 'day_value', '')::integer,
        v_no,
        v_now,
        v_now,
        p_upload_id
      );
      v_new := v_new + 1;
    else
      v_changed_flag :=
        coalesce(v_existing.name_snapshot, '') is distinct from coalesce(v_item ->> 'name_snapshot', '')
        or coalesce(v_existing.department_snapshot, '') is distinct from coalesce(v_item ->> 'department_snapshot', '')
        or coalesce(v_existing.shift, '') is distinct from coalesce(v_item ->> 'shift', '')
        or coalesce(v_existing.reason, '') is distinct from coalesce(v_item ->> 'reason', '')
        or coalesce(v_existing.remarks, '') is distinct from coalesce(v_item ->> 'remarks', '')
        or v_existing.person_count is distinct from nullif(v_item ->> 'person_count', '')::numeric
        or v_existing.month_value is distinct from nullif(v_item ->> 'month_value', '')::integer
        or v_existing.day_value is distinct from nullif(v_item ->> 'day_value', '')::integer
        or v_existing.employee_id is distinct from v_emp_id;

      if v_changed_flag then
        update public.vina_attendance set
          employee_id = v_emp_id,
          name_snapshot = coalesce(v_item ->> 'name_snapshot', ''),
          department_snapshot = coalesce(v_item ->> 'department_snapshot', ''),
          shift = coalesce(v_item ->> 'shift', ''),
          reason = coalesce(v_item ->> 'reason', ''),
          remarks = coalesce(v_item ->> 'remarks', ''),
          person_count = nullif(v_item ->> 'person_count', '')::numeric,
          month_value = nullif(v_item ->> 'month_value', '')::integer,
          day_value = nullif(v_item ->> 'day_value', '')::integer,
          updated_at = v_now,
          last_upload_id = p_upload_id
        where id = v_existing.id;
        v_changed := v_changed + 1;
      else
        update public.vina_attendance set
          last_upload_id = p_upload_id
        where id = v_existing.id;
        v_unchanged := v_unchanged + 1;
      end if;
    end if;
  end loop;

  update public.vina_attendance_uploads set
    status = 'applied',
    new_count = v_new,
    changed_count = v_changed,
    unchanged_count = v_unchanged,
    payload = jsonb_build_object('appliedAt', v_now)
  where id = p_upload_id;

  return jsonb_build_object(
    'ok', true,
    'uploadId', p_upload_id,
    'newCount', v_new,
    'changedCount', v_changed,
    'unchangedCount', v_unchanged
  );
end;
$$;

grant execute on function public.vina_apply_attendance_upload(uuid, jsonb) to service_role;
