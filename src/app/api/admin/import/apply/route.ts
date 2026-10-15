import { requireAdmin } from '@/lib/vina/auth';
import type { ApplyUploadPayload } from '@/lib/vina/importDiff';
import {
  createServiceClient,
  isSupabaseDataSource,
} from '@/lib/vina/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface ApplyBody {
  fileName?: string;
  asOfDate?: string;
  applyPayload?: ApplyUploadPayload;
  counts?: {
    total?: number;
    new?: number;
    changed?: number;
    unchanged?: number;
    error?: number;
    missing?: number;
  };
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!isSupabaseDataSource()) {
    return NextResponse.json(
      { message: 'Supabase 데이터 소스가 아닙니다.' },
      { status: 400 },
    );
  }

  let body: ApplyBody;
  try {
    body = (await request.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ message: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const fileName = body.fileName?.trim() || 'upload.xlsx';
  const asOfDate = body.asOfDate?.trim() || body.applyPayload?.asOfDate?.trim();
  const applyPayload = body.applyPayload;
  const counts = body.counts;

  if (!asOfDate) {
    return NextResponse.json({ message: '기준일이 필요합니다.' }, { status: 400 });
  }
  if (!applyPayload) {
    return NextResponse.json(
      { message: '반영 페이로드가 없습니다. 미리보기를 다시 실행하세요.' },
      { status: 400 },
    );
  }

  const errorCount = counts?.error ?? applyPayload.errorCount ?? 0;
  if (errorCount > 0) {
    return NextResponse.json(
      { message: '오류 행이 있어 반영할 수 없습니다.' },
      { status: 400 },
    );
  }

  const client = createServiceClient();
  let uploadId: string | null = null;

  try {
    const { data: upload, error: insertError } = await client
      .from('vina_employee_uploads')
      .insert({
        file_name: fileName,
        as_of_date: asOfDate,
        uploaded_by: 'admin',
        total_count: counts?.total ?? applyPayload.totalCount ?? 0,
        new_count: counts?.new ?? applyPayload.newCount ?? 0,
        changed_count: counts?.changed ?? applyPayload.changedCount ?? 0,
        unchanged_count: counts?.unchanged ?? applyPayload.unchangedCount ?? 0,
        error_count: errorCount,
        missing_count: counts?.missing ?? applyPayload.missingCount ?? 0,
        status: 'draft',
        payload: { applyPayload },
      })
      .select('id')
      .single();

    if (insertError) throw new Error(insertError.message);
    uploadId = upload.id as string;

    const { data: rpcResult, error: rpcError } = await client.rpc(
      'vina_apply_employee_upload',
      {
        p_upload_id: uploadId,
        p_payload: applyPayload,
      },
    );

    if (rpcError) {
      await client.from('vina_employee_uploads').delete().eq('id', uploadId);
      throw new Error(rpcError.message);
    }

    return NextResponse.json({ ok: true, uploadId, result: rpcResult });
  } catch (err) {
    if (uploadId) {
      await client
        .from('vina_employee_uploads')
        .delete()
        .eq('id', uploadId)
        .neq('status', 'applied');
    }
    const message =
      err instanceof Error ? err.message : '업로드 반영에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
