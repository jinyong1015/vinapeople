import { toPhotoPublicUrl } from '../photos';
import type { GenderCode, Personnel } from '../types';

export interface VinaEmployeeRow {
  id: string;
  employee_no: string;
  source_no: number | null;
  name: string;
  workplace: string;
  employment_status: string;
  category: string;
  category1: string;
  position: string;
  process: string;
  department: string;
  category3: string;
  category4: string;
  gender_source: string;
  gender_label_source: string;
  gender: string;
  birth_date: string | null;
  join_date: string | null;
  resign_date: string | null;
  age_years: number | null;
  tenure_years: number | null;
  tenure_months_remainder: number | null;
  tenure_total_months: number | null;
  tenure_total_days: number | null;
  source_tenure_years: number | null;
  source_tenure_months: number | null;
  source_tenure_days: number | null;
  photo_path: string | null;
  as_of_date: string | null;
  updated_at: string;
  updated_by: string | null;
  last_upload_id: string | null;
}

/** DB 컬럼명 ↔ 비교/이력 field_name */
export const COMPARE_FIELDS = [
  { db: 'name', person: 'name', label: '성명' },
  { db: 'workplace', person: 'workplace', label: '근무지' },
  { db: 'employment_status', person: 'employmentStatus', label: '근무현황' },
  { db: 'category', person: 'category', label: '구분' },
  { db: 'category1', person: 'category1', label: '구분1' },
  { db: 'position', person: 'position', label: '직급' },
  { db: 'process', person: 'process', label: '공정' },
  { db: 'department', person: 'department', label: '부서' },
  { db: 'category3', person: 'category3', label: '구분3' },
  { db: 'category4', person: 'category4', label: '구분4' },
  { db: 'gender_source', person: 'genderSource', label: '성별원본' },
  { db: 'gender_label_source', person: 'genderLabelSource', label: '성별라벨' },
  { db: 'gender', person: 'gender', label: '성별' },
  { db: 'birth_date', person: 'birthDate', label: '생년월일' },
  { db: 'join_date', person: 'joinDate', label: '입사일' },
  { db: 'resign_date', person: 'resignDate', label: '퇴사일' },
] as const;

export type CompareDbField = (typeof COMPARE_FIELDS)[number]['db'];

export function dateToIso(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return trimmed;
}

export function normalizeCompareValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  return String(value).trim();
}

export function rowToPersonnel(row: VinaEmployeeRow): Personnel {
  const gender =
    row.gender === '남자' || row.gender === '여자'
      ? (row.gender as GenderCode)
      : ('남자' as GenderCode);

  return {
    sourceNo: row.source_no,
    id: row.id,
    employeeNo: row.employee_no,
    name: row.name ?? '',
    workplace: row.workplace ?? '',
    employmentStatus: row.employment_status ?? '',
    category: row.category ?? '',
    category1: row.category1 ?? '',
    position: row.position ?? '',
    process: row.process ?? '',
    department: row.department ?? '',
    category3: row.category3 ?? '',
    category4: row.category4 ?? '',
    genderSource: row.gender_source ?? '',
    genderLabelSource: row.gender_label_source ?? '',
    gender,
    birthDate: dateToIso(row.birth_date),
    joinDate: dateToIso(row.join_date),
    resignDate: dateToIso(row.resign_date),
    ageYears: row.age_years,
    tenureYears: row.tenure_years,
    tenureMonthsRemainder: row.tenure_months_remainder,
    tenureTotalMonths: row.tenure_total_months,
    tenureTotalDays: row.tenure_total_days,
    sourceTenureYears: row.source_tenure_years,
    sourceTenureMonths: row.source_tenure_months,
    sourceTenureDays: row.source_tenure_days,
    photoPath: toPhotoPublicUrl(row.photo_path),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

/** RPC insert/update용 snake_case 페이로드 */
export function personnelToDbPayload(person: Personnel): Record<string, string | number | null> {
  return {
    employee_no: person.employeeNo,
    source_no: person.sourceNo,
    name: person.name,
    workplace: person.workplace,
    employment_status: person.employmentStatus,
    category: person.category,
    category1: person.category1,
    position: person.position,
    process: person.process,
    department: person.department ?? '',
    category3: person.category3,
    category4: person.category4,
    gender_source: person.genderSource,
    gender_label_source: person.genderLabelSource,
    gender: person.gender,
    birth_date: person.birthDate,
    join_date: person.joinDate,
    resign_date: person.resignDate,
    age_years: person.ageYears,
    tenure_years: person.tenureYears,
    tenure_months_remainder: person.tenureMonthsRemainder,
    tenure_total_months: person.tenureTotalMonths,
    tenure_total_days: person.tenureTotalDays,
    source_tenure_years: person.sourceTenureYears,
    source_tenure_months: person.sourceTenureMonths,
    source_tenure_days: person.sourceTenureDays,
    // photo_path는 사진 API에서만 관리 — Excel 반영 페이로드에 포함하지 않음
  };
}

export function personFieldValue(
  person: Pick<
    Personnel,
    | 'name'
    | 'workplace'
    | 'employmentStatus'
    | 'category'
    | 'category1'
    | 'position'
    | 'process'
    | 'department'
    | 'category3'
    | 'category4'
    | 'genderSource'
    | 'genderLabelSource'
    | 'gender'
    | 'birthDate'
    | 'joinDate'
    | 'resignDate'
  >,
  personKey: (typeof COMPARE_FIELDS)[number]['person'],
): string {
  const raw = person[personKey];
  if (raw === null || raw === undefined) return '';
  return normalizeCompareValue(raw);
}

export function fieldLabel(dbField: string): string {
  if (dbField === 'photo_path') return '사진';
  const found = COMPARE_FIELDS.find((f) => f.db === dbField);
  return found?.label ?? dbField;
}
