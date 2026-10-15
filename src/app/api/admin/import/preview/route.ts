import { requireAdmin } from '@/lib/vina/auth';
import { diffAgainstExisting } from '@/lib/vina/importDiff';
import { fetchAllEmployeeRows } from '@/lib/vina/supabase/employeesApi';
import { isSupabaseDataSource } from '@/lib/vina/supabase/server';
import type { ImportCandidate, ValidationIssue } from '@/lib/vina/types';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface PreviewBody {
  fileName?: string;
  asOfDate?: string;
  candidates?: ImportCandidate[];
  validationIssues?: ValidationIssue[];
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

  let body: PreviewBody;
  try {
    body = (await request.json()) as PreviewBody;
  } catch {
    return NextResponse.json({ message: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const asOfDate = body.asOfDate?.trim();
  const candidates = body.candidates ?? [];

  if (!asOfDate) {
    return NextResponse.json({ message: '기준일이 필요합니다.' }, { status: 400 });
  }
  if (candidates.length === 0) {
    return NextResponse.json({ message: '비교할 행이 없습니다.' }, { status: 400 });
  }

  try {
    const existing = await fetchAllEmployeeRows(true);
    const diff = diffAgainstExisting(candidates, existing, asOfDate, {
      uploadedBy: 'admin',
      validationIssues: body.validationIssues,
    });

    return NextResponse.json({
      counts: diff.counts,
      newRows: diff.newRows.map((r) => ({
        excelRow: r.excelRow,
        employeeNo: r.employeeNo,
        name: r.name,
      })),
      changedRows: diff.changedRows.map((r) => ({
        excelRow: r.excelRow,
        employeeNo: r.employeeNo,
        name: r.name,
        employeeId: r.employeeId,
        changes: r.changes,
      })),
      errorRows: diff.errorRows,
      missingRows: diff.missingRows,
      applyPayload: diff.applyPayload,
      canApply:
        diff.counts.error === 0 &&
        (diff.counts.new > 0 || diff.counts.changed > 0 || diff.counts.unchanged > 0),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '업로드 미리보기에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
