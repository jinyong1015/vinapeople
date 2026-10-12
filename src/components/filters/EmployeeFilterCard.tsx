'use client';

import {
  SortSearchBar,
  type SortDirection,
  type SortOption,
} from '@/components/common/SortSearchBar';
import type { FilterState } from '@/lib/vina/types';
import { GlobalWorkforceFilter } from './GlobalWorkforceFilter';

export interface EmployeeFilterToolbarProps {
  sortField: string;
  sortOptions: SortOption[];
  onSortFieldChange: (field: string) => void;
  sortDirection: SortDirection;
  onSortDirectionToggle: () => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  searchPlaceholder?: string;
}

export interface EmployeeFilterCardProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  /** 조회조건 카드 안에 검색·정렬·표시 툴바 포함 */
  toolbar?: EmployeeFilterToolbarProps;
  className?: string;
}

export function EmployeeFilterCard({
  value,
  onChange,
  toolbar,
  className = '',
}: EmployeeFilterCardProps) {
  return (
    <div className={`employee-filter-card ${className}`.trim()}>
      <GlobalWorkforceFilter
        value={value}
        onChange={onChange}
        toolbar={
          toolbar ? (
            <SortSearchBar
              variant="embedded"
              search={value.search}
              onSearchChange={(search) => onChange({ ...value, search })}
              searchPlaceholder={toolbar.searchPlaceholder}
              sortField={toolbar.sortField}
              sortOptions={toolbar.sortOptions}
              onSortFieldChange={toolbar.onSortFieldChange}
              sortDirection={toolbar.sortDirection}
              onSortDirectionToggle={toolbar.onSortDirectionToggle}
              pageSize={toolbar.pageSize}
              onPageSizeChange={toolbar.onPageSizeChange}
            />
          ) : undefined
        }
      />
    </div>
  );
}
