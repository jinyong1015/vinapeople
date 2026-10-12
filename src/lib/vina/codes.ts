import type { EmploymentStatus, GenderCode, WorkforceScope } from './types';

export const WORKPLACE_OPTIONS = ['1공장', '2공장'] as const;

export const PROCESS_OPTIONS = [
  '로라',
  '재단',
  '성형',
  '검사',
  '키퍼',
  '포장',
  '사무직',
  '청소',
  '전기기술자',
  '미지정',
] as const;

export const POSITION_OPTIONS = ['회계장', '반장', '조장', '사원'] as const;

export const EMPLOYMENT_STATUS_ACTIVE: EmploymentStatus[] = ['근무중', '휴직'];

export const EMPLOYMENT_STATUS_OPTIONS = [...EMPLOYMENT_STATUS_ACTIVE] as const;

export const GENDER_SOURCE_TO_CODE: Record<string, GenderCode> = {
  Nam: '남자',
  Nữ: '여자',
  Nư: '여자',
};

export const GENDER_LABEL_TO_CODE: Record<string, GenderCode> = {
  남자: '남자',
  여자: '여자',
};

export const UNSPECIFIED_PROCESS = '미지정';

export interface WorkforceScopeDefinition {
  id: WorkforceScope;
  label: string;
  processes: readonly string[];
}

export const WORKFORCE_SCOPES: readonly WorkforceScopeDefinition[] = [
  {
    id: 'all',
    label: '전체 인원',
    processes: [],
  },
  {
    id: 'production',
    label: '생산공정',
    processes: ['로라', '재단', '성형', '검사', '키퍼', '포장'],
  },
  {
    id: 'office',
    label: '사무직',
    processes: ['사무직'],
  },
  {
    id: 'support',
    label: '지원 업무',
    processes: ['청소', '전기기술자'],
  },
  {
    id: 'unspecified',
    label: '공정 미지정',
    processes: [],
  },
] as const;

export function normalizeProcess(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : UNSPECIFIED_PROCESS;
}

export function normalizeGenderFromSources(
  genderSource: string,
  genderLabelSource: string,
): GenderCode | null {
  const fromSource = GENDER_SOURCE_TO_CODE[genderSource.trim()];
  if (fromSource) return fromSource;
  const fromLabel = GENDER_LABEL_TO_CODE[genderLabelSource.trim()];
  if (fromLabel) return fromLabel;
  return null;
}

export function processMatchesScope(
  process: string,
  scope: WorkforceScope,
): boolean {
  if (scope === 'all') return true;
  const def = WORKFORCE_SCOPES.find((s) => s.id === scope);
  if (!def) return true;
  if (scope === 'unspecified') {
    return process === UNSPECIFIED_PROCESS || process.trim() === '';
  }
  return def.processes.includes(process);
}

export function createStablePersonnelId(employeeNo: string): string {
  const normalized = employeeNo.trim().toUpperCase();
  return `emp:${normalized}`;
}
