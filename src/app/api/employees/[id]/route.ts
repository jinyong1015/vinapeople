import { requireAuth } from '@/lib/vina/auth';
import {
  createServiceClient,
  isSupabaseDataSource,
} from '@/lib/vina/supabase/server';
import { type VinaEmployeeRow, rowToPersonnel } from '@/lib/vina/supabase/mappers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const EMPLOYEE_SELECT = `
  id, employee_no, source_no, name, workplace, employment_status,
  category, category1, position, process, department, category3, category4,
  gender_source, gender_label_source, gender,
  birth_date, join_date, resign_date,
  age_years, tenure_years, tenure_months_remainder, tenure_total_months, tenure_total_days,
  source_tenure_years, source_tenure_months, source_tenure_days,
  photo_path, as_of_date, updated_at, updated_by, last_upload_id
`;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  if (!isSupabaseDataSource()) {
    return NextResponse.json(
      { message: 'Supabase 데이터 소스가 아닙니다.' },
      { status: 400 },
    );
  }

  const { id } = await context.params;
  try {
    const client = createServiceClient();
    const { data, error } = await client
      .from('vina_employees')
      .select(EMPLOYEE_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json({ message: '인원을 찾을 수 없습니다.' }, { status: 404 });
    }
    return NextResponse.json({ employee: rowToPersonnel(data as VinaEmployeeRow) });
  } catch (err) {
    const message = err instanceof Error ? err.message : '조회 실패';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/** 인원 기본정보 직접 수정은 제공하지 않습니다. 사진은 /photo API를 사용하세요. */
export async function PATCH() {
  return NextResponse.json(
    {
      message:
        '인원 기본정보 수정은 지원하지 않습니다. 사진 등록·변경·삭제는 /api/employees/[id]/photo 를 사용하세요.',
    },
    { status: 405 },
  );
}
