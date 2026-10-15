import { requireAuth } from '@/lib/vina/auth';
import { getAttendanceAnalysis } from '@/lib/vina/attendance/analysis';
import { isSupabaseDataSource } from '@/lib/vina/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  if (!isSupabaseDataSource()) {
    return NextResponse.json(
      { message: 'Supabase 데이터 소스에서만 근태 분석을 사용할 수 있습니다.' },
      { status: 400 },
    );
  }

  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const result = await getAttendanceAnalysis(date);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '근태 분석 조회에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
