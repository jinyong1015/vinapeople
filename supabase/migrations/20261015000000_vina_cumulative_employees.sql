-- VINA cumulative employee management

create extension if not exists "pgcrypto";

create table if not exists public.vina_employee_uploads (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  as_of_date date not null,
  uploaded_at timestamptz not null default now(),
  uploaded_by text,
  total_count integer not null default 0,
  new_count integer not null default 0,
  changed_count integer not null default 0,
  unchanged_count integer not null default 0,
  error_count integer not null default 0,
  missing_count integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'applied', 'failed', 'rolled_back')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.vina_employees (
  id uuid primary key default gen_random_uuid(),
  employee_no text not null,
  source_no integer,
  name text not null default '',
  workplace text not null default '',
  employment_status text not null default '',
  category text not null default '',
  category1 text not null default '',
  position text not null default '',
  process text not null default '',
  department text not null default '',
  category3 text not null default '',
  category4 text not null default '',
  gender_source text not null default '',
  gender_label_source text not null default '',
  gender text not null default '',
  birth_date date,
  join_date date,
  resign_date date,
  age_years integer,
  tenure_years integer,
  tenure_months_remainder integer,
  tenure_total_months integer,
  tenure_total_days integer,
  source_tenure_years integer,
  source_tenure_months integer,
  source_tenure_days integer,
  photo_path text,
  as_of_date date,
  updated_at timestamptz not null default now(),
  updated_by text,
  last_upload_id uuid references public.vina_employee_uploads (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint vina_employees_employee_no_key unique (employee_no)
);

create table if not exists public.vina_employee_history (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.vina_employees (id) on delete cascade,
  employee_no text not null,
  field_name text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now(),
  change_source text not null
    check (change_source in ('upload', 'manual', 'resign_confirm', 'rollback')),
  upload_id uuid references public.vina_employee_uploads (id) on delete set null,
  changed_by text
);

create index if not exists vina_employees_status_idx
  on public.vina_employees (employment_status);
create index if not exists vina_employee_history_employee_idx
  on public.vina_employee_history (employee_id, changed_at desc);
create index if not exists vina_employee_history_upload_idx
  on public.vina_employee_history (upload_id);
create index if not exists vina_employee_uploads_uploaded_at_idx
  on public.vina_employee_uploads (uploaded_at desc);

alter table public.vina_employees enable row level security;
alter table public.vina_employee_history enable row level security;
alter table public.vina_employee_uploads enable row level security;

-- Table privileges (RLS still applies to anon/authenticated)
grant select on table public.vina_employees to anon, authenticated;
grant select on table public.vina_employee_history to anon, authenticated;
grant select on table public.vina_employee_uploads to anon, authenticated;
grant select, insert, update, delete on table public.vina_employees to service_role;
grant select, insert, update, delete on table public.vina_employee_history to service_role;
grant select, insert, update, delete on table public.vina_employee_uploads to service_role;

drop policy if exists vina_employees_select_all on public.vina_employees;
create policy vina_employees_select_all
  on public.vina_employees
  for select
  to anon, authenticated
  using (true);

drop policy if exists vina_employee_history_select_all on public.vina_employee_history;
create policy vina_employee_history_select_all
  on public.vina_employee_history
  for select
  to anon, authenticated
  using (true);

drop policy if exists vina_employee_uploads_select_all on public.vina_employee_uploads;
create policy vina_employee_uploads_select_all
  on public.vina_employee_uploads
  for select
  to anon, authenticated
  using (true);

-- Writes only via service_role (bypasses RLS) / SECURITY DEFINER RPC

create or replace function public.vina_apply_employee_upload(
  p_upload_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upload public.vina_employee_uploads%rowtype;
  v_item jsonb;
  v_change jsonb;
  v_emp_id uuid;
  v_employee_no text;
  v_now timestamptz := now();
  v_as_of date;
  v_actor text;
  v_new_count integer := 0;
  v_changed_count integer := 0;
begin
  select * into v_upload
  from public.vina_employee_uploads
  where id = p_upload_id
  for update;

  if not found then
    raise exception 'upload not found: %', p_upload_id;
  end if;

  if v_upload.status = 'applied' then
    raise exception 'upload already applied: %', p_upload_id;
  end if;

  v_as_of := coalesce((p_payload ->> 'asOfDate')::date, v_upload.as_of_date);
  v_actor := coalesce(p_payload ->> 'uploadedBy', v_upload.uploaded_by, 'admin');

  -- inserts
  for v_item in
    select * from jsonb_array_elements(coalesce(p_payload -> 'inserts', '[]'::jsonb))
  loop
    v_employee_no := nullif(trim(coalesce(v_item ->> 'employee_no', '')), '');
    if v_employee_no is null then
      raise exception 'insert missing employee_no';
    end if;

    insert into public.vina_employees (
      employee_no, source_no, name, workplace, employment_status,
      category, category1, position, process, department, category3, category4,
      gender_source, gender_label_source, gender,
      birth_date, join_date, resign_date,
      age_years, tenure_years, tenure_months_remainder, tenure_total_months, tenure_total_days,
      source_tenure_years, source_tenure_months, source_tenure_days,
      photo_path, as_of_date, updated_at, updated_by, last_upload_id
    ) values (
      v_employee_no,
      nullif(v_item ->> 'source_no', '')::integer,
      coalesce(v_item ->> 'name', ''),
      coalesce(v_item ->> 'workplace', ''),
      coalesce(v_item ->> 'employment_status', ''),
      coalesce(v_item ->> 'category', ''),
      coalesce(v_item ->> 'category1', ''),
      coalesce(v_item ->> 'position', ''),
      coalesce(v_item ->> 'process', ''),
      coalesce(v_item ->> 'department', ''),
      coalesce(v_item ->> 'category3', ''),
      coalesce(v_item ->> 'category4', ''),
      coalesce(v_item ->> 'gender_source', ''),
      coalesce(v_item ->> 'gender_label_source', ''),
      coalesce(v_item ->> 'gender', ''),
      nullif(v_item ->> 'birth_date', '')::date,
      nullif(v_item ->> 'join_date', '')::date,
      nullif(v_item ->> 'resign_date', '')::date,
      nullif(v_item ->> 'age_years', '')::integer,
      nullif(v_item ->> 'tenure_years', '')::integer,
      nullif(v_item ->> 'tenure_months_remainder', '')::integer,
      nullif(v_item ->> 'tenure_total_months', '')::integer,
      nullif(v_item ->> 'tenure_total_days', '')::integer,
      nullif(v_item ->> 'source_tenure_years', '')::integer,
      nullif(v_item ->> 'source_tenure_months', '')::integer,
      nullif(v_item ->> 'source_tenure_days', '')::integer,
      nullif(v_item ->> 'photo_path', ''),
      v_as_of,
      v_now,
      v_actor,
      p_upload_id
    )
    returning id into v_emp_id;

    insert into public.vina_employee_history (
      employee_id, employee_no, field_name, old_value, new_value,
      changed_at, change_source, upload_id, changed_by
    ) values (
      v_emp_id, v_employee_no, '_created', null, '1',
      v_now, 'upload', p_upload_id, v_actor
    );

    v_new_count := v_new_count + 1;
  end loop;

  -- updates
  for v_item in
    select * from jsonb_array_elements(coalesce(p_payload -> 'updates', '[]'::jsonb))
  loop
    v_employee_no := nullif(trim(coalesce(v_item ->> 'employee_no', '')), '');
    if v_employee_no is null then
      raise exception 'update missing employee_no';
    end if;

    select id into v_emp_id
    from public.vina_employees
    where employee_no = v_employee_no
    for update;

    if v_emp_id is null then
      raise exception 'employee not found for update: %', v_employee_no;
    end if;

    update public.vina_employees set
      source_no = coalesce(nullif(v_item ->> 'source_no', '')::integer, source_no),
      name = coalesce(v_item ->> 'name', name),
      workplace = coalesce(v_item ->> 'workplace', workplace),
      employment_status = coalesce(v_item ->> 'employment_status', employment_status),
      category = coalesce(v_item ->> 'category', category),
      category1 = coalesce(v_item ->> 'category1', category1),
      position = coalesce(v_item ->> 'position', position),
      process = coalesce(v_item ->> 'process', process),
      department = coalesce(v_item ->> 'department', department),
      category3 = coalesce(v_item ->> 'category3', category3),
      category4 = coalesce(v_item ->> 'category4', category4),
      gender_source = coalesce(v_item ->> 'gender_source', gender_source),
      gender_label_source = coalesce(v_item ->> 'gender_label_source', gender_label_source),
      gender = coalesce(v_item ->> 'gender', gender),
      birth_date = case
        when v_item ? 'birth_date' then nullif(v_item ->> 'birth_date', '')::date
        else birth_date
      end,
      join_date = case
        when v_item ? 'join_date' then nullif(v_item ->> 'join_date', '')::date
        else join_date
      end,
      resign_date = case
        when v_item ? 'resign_date' then nullif(v_item ->> 'resign_date', '')::date
        else resign_date
      end,
      age_years = coalesce(nullif(v_item ->> 'age_years', '')::integer, age_years),
      tenure_years = coalesce(nullif(v_item ->> 'tenure_years', '')::integer, tenure_years),
      tenure_months_remainder = coalesce(
        nullif(v_item ->> 'tenure_months_remainder', '')::integer,
        tenure_months_remainder
      ),
      tenure_total_months = coalesce(
        nullif(v_item ->> 'tenure_total_months', '')::integer,
        tenure_total_months
      ),
      tenure_total_days = coalesce(
        nullif(v_item ->> 'tenure_total_days', '')::integer,
        tenure_total_days
      ),
      source_tenure_years = coalesce(
        nullif(v_item ->> 'source_tenure_years', '')::integer,
        source_tenure_years
      ),
      source_tenure_months = coalesce(
        nullif(v_item ->> 'source_tenure_months', '')::integer,
        source_tenure_months
      ),
      source_tenure_days = coalesce(
        nullif(v_item ->> 'source_tenure_days', '')::integer,
        source_tenure_days
      ),
      as_of_date = v_as_of,
      updated_at = v_now,
      updated_by = v_actor,
      last_upload_id = p_upload_id
    where id = v_emp_id;

    for v_change in
      select * from jsonb_array_elements(coalesce(v_item -> 'changes', '[]'::jsonb))
    loop
      insert into public.vina_employee_history (
        employee_id, employee_no, field_name, old_value, new_value,
        changed_at, change_source, upload_id, changed_by
      ) values (
        v_emp_id,
        v_employee_no,
        coalesce(v_change ->> 'field', ''),
        v_change ->> 'oldValue',
        v_change ->> 'newValue',
        v_now,
        'upload',
        p_upload_id,
        v_actor
      );
    end loop;

    v_changed_count := v_changed_count + 1;
  end loop;

  update public.vina_employee_uploads set
    status = 'applied',
    as_of_date = v_as_of,
    new_count = coalesce((p_payload ->> 'newCount')::integer, v_new_count),
    changed_count = coalesce((p_payload ->> 'changedCount')::integer, v_changed_count),
    unchanged_count = coalesce((p_payload ->> 'unchangedCount')::integer, unchanged_count),
    error_count = coalesce((p_payload ->> 'errorCount')::integer, error_count),
    missing_count = coalesce((p_payload ->> 'missingCount')::integer, missing_count),
    total_count = coalesce((p_payload ->> 'totalCount')::integer, total_count),
    payload = coalesce(p_payload, payload)
  where id = p_upload_id;

  return jsonb_build_object(
    'ok', true,
    'uploadId', p_upload_id,
    'newCount', v_new_count,
    'changedCount', v_changed_count
  );
end;
$$;

revoke all on function public.vina_apply_employee_upload(uuid, jsonb) from public;
revoke all on function public.vina_apply_employee_upload(uuid, jsonb) from anon, authenticated;
grant execute on function public.vina_apply_employee_upload(uuid, jsonb) to service_role;

create or replace function public.vina_rollback_employee_upload(
  p_upload_id uuid,
  p_actor text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upload public.vina_employee_uploads%rowtype;
  v_hist record;
  v_skipped integer := 0;
  v_reverted integer := 0;
  v_deleted integer := 0;
  v_later_exists boolean;
  v_now timestamptz := now();
begin
  select * into v_upload
  from public.vina_employee_uploads
  where id = p_upload_id
  for update;

  if not found then
    raise exception 'upload not found: %', p_upload_id;
  end if;

  if v_upload.status <> 'applied' then
    raise exception 'upload is not applied: %', v_upload.status;
  end if;

  -- revert field changes newest-first, skip if later change exists on same field
  for v_hist in
    select *
    from public.vina_employee_history
    where upload_id = p_upload_id
      and field_name <> '_created'
      and change_source = 'upload'
    order by changed_at desc, id desc
  loop
    select exists (
      select 1
      from public.vina_employee_history h2
      where h2.employee_id = v_hist.employee_id
        and h2.field_name = v_hist.field_name
        and (
          h2.changed_at > v_hist.changed_at
          or (h2.changed_at = v_hist.changed_at and h2.id > v_hist.id)
        )
        and coalesce(h2.upload_id::text, '') <> p_upload_id::text
    ) into v_later_exists;

    if v_later_exists then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    update public.vina_employees e set
      name = case when v_hist.field_name = 'name' then coalesce(v_hist.old_value, '') else e.name end,
      workplace = case when v_hist.field_name = 'workplace' then coalesce(v_hist.old_value, '') else e.workplace end,
      employment_status = case when v_hist.field_name = 'employment_status' then coalesce(v_hist.old_value, '') else e.employment_status end,
      category = case when v_hist.field_name = 'category' then coalesce(v_hist.old_value, '') else e.category end,
      category1 = case when v_hist.field_name = 'category1' then coalesce(v_hist.old_value, '') else e.category1 end,
      position = case when v_hist.field_name = 'position' then coalesce(v_hist.old_value, '') else e.position end,
      process = case when v_hist.field_name = 'process' then coalesce(v_hist.old_value, '') else e.process end,
      department = case when v_hist.field_name = 'department' then coalesce(v_hist.old_value, '') else e.department end,
      category3 = case when v_hist.field_name = 'category3' then coalesce(v_hist.old_value, '') else e.category3 end,
      category4 = case when v_hist.field_name = 'category4' then coalesce(v_hist.old_value, '') else e.category4 end,
      gender_source = case when v_hist.field_name = 'gender_source' then coalesce(v_hist.old_value, '') else e.gender_source end,
      gender_label_source = case when v_hist.field_name = 'gender_label_source' then coalesce(v_hist.old_value, '') else e.gender_label_source end,
      gender = case when v_hist.field_name = 'gender' then coalesce(v_hist.old_value, '') else e.gender end,
      birth_date = case when v_hist.field_name = 'birth_date' then nullif(v_hist.old_value, '')::date else e.birth_date end,
      join_date = case when v_hist.field_name = 'join_date' then nullif(v_hist.old_value, '')::date else e.join_date end,
      resign_date = case when v_hist.field_name = 'resign_date' then nullif(v_hist.old_value, '')::date else e.resign_date end,
      updated_at = v_now,
      updated_by = p_actor
    where e.id = v_hist.employee_id;

    insert into public.vina_employee_history (
      employee_id, employee_no, field_name, old_value, new_value,
      changed_at, change_source, upload_id, changed_by
    ) values (
      v_hist.employee_id, v_hist.employee_no, v_hist.field_name,
      v_hist.new_value, v_hist.old_value,
      v_now, 'rollback', p_upload_id, p_actor
    );

    v_reverted := v_reverted + 1;
  end loop;

  -- delete employees created by this upload if no later history exists
  for v_hist in
    select *
    from public.vina_employee_history
    where upload_id = p_upload_id
      and field_name = '_created'
      and change_source = 'upload'
  loop
    select exists (
      select 1
      from public.vina_employee_history h2
      where h2.employee_id = v_hist.employee_id
        and h2.changed_at > v_hist.changed_at
        and coalesce(h2.upload_id::text, '') <> p_upload_id::text
    ) into v_later_exists;

    if v_later_exists then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    delete from public.vina_employees where id = v_hist.employee_id;
    v_deleted := v_deleted + 1;
  end loop;

  update public.vina_employee_uploads
  set status = 'rolled_back'
  where id = p_upload_id;

  return jsonb_build_object(
    'ok', true,
    'uploadId', p_upload_id,
    'revertedFields', v_reverted,
    'deletedEmployees', v_deleted,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function public.vina_rollback_employee_upload(uuid, text) from public;
revoke all on function public.vina_rollback_employee_upload(uuid, text) from anon, authenticated;
grant execute on function public.vina_rollback_employee_upload(uuid, text) to service_role;
