-- 근태(vina_attendance) 2년 초과분 자동 삭제
-- 기준: attendance_date < (current_date - interval '2 years')
-- 예) 오늘 2026-10-15 → 2024-10-14 이하 삭제, 2024-10-15 이후 유지
-- 업로드 이력(vina_attendance_uploads)·인원(vina_employees)은 삭제하지 않음
-- (attendance.last_upload_id FK는 ON DELETE SET NULL — 근태 행 삭제만 안전)

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create table if not exists public.vina_attendance_purge_logs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  cutoff_date date not null,
  candidate_count integer not null default 0,
  deleted_count integer not null default 0,
  skipped_null_or_invalid_count integer not null default 0,
  dry_run boolean not null default false,
  status text not null default 'success'
    check (status in ('success', 'failed', 'dry_run')),
  error_message text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists vina_attendance_purge_logs_ran_at_idx
  on public.vina_attendance_purge_logs (ran_at desc);

alter table public.vina_attendance_purge_logs enable row level security;

drop policy if exists vina_attendance_purge_logs_select_admin on public.vina_attendance_purge_logs;
-- 로그는 서비스 롤/DB 콘솔에서 확인. API 공개 조회 정책은 두지 않음.
revoke all on table public.vina_attendance_purge_logs from anon, authenticated;
grant select, insert on table public.vina_attendance_purge_logs to service_role;
grant all on table public.vina_attendance_purge_logs to postgres;

comment on table public.vina_attendance_purge_logs is
  '근태 2년 초과 자동 삭제 실행 로그 (기준일·건수·오류)';

/**
 * 삭제 대상 미리보기 (실제 삭제 없음)
 * returns: cutoff_date, candidate_count, skipped_null_or_invalid_count, keep_from_date
 */
create or replace function public.vina_preview_attendance_purge()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff date := (current_date - interval '2 years')::date;
  v_candidates integer := 0;
  v_skipped integer := 0;
  v_min_date date;
  v_max_date date;
begin
  -- attendance_date is NOT NULL; null 건수는 방어적으로 집계만 함 (삭제 대상에서 제외)
  select count(*)::integer
    into v_skipped
  from public.vina_attendance
  where attendance_date is null;

  select count(*)::integer,
         min(attendance_date),
         max(attendance_date)
    into v_candidates, v_min_date, v_max_date
  from public.vina_attendance
  where attendance_date is not null
    and attendance_date < v_cutoff;

  return jsonb_build_object(
    'as_of_date', current_date,
    'cutoff_date', v_cutoff,
    'keep_from_date', v_cutoff,
    'delete_until_date', (v_cutoff - 1),
    'candidate_count', v_candidates,
    'skipped_null_or_invalid_count', v_skipped,
    'candidate_min_date', v_min_date,
    'candidate_max_date', v_max_date,
    'rule', 'attendance_date < current_date - interval ''2 years'''
  );
end;
$$;

/**
 * 2년 초과 근태 행 삭제. p_dry_run=true 이면 삭제하지 않고 로그만 남김.
 */
create or replace function public.vina_purge_old_attendance(
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff date := (current_date - interval '2 years')::date;
  v_candidates integer := 0;
  v_deleted integer := 0;
  v_skipped integer := 0;
  v_min_date date;
  v_max_date date;
  v_log_id uuid;
  v_result jsonb;
  v_started_at timestamptz := clock_timestamp();
begin
  select count(*)::integer
    into v_skipped
  from public.vina_attendance
  where attendance_date is null;

  select count(*)::integer,
         min(attendance_date),
         max(attendance_date)
    into v_candidates, v_min_date, v_max_date
  from public.vina_attendance
  where attendance_date is not null
    and attendance_date < v_cutoff;

  if p_dry_run then
    insert into public.vina_attendance_purge_logs (
      cutoff_date,
      candidate_count,
      deleted_count,
      skipped_null_or_invalid_count,
      dry_run,
      status,
      details
    ) values (
      v_cutoff,
      v_candidates,
      0,
      v_skipped,
      true,
      'dry_run',
      jsonb_build_object(
        'as_of_date', current_date,
        'keep_from_date', v_cutoff,
        'delete_until_date', (v_cutoff - 1),
        'candidate_min_date', v_min_date,
        'candidate_max_date', v_max_date,
        'duration_ms', round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)
      )
    )
    returning id into v_log_id;

    v_result := jsonb_build_object(
      'ok', true,
      'dry_run', true,
      'log_id', v_log_id,
      'as_of_date', current_date,
      'cutoff_date', v_cutoff,
      'keep_from_date', v_cutoff,
      'delete_until_date', (v_cutoff - 1),
      'candidate_count', v_candidates,
      'deleted_count', 0,
      'skipped_null_or_invalid_count', v_skipped,
      'ran_at', now()
    );
    return v_result;
  end if;

  begin
    delete from public.vina_attendance
    where attendance_date is not null
      and attendance_date < v_cutoff;

    get diagnostics v_deleted = row_count;

    insert into public.vina_attendance_purge_logs (
      cutoff_date,
      candidate_count,
      deleted_count,
      skipped_null_or_invalid_count,
      dry_run,
      status,
      details
    ) values (
      v_cutoff,
      v_candidates,
      v_deleted,
      v_skipped,
      false,
      'success',
      jsonb_build_object(
        'as_of_date', current_date,
        'keep_from_date', v_cutoff,
        'delete_until_date', (v_cutoff - 1),
        'candidate_min_date', v_min_date,
        'candidate_max_date', v_max_date,
        'duration_ms', round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)
      )
    )
    returning id into v_log_id;

    v_result := jsonb_build_object(
      'ok', true,
      'dry_run', false,
      'log_id', v_log_id,
      'as_of_date', current_date,
      'cutoff_date', v_cutoff,
      'keep_from_date', v_cutoff,
      'delete_until_date', (v_cutoff - 1),
      'candidate_count', v_candidates,
      'deleted_count', v_deleted,
      'skipped_null_or_invalid_count', v_skipped,
      'ran_at', now()
    );
    return v_result;
  exception
    when others then
      insert into public.vina_attendance_purge_logs (
        cutoff_date,
        candidate_count,
        deleted_count,
        skipped_null_or_invalid_count,
        dry_run,
        status,
        error_message,
        details
      ) values (
        v_cutoff,
        v_candidates,
        0,
        v_skipped,
        false,
        'failed',
        sqlerrm,
        jsonb_build_object(
          'as_of_date', current_date,
          'sqlstate', sqlstate,
          'duration_ms', round(extract(epoch from (clock_timestamp() - v_started_at)) * 1000)
        )
      )
      returning id into v_log_id;

      return jsonb_build_object(
        'ok', false,
        'dry_run', false,
        'log_id', v_log_id,
        'as_of_date', current_date,
        'cutoff_date', v_cutoff,
        'candidate_count', v_candidates,
        'deleted_count', 0,
        'skipped_null_or_invalid_count', v_skipped,
        'error', sqlerrm,
        'sqlstate', sqlstate,
        'ran_at', now()
      );
  end;
end;
$$;

revoke all on function public.vina_preview_attendance_purge() from public, anon, authenticated;
revoke all on function public.vina_purge_old_attendance(boolean) from public, anon, authenticated;
grant execute on function public.vina_preview_attendance_purge() to service_role, postgres;
grant execute on function public.vina_purge_old_attendance(boolean) to service_role, postgres;

comment on function public.vina_preview_attendance_purge() is
  '근태 2년 초과 삭제 대상 건수/기준일 미리보기 (삭제 없음)';
comment on function public.vina_purge_old_attendance(boolean) is
  '근태 attendance_date < current_date-2years 행 삭제. dry_run=true면 삭제 없이 로그만 기록';

-- 매일 00:10 KST (= 15:10 UTC) 자동 실행
do $$
begin
  perform cron.unschedule('vina-purge-old-attendance');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'vina-purge-old-attendance',
  '10 15 * * *',
  $$select public.vina_purge_old_attendance(false);$$
);
