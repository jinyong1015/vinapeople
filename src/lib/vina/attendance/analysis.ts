import { toPhotoPublicUrl } from '../photos';
import { createServiceClient } from '../supabase/server';

export const ATTENDANCE_ABSENCE_REASON_ILIKE = '%결근%';
export const ATTENDANCE_ANALYSIS_WORKPLACES = ['1공장', '2공장'] as const;

export type AttendanceAnalysisWorkplace =
  (typeof ATTENDANCE_ANALYSIS_WORKPLACES)[number];

export interface WorkplaceAbsenceStat {
  workplace: AttendanceAnalysisWorkplace;
  total: number;
  absent: number;
  present: number;
  absentRatio: number | null;
}

export interface FrequentAbsenteeRow {
  employeeNo: string;
  name: string;
  workplace: string;
  count: number;
  photoPath: string | null;
}

export interface AttendanceAnalysisResult {
  date: string;
  latestDate: string | null;
  factories: WorkplaceAbsenceStat[];
  topAbsentees: FrequentAbsenteeRow[];
  topAbsenteesMonths: number;
}

function toIsoDate(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function monthsAgoIso(months: number, from = new Date()): string {
  const d = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export async function fetchLatestAttendanceDate(): Promise<string | null> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('vina_attendance')
    .select('attendance_date')
    .order('attendance_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.attendance_date) return null;
  return toIsoDate(String(data.attendance_date));
}

async function countWorkingByWorkplace(
  workplace: string,
): Promise<number> {
  const client = createServiceClient();
  const { count, error } = await client
    .from('vina_employees')
    .select('id', { count: 'exact', head: true })
    .eq('workplace', workplace)
    .eq('employment_status', '근무중');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countAbsentByWorkplaces(
  date: string,
  workplaces: readonly string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>(workplaces.map((w) => [w, 0]));
  const client = createServiceClient();
  const { data: rows, error } = await client
    .from('vina_attendance')
    .select('employee_no')
    .eq('attendance_date', date)
    .ilike('reason', ATTENDANCE_ABSENCE_REASON_ILIKE);
  if (error) throw new Error(error.message);

  const uniqueNos = [
    ...new Set(
      (rows ?? [])
        .map((row) => String(row.employee_no ?? '').trim())
        .filter(Boolean),
    ),
  ];
  if (uniqueNos.length === 0) return result;

  const workplaceByNo = new Map<string, string>();
  const chunkSize = 200;
  for (let i = 0; i < uniqueNos.length; i += chunkSize) {
    const nos = uniqueNos.slice(i, i + chunkSize);
    const { data: employees, error: empError } = await client
      .from('vina_employees')
      .select('employee_no, workplace')
      .in('employee_no', nos);
    if (empError) throw new Error(empError.message);
    for (const row of employees ?? []) {
      const no = String(row.employee_no ?? '').trim();
      if (!no) continue;
      workplaceByNo.set(no, String(row.workplace ?? '').trim());
    }
  }

  for (const no of uniqueNos) {
    const workplace = workplaceByNo.get(no);
    if (!workplace || !result.has(workplace)) continue;
    result.set(workplace, (result.get(workplace) ?? 0) + 1);
  }
  return result;
}

async function fetchTopAbsentees(
  months: number,
  limit = 10,
): Promise<FrequentAbsenteeRow[]> {
  const client = createServiceClient();
  const fromDate = monthsAgoIso(months);
  const pageSize = 1000;
  let from = 0;
  const counts = new Map<string, number>();

  for (;;) {
    const { data, error } = await client
      .from('vina_attendance')
      .select('employee_no')
      .ilike('reason', ATTENDANCE_ABSENCE_REASON_ILIKE)
      .gte('attendance_date', fromDate)
      .order('employee_no', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      const no = String(row.employee_no ?? '').trim();
      if (!no) continue;
      counts.set(no, (counts.get(no) ?? 0) + 1);
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    .slice(0, limit);

  if (ranked.length === 0) return [];

  const nos = ranked.map(([no]) => no);
  const { data: employees, error: empError } = await client
    .from('vina_employees')
    .select('employee_no, name, workplace, photo_path')
    .in('employee_no', nos);
  if (empError) throw new Error(empError.message);

  const byNo = new Map(
    (employees ?? []).map((row) => [
      String(row.employee_no ?? '').trim(),
      {
        name: String(row.name ?? ''),
        workplace: String(row.workplace ?? ''),
        photoPath: toPhotoPublicUrl(row.photo_path as string | null),
      },
    ]),
  );

  return ranked.map(([employeeNo, count]) => {
    const emp = byNo.get(employeeNo);
    return {
      employeeNo,
      name: emp?.name || employeeNo,
      workplace: emp?.workplace || '-',
      count,
      photoPath: emp?.photoPath ?? null,
    };
  });
}

export async function getAttendanceAnalysis(
  dateInput?: string | null,
  options?: { topMonths?: number; topLimit?: number },
): Promise<AttendanceAnalysisResult> {
  const topMonths = options?.topMonths ?? 6;
  const topLimit = options?.topLimit ?? 10;
  const latestDate = await fetchLatestAttendanceDate();
  const date =
    (dateInput?.trim() || latestDate || new Date().toISOString().slice(0, 10)).slice(
      0,
      10,
    );

  const [totals, absentByWorkplace] = await Promise.all([
    Promise.all(
      ATTENDANCE_ANALYSIS_WORKPLACES.map(async (workplace) => ({
        workplace,
        total: await countWorkingByWorkplace(workplace),
      })),
    ),
    countAbsentByWorkplaces(date, ATTENDANCE_ANALYSIS_WORKPLACES),
  ]);

  const factories: WorkplaceAbsenceStat[] = totals.map(({ workplace, total }) => {
    const absent = absentByWorkplace.get(workplace) ?? 0;
    const present = Math.max(0, total - absent);
    return {
      workplace,
      total,
      absent,
      present,
      absentRatio: total > 0 ? absent / total : null,
    };
  });

  const topAbsentees = await fetchTopAbsentees(topMonths, topLimit);

  return {
    date,
    latestDate,
    factories,
    topAbsentees,
    topAbsenteesMonths: topMonths,
  };
}
