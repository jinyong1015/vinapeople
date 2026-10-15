import type {
  AttendanceApplyRow,
  AttendanceCandidate,
  AttendanceDiffCounts,
  AttendanceEmployeeRef,
  AttendanceFieldChange,
  AttendancePreviewResult,
  AttendanceRecord,
  AttendanceReviewRow,
} from './types';

function norm(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** 사번·이름 비교용: 앞뒤 공백 제거, 연속 공백 축약 (사번/이름 자체는 변경하지 않음) */
export function normalizeMatchName(value: string | null | undefined): string {
  return norm(value).replace(/\s+/g, ' ');
}

function numKey(value: number | null | undefined): number {
  return value === null || value === undefined || !Number.isFinite(value)
    ? 0
    : Math.trunc(value);
}

function recordKey(date: string, employeeNo: string, noValue: number): string {
  return `${date}|${employeeNo}|${noValue}`;
}

function compareFields(
  existing: AttendanceRecord,
  incoming: {
    name: string;
    department: string;
    shift: string;
    reason: string;
    remarks: string;
    personCount: number | null;
    monthValue: number | null;
    dayValue: number | null;
  },
): AttendanceFieldChange[] {
  const pairs: Array<{
    field: string;
    label: string;
    oldValue: string;
    newValue: string;
  }> = [
    {
      field: 'reason',
      label: '사유',
      oldValue: existing.reason,
      newValue: incoming.reason,
    },
    {
      field: 'remarks',
      label: '비고',
      oldValue: existing.remarks,
      newValue: incoming.remarks,
    },
    {
      field: 'name_snapshot',
      label: '이름(근태기록)',
      oldValue: existing.nameSnapshot,
      newValue: incoming.name,
    },
    {
      field: 'department_snapshot',
      label: '부서',
      oldValue: existing.departmentSnapshot,
      newValue: incoming.department,
    },
    {
      field: 'shift',
      label: '주/야',
      oldValue: existing.shift,
      newValue: incoming.shift,
    },
    {
      field: 'person_count',
      label: '인원수',
      oldValue:
        existing.personCount === null || existing.personCount === undefined
          ? ''
          : String(existing.personCount),
      newValue:
        incoming.personCount === null || incoming.personCount === undefined
          ? ''
          : String(incoming.personCount),
    },
    {
      field: 'month_value',
      label: 'M',
      oldValue:
        existing.monthValue === null || existing.monthValue === undefined
          ? ''
          : String(existing.monthValue),
      newValue:
        incoming.monthValue === null || incoming.monthValue === undefined
          ? ''
          : String(incoming.monthValue),
    },
    {
      field: 'day_value',
      label: 'D',
      oldValue:
        existing.dayValue === null || existing.dayValue === undefined
          ? ''
          : String(existing.dayValue),
      newValue:
        incoming.dayValue === null || incoming.dayValue === undefined
          ? ''
          : String(incoming.dayValue),
    },
  ];

  return pairs.filter(
    (p) => norm(p.oldValue) !== norm(p.newValue),
  ) as AttendanceFieldChange[];
}

function toApplyRow(c: AttendanceCandidate & { attendanceDate: string }): AttendanceApplyRow {
  return {
    employee_no: c.employeeNo.trim(),
    attendance_date: c.attendanceDate,
    name_snapshot: c.name,
    department_snapshot: c.department,
    shift: c.shift,
    reason: c.reason,
    remarks: c.remarks,
    person_count:
      c.personCount === null || c.personCount === undefined
        ? ''
        : String(c.personCount),
    month_value:
      c.monthValue === null || c.monthValue === undefined
        ? ''
        : String(c.monthValue),
    day_value:
      c.dayValue === null || c.dayValue === undefined ? '' : String(c.dayValue),
    no_value: String(numKey(c.noValue)),
  };
}

function rosterHint(ref: AttendanceEmployeeRef | undefined): string {
  if (!ref) return '';
  const status = norm(ref.employmentStatus) || '상태미상';
  if (ref.resignDate) return `${status} · 퇴사일 ${ref.resignDate}`;
  return status;
}

/**
 * 인원 연결 규칙:
 * - 사번+이름 일치 → 정상 연결(반영 대상)
 * - 사번 일치·이름 불일치 → 확인 대상(미반영, 인원 이름 자동 변경 없음)
 * - 사번 없음 → 확인/미매칭(과거 퇴사자 여부 확인 안내, 자동 생성 없음)
 * 중복 키: 근태일 + 사번 + NO
 */
export function diffAttendance(
  candidates: AttendanceCandidate[],
  existing: AttendanceRecord[],
  employeesByNo: Map<string, AttendanceEmployeeRef>,
): AttendancePreviewResult {
  const existingByKey = new Map<string, AttendanceRecord>();
  for (const row of existing) {
    existingByKey.set(
      recordKey(row.attendanceDate, row.employeeNo.trim(), row.noValue),
      row,
    );
  }

  const fileKeyLast = new Map<string, AttendanceCandidate>();
  const errorRows: AttendancePreviewResult['errorRows'] = [];
  const unmatchedRows: AttendanceReviewRow[] = [];
  const reviewRows: AttendanceReviewRow[] = [];

  for (const row of candidates) {
    const employeeNo = row.employeeNo.trim();
    const date = row.attendanceDate?.trim() || null;

    if (!date) {
      errorRows.push({
        excelRow: row.excelRow,
        employeeNo,
        name: row.name,
        message: '근태 발생일(day2)이 없거나 날짜 형식이 올바르지 않습니다.',
      });
      continue;
    }
    if (!employeeNo) {
      errorRows.push({
        excelRow: row.excelRow,
        employeeNo: '',
        name: row.name,
        message:
          '사번이 없습니다. (부서 단위 집계 행 등은 개인 근태로 저장하지 않습니다.)',
      });
      continue;
    }

    const roster = employeesByNo.get(employeeNo);
    if (!roster) {
      unmatchedRows.push({
        excelRow: row.excelRow,
        attendanceDate: date,
        employeeNo,
        attendanceName: row.name,
        rosterName: '',
        employmentStatus: '',
        resignDate: null,
        reason: row.reason,
        kind: 'not_found',
        message:
          '인원현황에 없는 사번입니다. 과거 퇴사자 여부를 확인하세요. 확인되지 않은 사번은 자동으로 새 인원을 만들지 않습니다.',
      });
      continue;
    }

    const attendanceName = normalizeMatchName(row.name);
    const rosterName = normalizeMatchName(roster.name);
    if (!attendanceName || attendanceName !== rosterName) {
      reviewRows.push({
        excelRow: row.excelRow,
        attendanceDate: date,
        employeeNo,
        attendanceName: row.name,
        rosterName: roster.name,
        employmentStatus: roster.employmentStatus,
        resignDate: roster.resignDate,
        reason: row.reason,
        kind: 'name_mismatch',
        message: `사번은 일치하나 이름이 다릅니다. 인원정보「${roster.name || '(빈 이름)'}」≠ 근태「${row.name || '(빈 이름)'}」(${rosterHint(roster)}). 인원정보 이름은 변경하지 않으며 자동 반영하지 않습니다.`,
      });
      continue;
    }

    const key = recordKey(date, employeeNo, numKey(row.noValue));
    fileKeyLast.set(key, { ...row, employeeNo, attendanceDate: date });
  }

  const newRows: AttendancePreviewResult['newRows'] = [];
  const changedRows: AttendancePreviewResult['changedRows'] = [];
  const applyRows: AttendanceApplyRow[] = [];
  let unchanged = 0;

  for (const row of fileKeyLast.values()) {
    const date = row.attendanceDate!;
    const noValue = numKey(row.noValue);
    const key = recordKey(date, row.employeeNo, noValue);
    const prev = existingByKey.get(key);
    applyRows.push(toApplyRow({ ...row, attendanceDate: date }));

    if (!prev) {
      newRows.push({
        excelRow: row.excelRow,
        attendanceDate: date,
        employeeNo: row.employeeNo,
        name: row.name,
        reason: row.reason,
        noValue,
      });
      continue;
    }

    const changes = compareFields(prev, row);
    if (changes.length === 0) {
      unchanged += 1;
    } else {
      changedRows.push({
        excelRow: row.excelRow,
        attendanceDate: date,
        employeeNo: row.employeeNo,
        name: row.name,
        reason: row.reason,
        noValue,
        changes,
      });
    }
  }

  const counts: AttendanceDiffCounts = {
    total: candidates.length,
    new: newRows.length,
    changed: changedRows.length,
    unchanged,
    error: errorRows.length,
    unmatched: unmatchedRows.length,
    review: reviewRows.length,
  };

  return {
    counts,
    newRows,
    changedRows,
    errorRows,
    unmatchedRows,
    reviewRows,
    applyRows,
    canApply: applyRows.length > 0,
  };
}
