'use client';

import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  ChevronDown,
  Search,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  id: string;
  label: string;
}

export interface SortSearchBarProps {
  /**
   * embedded: 조회조건 카드 내부용 한 줄 툴바
   * query: 단독 조회조건 카드
   * default: 레거시 카드형
   */
  variant?: 'embedded' | 'query' | 'default';
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sortField: string;
  sortOptions: SortOption[];
  onSortFieldChange: (field: string) => void;
  sortDirection: SortDirection;
  onSortDirectionToggle: () => void;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageSizeChange: (size: number) => void;
  trailing?: ReactNode;
  className?: string;
}

export function SortSearchBar({
  variant = 'embedded',
  search,
  onSearchChange,
  searchPlaceholder = '성명·사번 검색',
  sortField,
  sortOptions,
  onSortFieldChange,
  sortDirection,
  onSortDirectionToggle,
  pageSize,
  pageSizeOptions = [10, 20, 50, 100],
  onPageSizeChange,
  trailing,
  className = '',
}: SortSearchBarProps) {
  const asc = sortDirection === 'asc';
  const directionLabel = asc
    ? '오름차순 (클릭 시 내림차순)'
    : '내림차순 (클릭 시 오름차순)';

  const toolbar = (
    <div className="query-filter-toolbar-row">
      <label className="query-filter-search-wrap">
        <span className="sr-only">검색</span>
        <Search size={16} className="query-filter-search-icon" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="query-filter-input query-filter-search-input"
          aria-label="검색"
        />
      </label>

      <div className="query-filter-toolbar-controls">
        <label className="query-filter-inline">
          <span className="query-filter-inline-label">정렬</span>
          <span className="query-filter-select-wrap">
            <select
              className="query-filter-input query-filter-select"
              value={sortField}
              onChange={(e) => onSortFieldChange(e.target.value)}
              aria-label="정렬 기준"
            >
              {sortOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              className="query-filter-select-chevron"
              aria-hidden
            />
          </span>
        </label>

        <button
          type="button"
          className="query-filter-sort-btn"
          aria-label={directionLabel}
          title={directionLabel}
          onClick={onSortDirectionToggle}
        >
          {asc ? (
            <ArrowUpWideNarrow size={15} aria-hidden />
          ) : (
            <ArrowDownWideNarrow size={15} aria-hidden />
          )}
          <span>{asc ? '오름차순' : '내림차순'}</span>
        </button>

        <label className="query-filter-inline">
          <span className="query-filter-inline-label">표시</span>
          <span className="query-filter-select-wrap">
            <select
              className="query-filter-input query-filter-select query-filter-select-sm"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="페이지당 표시 개수"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}개
                </option>
              ))}
            </select>
            <ChevronDown
              size={15}
              className="query-filter-select-chevron"
              aria-hidden
            />
          </span>
        </label>
      </div>
    </div>
  );

  if (variant === 'embedded') {
    return (
      <div className={`query-filter-embedded-toolbar ${className}`.trim()}>
        {toolbar}
        {trailing ? (
          <div className="query-filter-trailing">{trailing}</div>
        ) : null}
      </div>
    );
  }

  if (variant === 'query') {
    return (
      <section
        className={`query-filter query-filter-toolbar ${className}`.trim()}
      >
        <div className="query-filter-header">
          <div className="query-filter-title-row">
            <h2 className="query-filter-title">조회조건</h2>
          </div>
        </div>
        <div className="query-filter-body">
          {toolbar}
          {trailing ? (
            <div className="query-filter-trailing">{trailing}</div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div className={`sort-search-bar card ${className}`.trim()}>
      <div className="p-4">{toolbar}</div>
    </div>
  );
}
