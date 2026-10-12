/** VINA 인원현황 코어 타입 (화면설계서 3.0) */

export type GenderCode = '남자' | '여자';

export type EmploymentStatus = '근무중' | '휴직';

export type WorkforceScope =
  | 'all'
  | 'production'
  | 'office'
  | 'support'
  | 'unspecified';

export type AgeBand =
  | 'under20'
  | '20s'
  | '30s'
  | '40s'
  | '50s'
  | '60plus'
  | 'missingBirth';

export type TenureBand =
  | 'under6Months'
  | '6monthsTo1Year'
  | '1to2Years'
  | '2to3Years'
  | '3plusYears'
  | 'missingJoin';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  excelRow: number;
  employeeNo: string;
  name: string;
  field: string;
  message: string;
  severity: IssueSeverity;
}

export interface DatasetInfo {
  versionId: string;
  asOfDate: string;
  appliedAt: string;
  fileName: string;
  personnelCount: number;
  updatedAt: string;
}

export interface Personnel {
  sourceNo: number | null;
  id: string;
  employeeNo: string;
  name: string;
  workplace: string;
  employmentStatus: string;
  category: string;
  category1: string;
  position: string;
  process: string;
  /** Excel 부서 — 사무직 조직도 소속 */
  department: string;
  category3: string;
  category4: string;
  genderSource: string;
  genderLabelSource: string;
  gender: GenderCode;
  birthDate: string | null;
  joinDate: string | null;
  resignDate: string | null;
  ageYears: number | null;
  tenureYears: number | null;
  tenureMonthsRemainder: number | null;
  tenureTotalMonths: number | null;
  tenureTotalDays: number | null;
  sourceTenureYears: number | null;
  sourceTenureMonths: number | null;
  sourceTenureDays: number | null;
  photoPath: string | null;
  updatedAt: string;
}

export interface ActiveDatasetMeta {
  sheetName: string | null;
  tableName: string | null;
  headerRow: number | null;
  dataStartRow: number | null;
  dataEndRow: number | null;
  documentDate: string | null;
  calcBaseDate: string | null;
  fileNameDateHint: string | null;
}

export interface ActiveDataset {
  versionId: string;
  asOfDate: string;
  appliedAt: string;
  fileName: string;
  personnel: Personnel[];
  meta: ActiveDatasetMeta;
  updatedAt: string;
}

export interface FilterState {
  scope: WorkforceScope;
  search: string;
  workplaces: string[];
  processes: string[];
  positions: string[];
  genders: GenderCode[];
  employmentStatuses: string[];
  categories: string[];
  category1s: string[];
  category3s: string[];
  category4s: string[];
  ageBands: AgeBand[];
  tenureBands: TenureBand[];
}

export interface ImportCandidate {
  excelRow: number;
  sourceNo: number | null;
  employeeNo: string;
  name: string;
  workplace: string;
  employmentStatus: string;
  category: string;
  category1: string;
  position: string;
  processRaw: string;
  process: string;
  department: string;
  category3: string;
  category4: string;
  genderSource: string;
  genderLabelSource: string;
  birthDateRaw: unknown;
  joinDateRaw: unknown;
  resignDateRaw: unknown;
  birthDate: string | null;
  joinDate: string | null;
  resignDate: string | null;
  sourceTenureYears: number | null;
  sourceTenureMonths: number | null;
  sourceTenureDays: number | null;
  /** Excel R/S/T 중 #NUM! 등 수식 오류가 하나라도 있으면 true */
  sourceTenureFormulaError: boolean;
}

export interface OutsideTablePreviewRow {
  excelRow: number;
  employeeNo: string;
  name: string;
  preview: Record<string, string>;
}

export interface ParsePersonnelWorkbookResult {
  sheetName: string;
  tableName: string | null;
  tableRef: string | null;
  headerRow: number;
  dataStartRow: number;
  dataEndRow: number;
  documentDate: string | null;
  calcBaseDate: string | null;
  fileNameDateHint: string | null;
  /** T4 / T5 / 파일명 힌트 중 2개 이상 존재하고 값이 서로 다른 경우 */
  dateSourcesConflict: boolean;
  /** 기준 양식(부서 포함 또는 이전 양식)과 헤더가 일치하면 true */
  schemaOk: boolean;
  schemaIssues: string[];
  rows: ImportCandidate[];
  outsidePreview: OutsideTablePreviewRow[];
  outsideRecordCount: number;
  headers: string[];
  titleText: string | null;
  baseDateLabel: string | null;
}

export interface ImportValidation {
  asOfDate: string;
  sheetName: string;
  tableName: string | null;
  totalRows: number;
  normalRows: number;
  warningRows: number;
  errorRows: number;
  issues: ValidationIssue[];
  canApply: boolean;
  candidates: ImportCandidate[];
}

export class DatasetVersionConflictError extends Error {
  readonly expectedVersion: string;
  readonly actualVersion: string;

  constructor(expectedVersion: string, actualVersion: string) {
    super(
      `데이터 버전이 일치하지 않습니다. (기대: ${expectedVersion}, 현재: ${actualVersion})`,
    );
    this.name = 'DatasetVersionConflictError';
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}
