import { toPhotoPublicUrl } from '../photos';
import { createServiceClient } from '../supabase/server';
import type { AttendanceEmployeeRef, AttendanceRecord } from './types';
import { dateToIso } from '../supabase/mappers';

export interface AttendanceListQuery {
  from?: string;
  to?: string;
  employeeNo?: string;
  /** true면 사번 완전 일치 (상세 페이지용) */
  employeeNoExact?: boolean;
  name?: string;
  department?: string;
  /** 공정(부서 스냅샷) 다중 필터 */
  departments?: string[];
  shift?: string;
  /** 주/야 다중 필터 */
  shifts?: string[];
  reason?: string;
  /** 성명·사번·사유·비고 통합 검색 */
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: 'attendance_date' | 'employee_no' | 'reason' | 'name_snapshot';
  dir?: 'asc' | 'desc';
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/** PostgREST or() 절용 ilike 조건 (쉼표·따옴표 안전) */
function orIlike(column: string, value: string): string {
  const escaped = escapeIlike(value).replace(/"/g, '');
  return `${column}.ilike."%${escaped}%"`;
}

function mapRow(row: Record<string, unknown>): AttendanceRecord {
  return {
    id: row.id as string,
    employeeId: (row.employee_id as string | null) ?? null,
    employeeNo: row.employee_no as string,
    attendanceDate: String(row.attendance_date).slice(0, 10),
    nameSnapshot: (row.name_snapshot as string) ?? '',
    departmentSnapshot: (row.department_snapshot as string) ?? '',
    shift: (row.shift as string) ?? '',
    reason: (row.reason as string) ?? '',
    remarks: (row.remarks as string) ?? '',
    personCount:
      row.person_count === null || row.person_count === undefined
        ? null
        : Number(row.person_count),
    monthValue:
      row.month_value === null || row.month_value === undefined
        ? null
        : Number(row.month_value),
    dayValue:
      row.day_value === null || row.day_value === undefined
        ? null
        : Number(row.day_value),
    noValue: Number(row.no_value ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    lastUploadId: (row.last_upload_id as string | null) ?? null,
  };
}

export async function fetchAttendanceForDiff(
  employeeNos: string[],
  dates: string[],
): Promise<AttendanceRecord[]> {
  if (employeeNos.length === 0 || dates.length === 0) return [];
  const client = createServiceClient();
  const uniqueNos = [...new Set(employeeNos)];
  const uniqueDates = [...new Set(dates)].sort();
  const dateFrom = uniqueDates[0];
  const dateTo = uniqueDates[uniqueDates.length - 1];
  const dateSet = new Set(uniqueDates);

  const out: AttendanceRecord[] = [];
  const chunkSize = 200;
  for (let i = 0; i < uniqueNos.length; i += chunkSize) {
    const nos = uniqueNos.slice(i, i + chunkSize);
    const { data, error } = await client
      .from('vina_attendance')
      .select('*')
      .in('employee_no', nos)
      .gte('attendance_date', dateFrom)
      .lte('attendance_date', dateTo);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const mapped = mapRow(row as Record<string, unknown>);
      if (dateSet.has(mapped.attendanceDate)) out.push(mapped);
    }
  }
  return out;
}

async function fetchPhotoPathsByEmployeeNos(
  employeeNos: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const unique = [...new Set(employeeNos.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return map;

  const client = createServiceClient();
  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const nos = unique.slice(i, i + chunkSize);
    const { data, error } = await client
      .from('vina_employees')
      .select('employee_no, photo_path')
      .in('employee_no', nos);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const no = String(row.employee_no ?? '').trim();
      if (!no) continue;
      map.set(no, toPhotoPublicUrl(row.photo_path as string | null));
    }
  }
  return map;
}

export async function listAttendance(query: AttendanceListQuery): Promise<{
  rows: AttendanceRecord[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const client = createServiceClient();
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const sort = query.sort ?? 'attendance_date';
  const ascending = (query.dir ?? 'asc') !== 'desc';

  let q = client
    .from('vina_attendance')
    .select('*', { count: 'exact' });

  if (query.from) q = q.gte('attendance_date', query.from);
  if (query.to) q = q.lte('attendance_date', query.to);
  if (query.employeeNo?.trim()) {
    const no = query.employeeNo.trim();
    q = query.employeeNoExact
      ? q.eq('employee_no', no)
      : q.ilike('employee_no', `%${escapeIlike(no)}%`);
  }
  if (query.name?.trim()) {
    q = q.ilike('name_snapshot', `%${escapeIlike(query.name.trim())}%`);
  }
  const departments =
    query.departments?.map((d) => d.trim()).filter(Boolean) ??
    (query.department?.trim() ? [query.department.trim()] : []);
  if (departments.length === 1) {
    q = q.ilike('department_snapshot', `%${escapeIlike(departments[0])}%`);
  } else if (departments.length > 1) {
    q = q.or(departments.map((d) => orIlike('department_snapshot', d)).join(','));
  }
  const shifts =
    query.shifts?.map((s) => s.trim()).filter(Boolean) ??
    (query.shift?.trim() ? [query.shift.trim()] : []);
  if (shifts.length === 1) {
    q = q.eq('shift', shifts[0]);
  } else if (shifts.length > 1) {
    q = q.in('shift', shifts);
  }
  if (query.reason?.trim()) {
    q = q.ilike('reason', `%${escapeIlike(query.reason.trim())}%`);
  }
  if (query.search?.trim()) {
    const t = query.search.trim();
    q = q.or(
      [
        orIlike('employee_no', t),
        orIlike('name_snapshot', t),
        orIlike('reason', t),
        orIlike('remarks', t),
      ].join(','),
    );
  }

  const sortColumn =
    sort === 'name_snapshot' ||
    sort === 'employee_no' ||
    sort === 'reason' ||
    sort === 'attendance_date'
      ? sort
      : 'attendance_date';

  const { data, error, count } = await q
    .order(sortColumn, { ascending })
    .order('employee_no', { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);

  const baseRows = (data ?? []).map((row) =>
    mapRow(row as Record<string, unknown>),
  );
  const photoByNo = await fetchPhotoPathsByEmployeeNos(
    baseRows.map((row) => row.employeeNo),
  );

  return {
    rows: baseRows.map((row) => ({
      ...row,
      photoPath: photoByNo.get(row.employeeNo.trim()) ?? null,
    })),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/** 근태 매칭용: 사번 → 이름·재직상태 (인원 이름은 근태로 변경하지 않음) */
export async function fetchEmployeeMatchMap(): Promise<
  Map<string, AttendanceEmployeeRef>
> {
  const client = createServiceClient();
  const pageSize = 1000;
  let from = 0;
  const map = new Map<string, AttendanceEmployeeRef>();
  for (;;) {
    const { data, error } = await client
      .from('vina_employees')
      .select('employee_no, name, employment_status, resign_date')
      .order('employee_no', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      const no = String(row.employee_no ?? '').trim();
      if (!no) continue;
      map.set(no, {
        employeeNo: no,
        name: String(row.name ?? ''),
        employmentStatus: String(row.employment_status ?? ''),
        resignDate: dateToIso(row.resign_date as string | null),
      });
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

/** @deprecated use fetchEmployeeMatchMap */
export async function fetchEmployeeNoSet(): Promise<Set<string>> {
  const map = await fetchEmployeeMatchMap();
  return new Set(map.keys());
}
