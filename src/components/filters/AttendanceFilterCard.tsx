'use client';

import {
  SortSearchBar,
  type SortDirection,
  type SortOption,
} from '@/components/common/SortSearchBar';
import { PROCESS_OPTIONS } from '@/lib/vina/codes';
import { MultiSelect } from './MultiSelect';
import { QueryFilterShell } from './QueryFilterShell';

export const ATTENDANCE_SHIFT_OPTIONS = ['주간', '야간', '휴무'] as const;

export const ATTENDANCE_SORT_OPTIONS: SortOption[] = [
  { id: 'attendance_date', label: '근태 날짜' },
  { id: 'employee_no', label: '사번' },
  { id: 'name_snapshot', label: '성명' },
  { id: 'reason', label: '사유' },
];

export interface AttendanceFilterState {
  from: string;
  to: string;
  processes: string[];
  shifts: string[];
  search: string;
}

export function createDefaultAttendanceFilters(
  partial?: Partial<AttendanceFilterState>,
): AttendanceFilterState {
  return {
    from: '',
    to: '',
    processes: [],
    shifts: [],
    search: '',
    ...partial,
  };
}

function countActiveFilters(value: AttendanceFilterState): number {
  let n = 0;
  if (value.from) n += 1;
  if (value.to) n += 1;
  if (value.processes.length) n += 1;
  if (value.shifts.length) n += 1;
  if (value.search.trim()) n += 1;
  return n;
}

export interface AttendanceFilterCardProps {
  value: AttendanceFilterState;
  onChange: (next: AttendanceFilterState) => void;
  sortField: string;
  onSortFieldChange: (field: string) => void;
  sortDirection: SortDirection;
  onSortDirectionToggle: () => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

export function AttendanceFilterCard({
  value,
  onChange,
  sortField,
  onSortFieldChange,
  sortDirection,
  onSortDirectionToggle,
  pageSize,
  onPageSizeChange,
  className = '',
}: AttendanceFilterCardProps) {
  const patch = (partial: Partial<AttendanceFilterState>) =>
    onChange({ ...value, ...partial });

  return (
    <QueryFilterShell
      title="조회조건"
      badgeCount={countActiveFilters(value)}
      onReset={() => onChange(createDefaultAttendanceFilters())}
      className={className}
    >
      <div className="query-filter-grid">
        <label className="query-filter-field">
          <span className="query-filter-field-label">시작일</span>
          <input
            type="date"
            className="query-filter-input"
            value={value.from}
            onChange={(e) => patch({ from: e.target.value })}
          />
        </label>
        <label className="query-filter-field">
          <span className="query-filter-field-label">종료일</span>
          <input
            type="date"
            className="query-filter-input"
            value={value.to}
            onChange={(e) => patch({ to: e.target.value })}
          />
        </label>
        <MultiSelect
          label="공정"
          emptyLabel="전체 공정"
          options={PROCESS_OPTIONS.map((p) => ({ value: p, label: p }))}
          selected={value.processes}
          onChange={(processes) => patch({ processes })}
        />
        <MultiSelect
          label="주/야"
          emptyLabel="전체"
          options={ATTENDANCE_SHIFT_OPTIONS.map((s) => ({ value: s, label: s }))}
          selected={value.shifts}
          onChange={(shifts) => patch({ shifts })}
        />
      </div>

      <div className="query-filter-toolbar-slot">
        <SortSearchBar
          variant="embedded"
          search={value.search}
          onSearchChange={(search) => patch({ search })}
          searchPlaceholder="성명·사번·사유·비고 검색"
          sortField={sortField}
          sortOptions={ATTENDANCE_SORT_OPTIONS}
          onSortFieldChange={onSortFieldChange}
          sortDirection={sortDirection}
          onSortDirectionToggle={onSortDirectionToggle}
          pageSize={pageSize}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </QueryFilterShell>
  );
}
