-- Apply attendance only on confirmed apply: one transaction creates
-- upload(status=applied) + upserts rows. No durable draft rows.

drop function if exists public.vina_apply_attendance_upload(uuid, jsonb);

create or replace function public.vina_apply_attendance_upload(
  p_file_name text,
  p_uploaded_by text,
  p_total_count integer,
  p_error_count integer,
  p_unmatched_count integer,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upload_id uuid;
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
  if coalesce(jsonb_array_length(p_rows), 0) = 0 then
    raise exception 'no attendance rows to apply';
  end if;

  insert into public.vina_attendance_uploads (
    file_name,
    uploaded_by,
    total_count,
    new_count,
    changed_count,
    unchanged_count,
    error_count,
    unmatched_count,
    status,
    payload,
    uploaded_at,
    created_at
  ) values (
    coalesce(nullif(trim(p_file_name), ''), 'attendance.xlsx'),
    coalesce(nullif(trim(p_uploaded_by), ''), 'admin'),
    coalesce(p_total_count, 0),
    0,
    0,
    0,
    coalesce(p_error_count, 0),
    coalesce(p_unmatched_count, 0),
    'applied',
    jsonb_build_object('appliedAt', v_now),
    v_now,
    v_now
  )
  returning id into v_upload_id;

  for v_item in
    select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_emp_id := null;
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

    if v_emp_id is null then
      raise exception 'employee not found for attendance: %', v_employee_no;
    end if;

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
        v_upload_id
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
          last_upload_id = v_upload_id
        where id = v_existing.id;
        v_changed := v_changed + 1;
      else
        update public.vina_attendance set
          last_upload_id = v_upload_id
        where id = v_existing.id;
        v_unchanged := v_unchanged + 1;
      end if;
    end if;
  end loop;

  update public.vina_attendance_uploads set
    new_count = v_new,
    changed_count = v_changed,
    unchanged_count = v_unchanged
  where id = v_upload_id;

  return jsonb_build_object(
    'ok', true,
    'uploadId', v_upload_id,
    'newCount', v_new,
    'changedCount', v_changed,
    'unchangedCount', v_unchanged
  );
end;
$$;

grant execute on function public.vina_apply_attendance_upload(text, text, integer, integer, integer, jsonb)
  to service_role;

-- Remove leftover draft upload rows (never applied)
delete from public.vina_attendance_uploads where status = 'draft';
