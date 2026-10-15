import { requireAuth } from '@/lib/vina/auth';
import { buildActiveDatasetFromSupabase } from '@/lib/vina/supabase/employeesApi';
import { isSupabaseDataSource } from '@/lib/vina/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  if (!isSupabaseDataSource()) {
    return NextResponse.json(
      { message: 'Supabase 데이터 소스가 아닙니다. NEXT_PUBLIC_VINA_DATA_SOURCE=supabase 를 설정하세요.' },
      { status: 400 },
    );
  }

  try {
    const dataset = await buildActiveDatasetFromSupabase();
    return NextResponse.json({ dataset });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '인원 목록을 불러오지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
