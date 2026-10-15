import fs from 'node:fs';
import { diffAttendance } from '../src/lib/vina/attendance/diff';
import { parseAttendanceWorkbook } from '../src/lib/vina/attendance/parser';

async function main() {
  const buf = fs.readFileSync('C:/Users/PC/Downloads/VN 근태자료.xlsx');
  const parsed = await parseAttendanceWorkbook(buf);
  console.log(
    'schema',
    parsed.schemaOk,
    'header',
    parsed.headerRow,
    'candidates',
    parsed.candidates.length,
  );
  const employeesByNo = new Map(
    parsed.candidates
      .filter((c) => c.employeeNo.trim())
      .map((c) => [
        c.employeeNo.trim(),
        {
          employeeNo: c.employeeNo.trim(),
          name: c.name,
          employmentStatus: '근무중',
          resignDate: null as string | null,
        },
      ]),
  );
  const preview = diffAttendance(parsed.candidates, [], employeesByNo);
  console.log('counts', preview.counts);
  console.log('applyRows', preview.applyRows.length);
  console.log('sample apply', preview.applyRows[0]);
  console.log('error sample', preview.errorRows.slice(0, 2));
  console.log(
    'NV628 same day',
    preview.applyRows.filter(
      (r) => r.employee_no === 'NV628' && r.attendance_date === '2026-07-31',
    ),
  );

  // second pass unchanged
  const existing = preview.applyRows.map((r, i) => ({
    id: `id-${i}`,
    employeeId: null,
    employeeNo: r.employee_no,
    attendanceDate: r.attendance_date,
    nameSnapshot: r.name_snapshot,
    departmentSnapshot: r.department_snapshot,
    shift: r.shift,
    reason: r.reason,
    remarks: r.remarks,
    personCount: r.person_count ? Number(r.person_count) : null,
    monthValue: r.month_value ? Number(r.month_value) : null,
    dayValue: r.day_value ? Number(r.day_value) : null,
    noValue: Number(r.no_value || 0),
    createdAt: '',
    updatedAt: '',
    lastUploadId: null,
  }));
  const again = diffAttendance(parsed.candidates, existing, employeesByNo);
  console.log('reupload counts', again.counts);

  // remarks change
  const changedExisting = existing.map((e, i) =>
    i === 0 ? { ...e, remarks: '이전 비고' } : e,
  );
  const changed = diffAttendance(parsed.candidates, changedExisting, employeesByNo);
  console.log('remarks-change counts', changed.counts);
  console.log('changed sample', changed.changedRows[0]?.changes);

  // name mismatch → review, not apply
  const mismatchMap = new Map(employeesByNo);
  const firstNo = [...mismatchMap.keys()][0];
  if (firstNo) {
    mismatchMap.set(firstNo, {
      ...mismatchMap.get(firstNo)!,
      name: '다른이름',
    });
  }
  const mismatch = diffAttendance(parsed.candidates, [], mismatchMap);
  console.log('name-mismatch review', mismatch.counts.review, 'apply', mismatch.applyRows.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
