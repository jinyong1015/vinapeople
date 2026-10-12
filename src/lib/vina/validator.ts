import {
  GENDER_LABEL_TO_CODE,
  GENDER_SOURCE_TO_CODE,
  UNSPECIFIED_PROCESS,
  createStablePersonnelId,
  normalizeGenderFromSources,
  normalizeProcess,
} from './codes';
import {
  computeAgeYears,
  computeTenure,
  formatDateValue,
  isDateAfter,
  isDateBefore,
  parseCalendarDate,
} from './dates';
import type {
  GenderCode,
  ImportCandidate,
  ImportValidation,
  Personnel,
  ValidationIssue,
} from './types';

const REQUIRED_STRING_FIELDS: Array<{
  field: keyof ImportCandidate;
  label: string;
}> = [
  { field: 'employeeNo', label: '사번' },
  { field: 'name', label: '성명' },
  { field: 'workplace', label: '근무지' },
  { field: 'employmentStatus', label: '근무현황' },
  { field: 'position', label: '직급' },
];

function pushIssue(
  issues: ValidationIssue[],
  row: ImportCandidate,
  field: string,
  message: string,
  severity: ValidationIssue['severity'],
): void {
  issues.push({
    excelRow: row.excelRow,
    employeeNo: row.employeeNo,
    name: row.name,
    field,
    message,
    severity,
  });
}

export type SourceTenureRead = {
  value: number | null;
  isError: boolean;
};

function parseSourceTenure(value: unknown): SourceTenureRead {
  if (value === null || value === undefined || value === '') {
    return { value: null, isError: false };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { value, isError: false };
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return { value: null, isError: false };
    if (t === '#NUM!' || t.startsWith('#')) {
      return { value: null, isError: true };
    }
    const n = Number(t);
    return Number.isFinite(n)
      ? { value: n, isError: false }
      : { value: null, isError: false };
  }
  if (typeof value === 'object' && value !== null && 'error' in value) {
    return { value: null, isError: true };
  }
  return { value: null, isError: false };
}

function rowSeverity(issues: ValidationIssue[], excelRow: number): 'error' | 'warning' | 'normal' {
  const rowIssues = issues.filter((i) => i.excelRow === excelRow);
  if (rowIssues.some((i) => i.severity === 'error')) return 'error';
  if (rowIssues.some((i) => i.severity === 'warning')) return 'warning';
  return 'normal';
}

export function candidateToPersonnel(
  row: ImportCandidate,
  asOfDate: string,
  updatedAt: string,
): Personnel {
  const process = normalizeProcess(row.processRaw);
  const gender =
    normalizeGenderFromSources(row.genderSource, row.genderLabelSource) ??
    ('남자' as GenderCode);

  const birthDate = row.birthDate ?? formatDateValue(row.birthDateRaw);
  const joinDate = row.joinDate ?? formatDateValue(row.joinDateRaw);
  const resignDate = row.resignDate ?? formatDateValue(row.resignDateRaw);

  const ageYears = birthDate ? computeAgeYears(birthDate, asOfDate) : null;
  const tenure = joinDate ? computeTenure(joinDate, asOfDate) : null;

  return {
    sourceNo: row.sourceNo,
    id: createStablePersonnelId(row.employeeNo),
    employeeNo: row.employeeNo.trim(),
    name: row.name.trim(),
    workplace: row.workplace.trim(),
    employmentStatus: row.employmentStatus.trim(),
    category: row.category.trim(),
    category1: row.category1.trim(),
    position: row.position.trim(),
    process,
    department: (row.department ?? '').trim(),
    category3: row.category3.trim(),
    category4: row.category4.trim(),
    genderSource: row.genderSource.trim(),
    genderLabelSource: row.genderLabelSource.trim(),
    gender,
    birthDate,
    joinDate,
    resignDate,
    ageYears,
    tenureYears: tenure?.years ?? null,
    tenureMonthsRemainder: tenure?.monthsRemainder ?? null,
    tenureTotalMonths: tenure?.totalMonths ?? null,
    tenureTotalDays: tenure?.totalDays ?? null,
    sourceTenureYears: row.sourceTenureYears,
    sourceTenureMonths: row.sourceTenureMonths,
    sourceTenureDays: row.sourceTenureDays,
    photoPath: null,
    updatedAt,
  };
}

export function validatePersonnelRows(
  rows: ImportCandidate[],
  asOfDate: string,
  meta?: {
    sheetName?: string;
    tableName?: string | null;
    /** Excel T5 등 원본 계산 기준일. asOf와 다르면 R/S/T 숫자 불일치 경고를 생략한다. */
    excelCalcBaseDate?: string | null;
  },
): ImportValidation {
  const compareSourceTenure =
    !meta?.excelCalcBaseDate || meta.excelCalcBaseDate === asOfDate;
  const issues: ValidationIssue[] = [];
  const employeeNoRows = new Map<string, number[]>();

  for (const row of rows) {
    for (const { field, label } of REQUIRED_STRING_FIELDS) {
      const raw = row[field];
      if (typeof raw !== 'string' || raw.trim() === '') {
        pushIssue(
          issues,
          row,
          label,
          `${label}은(는) 필수입니다.`,
          'error',
        );
      }
    }

    const birthDate = row.birthDate ?? formatDateValue(row.birthDateRaw);
    const joinDate = row.joinDate ?? formatDateValue(row.joinDateRaw);
    const resignDate = row.resignDate ?? formatDateValue(row.resignDateRaw);

    if (!birthDate) {
      pushIssue(
        issues,
        row,
        '생년월일',
        '생년월일은 필수이며 유효한 날짜여야 합니다.',
        'error',
      );
    }
    if (!joinDate) {
      pushIssue(
        issues,
        row,
        '입사일',
        '입사일은 필수이며 유효한 날짜여야 합니다.',
        'error',
      );
    }

    if (!row.genderSource.trim() && !row.genderLabelSource.trim()) {
      pushIssue(
        issues,
        row,
        '성별',
        '성별(M/N)은 필수입니다.',
        'error',
      );
    }

    const genderFromM = GENDER_SOURCE_TO_CODE[row.genderSource.trim()];
    const genderFromN = GENDER_LABEL_TO_CODE[row.genderLabelSource.trim()];
    const normalized = normalizeGenderFromSources(
      row.genderSource,
      row.genderLabelSource,
    );

    if (
      (row.genderSource.trim() || row.genderLabelSource.trim()) &&
      !normalized
    ) {
      pushIssue(
        issues,
        row,
        '성별',
        '성별(M/N) 값을 인식할 수 없습니다.',
        'error',
      );
    } else if (
      genderFromM &&
      genderFromN &&
      genderFromM !== genderFromN
    ) {
      pushIssue(
        issues,
        row,
        '성별',
        `성별 원본(M=${row.genderSource}, N=${row.genderLabelSource})이 일치하지 않습니다.`,
        'error',
      );
    }

    if (birthDate && isDateAfter(birthDate, asOfDate)) {
      pushIssue(
        issues,
        row,
        '생년월일',
        '생년월일이 기준일 이후입니다.',
        'error',
      );
    }
    if (joinDate && isDateAfter(joinDate, asOfDate)) {
      pushIssue(
        issues,
        row,
        '입사일',
        '입사일이 기준일 이후입니다.',
        'error',
      );
    }
    if (
      joinDate &&
      resignDate &&
      isDateBefore(resignDate, joinDate)
    ) {
      pushIssue(
        issues,
        row,
        '퇴사일',
        '퇴사일이 입사일보다 이릅니다.',
        'error',
      );
    }

    const processNorm = normalizeProcess(row.processRaw);
    if (row.processRaw.trim() === '') {
      pushIssue(
        issues,
        row,
        '공정',
        `공정이 비어 있어 '${UNSPECIFIED_PROCESS}'으로 표시됩니다.`,
        'warning',
      );
    }

    if (row.employeeNo.trim()) {
      const key = row.employeeNo.trim().toUpperCase();
      const list = employeeNoRows.get(key) ?? [];
      list.push(row.excelRow);
      employeeNoRows.set(key, list);
    }

    if (joinDate) {
      const tenure = computeTenure(joinDate, asOfDate);
      const srcY = row.sourceTenureYears;
      const srcM = row.sourceTenureMonths;
      const srcD = row.sourceTenureDays;

      if (row.sourceTenureFormulaError) {
        pushIssue(
          issues,
          row,
          '근속',
          tenure
            ? 'Excel 근속 수식(#NUM!)이 있습니다. 기준일·입사일로 재계산합니다.'
            : '입사일이 기준일 이후라 Excel 근속 수식(#NUM!)이 발생했습니다.',
          'warning',
        );
      } else if (tenure && compareSourceTenure) {
        if (srcY !== null && srcY !== tenure.years) {
          pushIssue(
            issues,
            row,
            '근속년수',
            `Excel 근속년수(${srcY})와 계산값(${tenure.years})이 다릅니다.`,
            'warning',
          );
        }
        if (srcM !== null && srcM !== tenure.totalMonths) {
          pushIssue(
            issues,
            row,
            '근속개월',
            `Excel 근속개월(${srcM})과 계산 총 개월(${tenure.totalMonths})이 다릅니다.`,
            'warning',
          );
        }
        if (srcD !== null && srcD !== tenure.totalDays) {
          pushIssue(
            issues,
            row,
            '근속일',
            `Excel 근속일(${srcD})과 계산 총 일(${tenure.totalDays})이 다릅니다.`,
            'warning',
          );
        }
      }
    }
  }

  for (const [employeeNo, excelRows] of employeeNoRows) {
    if (excelRows.length > 1) {
      for (const excelRow of excelRows) {
        const row = rows.find((r) => r.excelRow === excelRow);
        if (!row) continue;
        pushIssue(
          issues,
          row,
          '사번',
          `사번 '${employeeNo}'이(가) ${excelRows.length}행에서 중복됩니다.`,
          'error',
        );
      }
    }
  }

  let normalRows = 0;
  let warningRows = 0;
  let errorRows = 0;
  for (const row of rows) {
    const status = rowSeverity(issues, row.excelRow);
    if (status === 'error') errorRows += 1;
    else if (status === 'warning') warningRows += 1;
    else normalRows += 1;
  }

  return {
    asOfDate,
    sheetName: meta?.sheetName ?? '',
    tableName: meta?.tableName ?? null,
    totalRows: rows.length,
    normalRows,
    warningRows,
    errorRows,
    issues,
    canApply: rows.length > 0 && errorRows === 0,
    candidates: rows,
  };
}

export function buildPersonnelFromCandidates(
  rows: ImportCandidate[],
  asOfDate: string,
  updatedAt: string,
): Personnel[] {
  return rows.map((row) => candidateToPersonnel(row, asOfDate, updatedAt));
}

/** 원본 셀에서 근속 숫자 또는 #NUM! 등을 파싱할 때 사용 */
export function readSourceTenureCell(value: unknown): SourceTenureRead {
  return parseSourceTenure(value);
}
