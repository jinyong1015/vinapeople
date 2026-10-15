import { candidateToPersonnel } from './validator';
import {
  COMPARE_FIELDS,
  fieldLabel,
  normalizeCompareValue,
  personFieldValue,
  personnelToDbPayload,
  type VinaEmployeeRow,
  rowToPersonnel,
} from './supabase/mappers';
import type { ImportCandidate, Personnel, ValidationIssue } from './types';

export interface FieldChange {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface DiffNewRow {
  excelRow: number;
  employeeNo: string;
  name: string;
  personnel: Personnel;
}

export interface DiffChangedRow {
  excelRow: number;
  employeeNo: string;
  name: string;
  employeeId: string;
  changes: FieldChange[];
  personnel: Personnel;
}

export interface DiffUnchangedRow {
  excelRow: number;
  employeeNo: string;
  name: string;
  employeeId: string;
}

export interface DiffErrorRow {
  excelRow: number;
  employeeNo: string;
  name: string;
  message: string;
}

export interface DiffMissingRow {
  employeeNo: string;
  name: string;
  employeeId: string;
  employmentStatus: string;
}

export interface ImportDiffResult {
  asOfDate: string;
  total: number;
  newRows: DiffNewRow[];
  changedRows: DiffChangedRow[];
  unchangedRows: DiffUnchangedRow[];
  errorRows: DiffErrorRow[];
  missingRows: DiffMissingRow[];
  counts: {
    total: number;
    new: number;
    changed: number;
    unchanged: number;
    error: number;
    missing: number;
  };
  /** RPC vina_apply_employee_upload 페이로드 */
  applyPayload: ApplyUploadPayload;
}

export interface ApplyUploadPayload {
  asOfDate: string;
  uploadedBy: string;
  inserts: Record<string, string | number | null>[];
  updates: ApplyUploadUpdate[];
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  errorCount: number;
  missingCount: number;
  totalCount: number;
}

export interface ApplyUploadUpdate {
  employee_no: string;
  [key: string]: string | number | null | Array<{ field: string; oldValue: string; newValue: string }>;
  changes: Array<{ field: string; oldValue: string; newValue: string }>;
}

function comparePersonnel(
  existing: Personnel,
  incoming: Personnel,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const spec of COMPARE_FIELDS) {
    const oldValue = personFieldValue(existing, spec.person);
    const newValue = personFieldValue(incoming, spec.person);
    if (normalizeCompareValue(oldValue) !== normalizeCompareValue(newValue)) {
      changes.push({
        field: spec.db,
        label: spec.label,
        oldValue,
        newValue,
      });
    }
  }
  return changes;
}

/**
 * 정규화 비교로 신규/변경/동일/오류 + 누락(자동 퇴사 없음)을 분류한다.
 */
export function diffAgainstExisting(
  candidates: ImportCandidate[],
  existingRows: VinaEmployeeRow[],
  asOfDate: string,
  options?: {
    uploadedBy?: string;
    validationIssues?: ValidationIssue[];
  },
): ImportDiffResult {
  const uploadedBy = options?.uploadedBy ?? 'admin';
  const now = new Date().toISOString();
  const existingByNo = new Map<string, Personnel>();
  for (const row of existingRows) {
    const person = rowToPersonnel(row);
    const key = person.employeeNo.trim();
    if (key) existingByNo.set(key, person);
  }

  const fileNos = new Map<string, number[]>();
  for (const row of candidates) {
    const no = row.employeeNo.trim();
    if (!no) continue;
    const list = fileNos.get(no) ?? [];
    list.push(row.excelRow);
    fileNos.set(no, list);
  }

  const errorRows: DiffErrorRow[] = [];
  const newRows: DiffNewRow[] = [];
  const changedRows: DiffChangedRow[] = [];
  const unchangedRows: DiffUnchangedRow[] = [];
  const seenForApply = new Set<string>();

  for (const row of candidates) {
    const employeeNo = row.employeeNo.trim();
    const name = row.name.trim();

    if (!employeeNo) {
      errorRows.push({
        excelRow: row.excelRow,
        employeeNo: '',
        name,
        message: '사번이 없습니다.',
      });
      continue;
    }

    const dupRows = fileNos.get(employeeNo) ?? [];
    if (dupRows.length > 1) {
      errorRows.push({
        excelRow: row.excelRow,
        employeeNo,
        name,
        message: `파일 내 사번 중복 (행: ${dupRows.join(', ')})`,
      });
      continue;
    }

    const rowIssues = (options?.validationIssues ?? []).filter(
      (i) => i.excelRow === row.excelRow && i.severity === 'error',
    );
    if (rowIssues.length > 0) {
      errorRows.push({
        excelRow: row.excelRow,
        employeeNo,
        name,
        message: rowIssues.map((i) => i.message).join('; '),
      });
      continue;
    }

    const incoming = candidateToPersonnel(row, asOfDate, now);
    const existing = existingByNo.get(employeeNo);

    if (!existing) {
      newRows.push({
        excelRow: row.excelRow,
        employeeNo,
        name: incoming.name,
        personnel: incoming,
      });
      seenForApply.add(employeeNo);
      continue;
    }

    const changes = comparePersonnel(existing, incoming);
    if (changes.length === 0) {
      unchangedRows.push({
        excelRow: row.excelRow,
        employeeNo,
        name: incoming.name,
        employeeId: existing.id,
      });
      seenForApply.add(employeeNo);
      continue;
    }

    changedRows.push({
      excelRow: row.excelRow,
      employeeNo,
      name: incoming.name,
      employeeId: existing.id,
      changes,
      personnel: { ...incoming, id: existing.id },
    });
    seenForApply.add(employeeNo);
  }

  const missingRows: DiffMissingRow[] = [];
  for (const [employeeNo, person] of existingByNo) {
    if (seenForApply.has(employeeNo)) continue;
    if (fileNos.has(employeeNo)) continue;
    missingRows.push({
      employeeNo,
      name: person.name,
      employeeId: person.id,
      employmentStatus: person.employmentStatus,
    });
  }

  const inserts = newRows.map((r) => personnelToDbPayload(r.personnel));
  const updates: ApplyUploadUpdate[] = changedRows.map((r) => {
    const payload = personnelToDbPayload(r.personnel);
    return {
      ...payload,
      employee_no: String(payload.employee_no ?? r.employeeNo),
      changes: r.changes.map((c) => ({
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
      })),
    };
  });

  const counts = {
    total: candidates.length,
    new: newRows.length,
    changed: changedRows.length,
    unchanged: unchangedRows.length,
    error: errorRows.length,
    missing: missingRows.length,
  };

  return {
    asOfDate,
    total: candidates.length,
    newRows,
    changedRows,
    unchangedRows,
    errorRows,
    missingRows,
    counts,
    applyPayload: {
      asOfDate,
      uploadedBy,
      inserts,
      updates,
      newCount: counts.new,
      changedCount: counts.changed,
      unchangedCount: counts.unchanged,
      errorCount: counts.error,
      missingCount: counts.missing,
      totalCount: counts.total,
    },
  };
}

export { fieldLabel };
