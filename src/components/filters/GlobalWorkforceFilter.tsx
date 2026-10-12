'use client';

import {
  EMPLOYMENT_STATUS_OPTIONS,
  PROCESS_OPTIONS,
  WORKPLACE_OPTIONS,
} from '@/lib/vina/codes';
import { createDefaultFilterState } from '@/lib/vina/filters';
import type { FilterState } from '@/lib/vina/types';
import type { ReactNode } from 'react';
import { MultiSelect } from './MultiSelect';
import { QueryFilterShell } from './QueryFilterShell';

export interface GlobalWorkforceFilterProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  /** 사무직 화면: scope 고정, 근무지·근무현황만 */
  officeMode?: boolean;
  /** 검색·정렬·표시 등 조회조건 하단 툴바 */
  toolbar?: ReactNode;
  className?: string;
}

function countActiveFilters(value: FilterState, officeMode: boolean): number {
  let n = 0;
  if (value.search.trim()) n += 1;
  if (value.workplaces.length) n += 1;
  if (!officeMode && value.processes.length) n += 1;
  if (value.employmentStatuses.length) n += 1;
  if (value.positions.length) n += 1;
  if (value.genders.length) n += 1;
  if (value.categories.length) n += 1;
  if (value.category1s.length) n += 1;
  if (value.category3s.length) n += 1;
  if (value.category4s.length) n += 1;
  if (value.ageBands.length) n += 1;
  if (value.tenureBands.length) n += 1;
  if (!officeMode && value.scope !== 'all') n += 1;
  return n;
}

export function GlobalWorkforceFilter({
  value,
  onChange,
  officeMode = false,
  toolbar,
  className = '',
}: GlobalWorkforceFilterProps) {
  const patch = (partial: Partial<FilterState>) => onChange({ ...value, ...partial });

  return (
    <QueryFilterShell
      title="조회조건"
      badgeCount={countActiveFilters(value, officeMode)}
      onReset={() =>
        onChange({
          ...createDefaultFilterState(),
          scope: officeMode ? 'office' : 'all',
        })
      }
      className={className}
    >
      <div className="query-filter-grid">
        <MultiSelect
          label="근무지"
          emptyLabel="전체 근무지"
          options={WORKPLACE_OPTIONS.map((w) => ({ value: w, label: w }))}
          selected={value.workplaces}
          onChange={(workplaces) => patch({ workplaces })}
        />

        {!officeMode ? (
          <MultiSelect
            label="공정"
            emptyLabel="전체 공정"
            options={PROCESS_OPTIONS.map((p) => ({ value: p, label: p }))}
            selected={value.processes}
            onChange={(processes) => patch({ processes })}
          />
        ) : null}

        <MultiSelect
          label="근무현황"
          emptyLabel="전체"
          options={EMPLOYMENT_STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          selected={value.employmentStatuses}
          onChange={(employmentStatuses) => patch({ employmentStatuses })}
        />
      </div>
      {officeMode ? (
        <p className="text-muted mt-2 text-xs font-medium">
          사무직 범위(공정=사무직)가 적용됩니다.
        </p>
      ) : null}
      {toolbar ? (
        <div className="query-filter-toolbar-slot">{toolbar}</div>
      ) : null}
    </QueryFilterShell>
  );
}
