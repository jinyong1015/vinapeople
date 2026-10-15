import { requireAdmin } from '@/lib/vina/auth';
import { diffAttendance } from '@/lib/vina/attendance/diff';
import {
  fetchAttendanceForDiff,
  fetchEmployeeMatchMap,
} from '@/lib/vina/attendance/db';
import { parseAttendanceWorkbook } from '@/lib/vina/attendance/parser';
import {
  createServiceClient,
  isSupabaseDataSource,
} from '@/lib/vina/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * 최종 반영 성공 시에만 DB 저장.
 * 미리보기(/preview)는 읽기만 하며 어떤 테이블에도 insert 하지 않는다.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!isSupabaseDataSource()) {
    return NextResponse.json(
      { message: 'Supabase 데이터 소스가 아닙니다.' },
      { status: 400 },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: '반영할 엑셀 파일이 필요합니다. 미리보기를 다시 실행하세요.' },
        { status: 400 },
      );
    }

    const fileName =
      String(form.get('fileName') ?? '').trim() || file.name || 'attendance.xlsx';
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseAttendanceWorkbook(buffer);
    if (!parsed.schemaOk) {
      return NextResponse.json(
        { message: parsed.message || '엑셀 형식을 인식하지 못했습니다.' },
        { status: 400 },
      );
    }

    const employeesByNo = await fetchEmployeeMatchMap();
    const validCandidates = parsed.candidates.filter(
      (c) => c.attendanceDate && c.employeeNo.trim(),
    );
    const existing = await fetchAttendanceForDiff(
      validCandidates.map((c) => c.employeeNo.trim()),
      validCandidates.map((c) => c.attendanceDate!),
    );
    const preview = diffAttendance(
      parsed.candidates,
      existing,
      employeesByNo,
    );

    if (!preview.canApply || preview.applyRows.length === 0) {
      return NextResponse.json(
        {
          message:
            'DB에 저장할 정상 근태 행이 없습니다. (오류·미매칭만 있는 경우 반영되지 않습니다.)',
          counts: preview.counts,
        },
        { status: 400 },
      );
    }

    const client = createServiceClient();
    const { data: rpcResult, error: rpcError } = await client.rpc(
      'vina_apply_attendance_upload',
      {
        p_file_name: fileName,
        p_uploaded_by: 'admin',
        p_total_count: preview.counts.total,
        p_error_count: preview.counts.error,
        p_unmatched_count: preview.counts.unmatched,
        p_rows: preview.applyRows,
      },
    );

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    const result = (rpcResult ?? {}) as {
      uploadId?: string;
      newCount?: number;
      changedCount?: number;
      unchangedCount?: number;
    };

    return NextResponse.json({
      ok: true,
      uploadId: result.uploadId ?? null,
      result: rpcResult,
      counts: {
        ...preview.counts,
        new: result.newCount ?? preview.counts.new,
        changed: result.changedCount ?? preview.counts.changed,
        unchanged: result.unchangedCount ?? preview.counts.unchanged,
      },
      savedRowCount: preview.applyRows.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '근태 반영에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
