import type { Personnel } from './types';

/** 조직도 2단 부서 표시 순서 (첨부 조직도 기준) */
export const OFFICE_DEPT_ORDER = [
  '회계',
  '공정관리',
  '생산관리',
  '품질',
  '수출/수입',
  '통역',
] as const;

export const OFFICE_DEPT_COLORS: Record<string, string> = {
  법인장: '#e8c84a',
  회계: '#e8c84a',
  공정관리: '#7cb342',
  생산관리: '#9e9e9e',
  품질: '#64b5f6',
  '수출/수입': '#42a5f5',
  통역: '#ef9a9a',
};

const KNOWN_DEPARTMENTS = new Set<string>([
  '법인장',
  ...OFFICE_DEPT_ORDER,
]);

const POSITION_RANK: Record<string, number> = {
  법인장: 0,
  회계장: 1,
  반장: 2,
  조장: 3,
  사원: 4,
};

export interface OfficeOrgPerson {
  id: string;
  employeeNo: string;
  name: string;
  department: string;
  position: string;
  joinDate: string | null;
  photoPath: string | null;
  href: string;
}

export interface OfficeOrgNode {
  person: OfficeOrgPerson | null;
  /** 부서 헤더 색·라벨 (카드 상단) */
  department: string;
  children: OfficeOrgNode[];
}

function positionRank(position: string): number {
  return POSITION_RANK[position] ?? 50;
}

function joinKey(joinDate: string | null): string {
  return joinDate ?? '9999-99-99';
}

/**
 * Excel 부서 값을 그대로 사용합니다.
 * 구버전 업로드로 department가 비고 category3에 부서가 들어간 경우만 복구합니다.
 * 부서가 없으면 null — 미지정 열을 만들지 않습니다.
 */
export function resolveOrgDepartment(person: Personnel): string | null {
  const dept = (person.department ?? '').trim();
  if (dept) return dept;

  // 부서 열 추가 전 파서로 올린 데이터: 부서값이 category3에 들어감
  const legacy = (person.category3 ?? '').trim();
  if (legacy && KNOWN_DEPARTMENTS.has(legacy)) return legacy;

  return null;
}

/** 목록·카드 표시용 부서명 (없으면 빈 문자열) */
export function displayDepartment(person: Personnel): string {
  return resolveOrgDepartment(person) ?? '';
}

export function toOfficeOrgPerson(person: Personnel): OfficeOrgPerson {
  const department = resolveOrgDepartment(person) ?? '';
  return {
    id: person.id,
    employeeNo: person.employeeNo,
    name: person.name,
    department,
    position: person.position,
    joinDate: person.joinDate,
    photoPath: person.photoPath,
    href: `/employees/${person.id}?from=office`,
  };
}

function sortOrgMembers(a: Personnel, b: Personnel): number {
  const rankDiff = positionRank(a.position) - positionRank(b.position);
  if (rankDiff !== 0) return rankDiff;
  const joinDiff = joinKey(a.joinDate).localeCompare(joinKey(b.joinDate));
  if (joinDiff !== 0) return joinDiff;
  return a.employeeNo.localeCompare(b.employeeNo, 'ko', { numeric: true });
}

function chainNodes(
  members: Personnel[],
  department: string,
): OfficeOrgNode | null {
  if (members.length === 0) return null;
  const sorted = [...members].sort(sortOrgMembers);
  let root: OfficeOrgNode | null = null;
  let cursor: OfficeOrgNode | null = null;
  for (const member of sorted) {
    const node: OfficeOrgNode = {
      person: toOfficeOrgPerson(member),
      department,
      children: [],
    };
    if (!root) {
      root = node;
      cursor = node;
    } else if (cursor) {
      cursor.children = [node];
      cursor = node;
    }
  }
  return root;
}

/**
 * 사무직 인원으로 법인장 루트 조직도를 구성합니다.
 * - Excel 부서 값을 그대로 사용 (재매핑 없음)
 * - 부서=법인장 → 루트
 * - 그 외 부서 → 법인장 아래 열
 * - 부서가 없는 인원은 조직도에서 제외 (미지정 없음)
 */
export function buildOfficeOrgChart(officePersonnel: Personnel[]): OfficeOrgNode {
  const byDept = new Map<string, Personnel[]>();
  for (const person of officePersonnel) {
    const dept = resolveOrgDepartment(person);
    if (!dept) continue;
    const list = byDept.get(dept) ?? [];
    list.push(person);
    byDept.set(dept, list);
  }

  const rootMembers = [...(byDept.get('법인장') ?? [])].sort(sortOrgMembers);
  byDept.delete('법인장');

  const rootPerson = rootMembers[0] ?? null;

  const children: OfficeOrgNode[] = [];
  const seen = new Set<string>();

  // 법인장 부서에 2명 이상이면 루트 외 인원은 법인장 열로 세로 배치
  if (rootMembers.length > 1) {
    const extras = chainNodes(rootMembers.slice(1), '법인장');
    if (extras) children.push(extras);
  }

  for (const dept of OFFICE_DEPT_ORDER) {
    const members = byDept.get(dept) ?? [];
    if (members.length === 0) continue;
    seen.add(dept);
    const chain = chainNodes(members, dept);
    if (chain) children.push(chain);
  }

  for (const [dept, members] of [...byDept.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], 'ko'),
  )) {
    if (seen.has(dept)) continue;
    const chain = chainNodes(members, dept);
    if (chain) children.push(chain);
  }

  return {
    person: rootPerson
      ? {
          ...toOfficeOrgPerson(rootPerson),
          department: '법인장',
        }
      : null,
    department: '법인장',
    children,
  };
}

export function formatOrgJoinDate(iso: string | null): string {
  if (!iso) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function deptAccent(department: string): string {
  return OFFICE_DEPT_COLORS[department] ?? '#90a4ae';
}
