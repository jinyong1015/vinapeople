import { requireAuth } from '@/lib/vina/auth';
import { listAttendance } from '@/lib/vina/attendance/db';
import { isSupabaseDataSource } from '@/lib/vina/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  if (!isSupabaseDataSource()) {
    return NextResponse.json(
      { message: 'Supabase 데이터 소스가 아닙니다.' },
      { status: 400 },
    );
  }

  try {
    const url = new URL(request.url);
    const departments = url.searchParams.getAll('department').filter(Boolean);
    const shifts = url.searchParams.getAll('shift').filter(Boolean);
    const sortParam = url.searchParams.get('sort');
    const sort =
      sortParam === 'employee_no' ||
      sortParam === 'reason' ||
      sortParam === 'name_snapshot' ||
      sortParam === 'attendance_date'
        ? sortParam
        : 'attendance_date';

    const result = await listAttendance({
      from: url.searchParams.get('from') ?? undefined,
      to: url.searchParams.get('to') ?? undefined,
      employeeNo: url.searchParams.get('employeeNo') ?? undefined,
      employeeNoExact: url.searchParams.get('exact') === '1',
      name: url.searchParams.get('name') ?? undefined,
      departments: departments.length ? departments : undefined,
      shifts: shifts.length ? shifts : undefined,
      reason: url.searchParams.get('reason') ?? undefined,
      search: url.searchParams.get('q') ?? undefined,
      page: Number(url.searchParams.get('page') ?? '1') || 1,
      pageSize: Number(url.searchParams.get('pageSize') ?? '20') || 20,
      sort,
      dir: (url.searchParams.get('dir') as 'asc' | 'desc' | null) ?? 'asc',
    });
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '근태 목록 조회에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
