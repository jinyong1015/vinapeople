import { requireAuth } from '@/lib/vina/auth';
import {
  createServiceClient,
  isSupabaseDataSource,
} from '@/lib/vina/supabase/server';
import { fieldLabel } from '@/lib/vina/supabase/mappers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function mapHistoryRow(row: Record<string, unknown>) {
  const fieldName = row.field_name as string;
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    employeeNo: row.employee_no as string,
    fieldName,
    fieldLabel:
      fieldName === '_created' ? '신규 등록' : fieldLabel(fieldName),
    oldValue: (row.old_value as string | null) ?? '',
    newValue: (row.new_value as string | null) ?? '',
    changedAt: row.changed_at as string,
    changeSource: row.change_source as string,
    uploadId: (row.upload_id as string | null) ?? null,
    changedBy: (row.changed_by as string | null) ?? null,
  };
}

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (!guard.ok) return guard.response;

  if (!isSupabaseDataSource()) {
    return NextResponse.json(
      { message: 'Supabase 데이터 소스에서만 변경 이력을 조회할 수 있습니다.' },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get('limit') ?? '100');
  const offsetRaw = Number(searchParams.get('offset') ?? '0');
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), 200)
    : 100;
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(0, Math.floor(offsetRaw))
    : 0;
  const employeeNo = searchParams.get('employeeNo')?.trim() ?? '';

  try {
    const client = createServiceClient();
    let query = client
      .from('vina_employee_history')
      .select(
        'id, employee_id, employee_no, field_name, old_value, new_value, changed_at, change_source, upload_id, changed_by',
        { count: 'exact' },
      )
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (employeeNo) {
      query = query.eq('employee_no', employeeNo);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const history = (data ?? []).map((row) =>
      mapHistoryRow(row as Record<string, unknown>),
    );

    // 성명 보강
    const ids = [...new Set(history.map((h) => h.employeeId).filter(Boolean))];
    const nameById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: employees } = await client
        .from('vina_employees')
        .select('id, name')
        .in('id', ids);
      for (const emp of employees ?? []) {
        nameById.set(emp.id as string, (emp.name as string) || '');
      }
    }

    return NextResponse.json({
      history: history.map((h) => ({
        ...h,
        name: nameById.get(h.employeeId) ?? '',
      })),
      total: count ?? history.length,
      limit,
      offset,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '변경 이력 조회에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
