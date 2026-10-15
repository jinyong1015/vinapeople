import { requireAuth } from '@/lib/vina/auth';
import {
  createServiceClient,
  isSupabaseDataSource,
} from '@/lib/vina/supabase/server';
import { fieldLabel } from '@/lib/vina/supabase/mappers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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
      .from('vina_employee_history')
      .select(
        'id, employee_id, employee_no, field_name, old_value, new_value, changed_at, change_source, upload_id, changed_by',
      )
      .eq('employee_id', id)
      .order('changed_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const history = (data ?? []).map((row) => ({
      id: row.id as string,
      employeeId: row.employee_id as string,
      employeeNo: row.employee_no as string,
      fieldName: row.field_name as string,
      fieldLabel:
        row.field_name === '_created'
          ? '신규 등록'
          : fieldLabel(row.field_name as string),
      oldValue: (row.old_value as string | null) ?? '',
      newValue: (row.new_value as string | null) ?? '',
      changedAt: row.changed_at as string,
      changeSource: row.change_source as string,
      uploadId: (row.upload_id as string | null) ?? null,
      changedBy: (row.changed_by as string | null) ?? null,
    }));

    return NextResponse.json({ history });
  } catch (err) {
    const message = err instanceof Error ? err.message : '이력 조회 실패';
    return NextResponse.json({ message }, { status: 500 });
  }
}
