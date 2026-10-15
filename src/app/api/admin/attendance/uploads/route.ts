import { requireAdmin } from '@/lib/vina/auth';
import {
  createServiceClient,
  isSupabaseDataSource,
} from '@/lib/vina/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!isSupabaseDataSource()) {
    return NextResponse.json(
      { message: 'Supabase 데이터 소스가 아닙니다.' },
      { status: 400 },
    );
  }

  try {
    const client = createServiceClient();
    const { data, error } = await client
      .from('vina_attendance_uploads')
      .select(
        'id, file_name, uploaded_at, uploaded_by, total_count, new_count, changed_count, unchanged_count, error_count, unmatched_count, status',
      )
      .eq('status', 'applied')
      .order('uploaded_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return NextResponse.json({
      uploads: (data ?? []).map((row) => ({
        id: row.id as string,
        fileName: row.file_name as string,
        uploadedAt: row.uploaded_at as string,
        uploadedBy: (row.uploaded_by as string | null) ?? null,
        totalCount: row.total_count as number,
        newCount: row.new_count as number,
        changedCount: row.changed_count as number,
        unchangedCount: row.unchanged_count as number,
        errorCount: row.error_count as number,
        unmatchedCount: row.unmatched_count as number,
        status: row.status as string,
      })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '근태 업로드 이력 조회에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
