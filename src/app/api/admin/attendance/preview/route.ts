import { requireAdmin } from '@/lib/vina/auth';
import { diffAttendance } from '@/lib/vina/attendance/diff';
import {
  fetchAttendanceForDiff,
  fetchEmployeeMatchMap,
} from '@/lib/vina/attendance/db';
import { parseAttendanceWorkbook } from '@/lib/vina/attendance/parser';
import { isSupabaseDataSource } from '@/lib/vina/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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
        { message: '엑셀 파일이 필요합니다.' },
        { status: 400 },
      );
    }

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

    return NextResponse.json({
      fileName: file.name || 'attendance.xlsx',
      sheetName: parsed.sheetName,
      headerRow: parsed.headerRow,
      ...preview,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : '근태 미리보기에 실패했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
