import { requireAdmin } from '@/lib/vina/auth';
import {
  createServiceClient,
  isSupabaseDataSource,
} from '@/lib/vina/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const guard = await requireAdmin();
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
    const { data, error } = await client.rpc('vina_rollback_employee_upload', {
      p_upload_id: id,
      p_actor: 'admin',
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, result: data });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '업로드 복구에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
