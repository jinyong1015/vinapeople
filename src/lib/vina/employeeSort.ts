import type { Personnel } from './types';
import type { SortDirection } from '@/components/common/SortSearchBar';

export type EmployeeSortField =
  | 'employeeNo'
  | 'name'
  | 'workplace'
  | 'process'
  | 'position'
  | 'joinDate'
  | 'employmentStatus';

export const EMPLOYEE_SORT_OPTIONS: { id: EmployeeSortField; label: string }[] = [
  { id: 'employeeNo', label: '사번' },
  { id: 'name', label: '성명' },
  { id: 'workplace', label: '근무지' },
  { id: 'process', label: '공정' },
  { id: 'position', label: '직급' },
  { id: 'joinDate', label: '입사일' },
  { id: 'employmentStatus', label: '근무현황' },
];

function compareString(a: string, b: string, dir: SortDirection): number {
  const cmp = a.localeCompare(b, 'ko', { numeric: true });
  return dir === 'asc' ? cmp : -cmp;
}

export function sortPersonnel(
  rows: Personnel[],
  field: EmployeeSortField,
  direction: SortDirection,
): Personnel[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    switch (field) {
      case 'employeeNo':
        return compareString(a.employeeNo, b.employeeNo, direction);
      case 'name':
        return compareString(a.name, b.name, direction);
      case 'workplace':
        return compareString(a.workplace, b.workplace, direction);
      case 'process':
        return compareString(a.process, b.process, direction);
      case 'position':
        return compareString(a.position, b.position, direction);
      case 'employmentStatus':
        return compareString(a.employmentStatus, b.employmentStatus, direction);
      case 'joinDate': {
        const av = a.joinDate ?? '';
        const bv = b.joinDate ?? '';
        return compareString(av, bv, direction);
      }
      default:
        return 0;
    }
  });
  return sorted;
}
