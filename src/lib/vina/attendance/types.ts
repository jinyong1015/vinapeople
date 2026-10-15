export interface AttendanceCandidate {
  excelRow: number;
  monthValue: number | null;
  dayValue: number | null;
  attendanceDate: string | null;
  noValue: number | null;
  reason: string;
  employeeNo: string;
  name: string;
  department: string;
  shift: string;
  personCount: number | null;
  remarks: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string | null;
  employeeNo: string;
  attendanceDate: string;
  nameSnapshot: string;
  departmentSnapshot: string;
  shift: string;
  reason: string;
  remarks: string;
  personCount: number | null;
  monthValue: number | null;
  dayValue: number | null;
  noValue: number;
  createdAt: string;
  updatedAt: string;
  lastUploadId: string | null;
  /** 목록 조회 시 인원현황 photo_path 공개 URL */
  photoPath?: string | null;
}

/** 인원현황 매칭용 최소 정보 */
export interface AttendanceEmployeeRef {
  employeeNo: string;
  name: string;
  employmentStatus: string;
  resignDate: string | null;
}

export interface AttendanceFieldChange {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface AttendanceDiffCounts {
  total: number;
  new: number;
  changed: number;
  unchanged: number;
  error: number;
  /** 사번 없음 등 인원현황 미존재 */
  unmatched: number;
  /** 사번은 같으나 이름 불일치 등 확인 필요 */
  review: number;
}

export interface AttendanceApplyRow {
  employee_no: string;
  attendance_date: string;
  name_snapshot: string;
  department_snapshot: string;
  shift: string;
  reason: string;
  remarks: string;
  person_count: string;
  month_value: string;
  day_value: string;
  no_value: string;
}

export interface AttendanceReviewRow {
  excelRow: number;
  attendanceDate: string;
  employeeNo: string;
  attendanceName: string;
  rosterName: string;
  employmentStatus: string;
  resignDate: string | null;
  reason: string;
  kind: 'name_mismatch' | 'not_found';
  message: string;
}

export interface AttendancePreviewResult {
  counts: AttendanceDiffCounts;
  newRows: Array<{
    excelRow: number;
    attendanceDate: string;
    employeeNo: string;
    name: string;
    reason: string;
    noValue: number;
  }>;
  changedRows: Array<{
    excelRow: number;
    attendanceDate: string;
    employeeNo: string;
    name: string;
    reason: string;
    noValue: number;
    changes: AttendanceFieldChange[];
  }>;
  errorRows: Array<{
    excelRow: number;
    employeeNo: string;
    name: string;
    message: string;
  }>;
  unmatchedRows: AttendanceReviewRow[];
  reviewRows: AttendanceReviewRow[];
  applyRows: AttendanceApplyRow[];
  canApply: boolean;
}
