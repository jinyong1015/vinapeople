'use client';

import { Suspense } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Pager } from '@/components/common/Pager';
import { Panel } from '@/components/common/Panel';
import { type SortDirection } from '@/components/common/SortSearchBar';
import { DetailBackNav } from '@/components/detail/DetailBackNav';
import { EmployeeFilterCard } from '@/components/filters/EmployeeFilterCard';
import { useWorkforce } from '@/components/providers/WorkforceProvider';
import {
  buildEmployeesXlsx,
  buildDetailExportFilename,
  createDefaultFilterState,
  filterPersonnel,
  loadPageViewState,
  savePageViewState,
} from '@/lib/vina';
import {
  analysisFromLabel,
  overlayFilterState,
  parseFilterSearchParams,
  sanitizeEmployeesFromPath,
  serializeFilterParams,
} from '@/lib/vina/filterUrl';
import {
  EMPLOYEE_SORT_OPTIONS,
  sortPersonnel,
  type EmployeeSortField,
} from '@/lib/vina/employeeSort';
import type { FilterState } from '@/lib/vina/types';
import { ChartColumn, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** 인원현황 대시보드와 동일한 조회조건 저장 키 */
const GLOBAL_FILTERS_KEY = 'global-filters';
const VIEW_KEY = 'employees-list';

interface EmployeesViewState {
  /** @deprecated 레거시 — 필터는 GLOBAL_FILTERS_KEY 사용 */
  filters?: FilterState;
  sortField: EmployeeSortField;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
}

function loadSharedFilters(): FilterState {
  const global = loadPageViewState<FilterState>(GLOBAL_FILTERS_KEY);
  if (global) return global;
  const legacy = loadPageViewState<EmployeesViewState>(VIEW_KEY);
  if (legacy?.filters) return legacy.filters;
  return createDefaultFilterState();
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<p className="text-muted text-sm">목록을 준비하는 중…</p>}>
      <EmployeesPageContent />
    </Suspense>
  );
}

function EmployeesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dataset, personnel, loading } = useWorkforce();

  const [filters, setFiltersState] = useState<FilterState>(loadSharedFilters);

  const [view, setView] = useState<EmployeesViewState>(() => {
    const saved = loadPageViewState<EmployeesViewState>(VIEW_KEY);
    return {
      sortField: saved?.sortField ?? 'employeeNo',
      sortDirection: saved?.sortDirection ?? 'asc',
      page: saved?.page ?? 1,
      pageSize: saved?.pageSize ?? 20,
    };
  });

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const fromUrl = parseFilterSearchParams(params);
    const pageParam = Number(params.get('page') ?? '');
    const pageSizeParam = Number(params.get('pageSize') ?? '');
    const sortParam = params.get('sort') as EmployeeSortField | null;
    const dirParam = params.get('dir') as SortDirection | null;
    const hasFilters = Object.keys(fromUrl).length > 0;
    const hasView =
      Number.isFinite(pageParam) ||
      Number.isFinite(pageSizeParam) ||
      Boolean(sortParam) ||
      Boolean(dirParam);
    if (!hasFilters && !hasView) return;

    if (hasFilters) {
      // URL은 비어 있는 조건을 생략하므로, 이전 global-filters(검색어 등)를
      // 유지하면 분석 요약 인원과 어긋난다. 기본 상태에서 URL만 덮는다.
      setFiltersState(overlayFilterState(createDefaultFilterState(), fromUrl));
    }
    setView((prev) => ({
      ...prev,
      page:
        Number.isFinite(pageParam) && pageParam >= 1
          ? Math.floor(pageParam)
          : hasFilters && !hasView
            ? 1
            : prev.page,
      pageSize:
        Number.isFinite(pageSizeParam) && pageSizeParam > 0
          ? Math.floor(pageSizeParam)
          : prev.pageSize,
      sortField:
        sortParam && EMPLOYEE_SORT_OPTIONS.some((o) => o.id === sortParam)
          ? sortParam
          : prev.sortField,
      sortDirection: dirParam === 'asc' || dirParam === 'desc' ? dirParam : prev.sortDirection,
    }));
  }, [searchParams]);

  useEffect(() => {
    savePageViewState(GLOBAL_FILTERS_KEY, filters);
  }, [filters]);

  useEffect(() => {
    savePageViewState(VIEW_KEY, view);
  }, [view]);

  const { sortField, sortDirection, page, pageSize } = view;

  const analysisFrom = useMemo(
    () => sanitizeEmployeesFromPath(searchParams.get('from')),
    [searchParams],
  );

  const buildListHref = useCallback(
    (nextFilters: FilterState, nextView: EmployeesViewState) => {
      const params = serializeFilterParams(nextFilters);
      params.set('page', String(nextView.page));
      params.set('pageSize', String(nextView.pageSize));
      params.set('sort', nextView.sortField);
      params.set('dir', nextView.sortDirection);
      if (analysisFrom) params.set('from', analysisFrom);
      const qs = params.toString();
      return qs ? `/employees?${qs}` : '/employees';
    },
    [analysisFrom],
  );

  const setFilters = useCallback(
    (next: FilterState) => {
      setFiltersState(next);
      setView((prev) => {
        const nextView = { ...prev, page: 1 };
        router.replace(buildListHref(next, nextView), { scroll: false });
        return nextView;
      });
    },
    [router, buildListHref],
  );

  const filtered = useMemo(
    () => filterPersonnel(personnel, filters),
    [personnel, filters],
  );

  const sorted = useMemo(
    () => sortPersonnel(filtered, sortField, sortDirection),
    [filtered, sortField, sortDirection],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const downloadXlsx = async () => {
    if (!dataset) return;
    const blob = await buildEmployeesXlsx(filtered, dataset.asOfDate);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildDetailExportFilename(dataset.asOfDate);
    a.click();
    URL.revokeObjectURL(url);
  };

  const listParams = serializeFilterParams(filters);
  listParams.set('page', String(safePage));
  listParams.set('pageSize', String(pageSize));
  listParams.set('sort', sortField);
  listParams.set('dir', sortDirection);
  if (analysisFrom) listParams.set('from', analysisFrom);
  const listQuery = listParams.toString();
  const fromQuery = `employees?${listQuery}`;

  const detailHref = (id: string) =>
    `/employees/${encodeURIComponent(id)}?from=${encodeURIComponent(fromQuery)}`;

  if (!loading && !dataset) {
    return (
      <>
        <PageHeader title="상세인원" />
        <EmptyState
          title="반영된 인원 데이터가 없습니다"
          actions={
            <Link href="/manage/import" className="btn btn-primary">
              데이터 업로드
            </Link>
          }
        />
      </>
    );
  }

  return (
    <div className="employees-page space-y-6">
      {analysisFrom ? (
        <DetailBackNav
          href={analysisFrom}
          label={analysisFromLabel(analysisFrom)}
          ariaLabel="분석 화면으로 돌아가기"
          Icon={ChartColumn}
        />
      ) : null}
      <PageHeader
        title="상세인원"
        actions={
          <button
            type="button"
            className="excel-download-btn"
            onClick={() => void downloadXlsx()}
            disabled={filtered.length === 0}
          >
            <span className="excel-download-btn-icon" aria-hidden>
              <FileSpreadsheet size={16} strokeWidth={2.25} />
            </span>
            <span className="excel-download-btn-text">
              Excel 다운로드
              <span className="excel-download-btn-count">
                {filtered.length.toLocaleString('ko-KR')}명
              </span>
            </span>
          </button>
        }
      />
      <EmployeeFilterCard
        value={filters}
        onChange={setFilters}
        toolbar={{
          sortField,
          sortOptions: EMPLOYEE_SORT_OPTIONS,
          onSortFieldChange: (field) =>
            setView((prev) => ({
              ...prev,
              sortField: field as EmployeeSortField,
            })),
          sortDirection,
          onSortDirectionToggle: () =>
            setView((prev) => ({
              ...prev,
              sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc',
            })),
          pageSize,
          onPageSizeChange: (size) =>
            setView((prev) => ({ ...prev, pageSize: size, page: 1 })),
        }}
      />

      <Panel
        className="employees-list-panel"
        title="인원 목록"
        description={`조건 결과 ${sorted.length.toLocaleString('ko-KR')}명`}
        bodyClassName="ui-panel-body-flush employees-list-body"
      >
        <div className="employees-list-table-wrap">
          <div className="table-wrap table-wrap-list overflow-hidden">
            <table className="data-table employees-table min-w-[960px] w-full">
              <thead>
                <tr>
                  <th>사번</th>
                  <th>성명</th>
                  <th>근무지</th>
                  <th>공정</th>
                  <th>직급</th>
                  <th>근무현황</th>
                  <th>입사일</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const statusTone =
                    row.employmentStatus === '근무중'
                      ? 'ok'
                      : row.employmentStatus === '휴직'
                        ? 'warn'
                        : 'neutral';
                  return (
                    <tr
                      key={row.id}
                      className="employees-row"
                      tabIndex={0}
                      role="link"
                      aria-label={`${row.name} 상세 보기`}
                      onClick={() => router.push(detailHref(row.id))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          router.push(detailHref(row.id));
                        }
                      }}
                    >
                      <td>
                        <Link
                          href={detailHref(row.id)}
                          className="table-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.employeeNo}
                        </Link>
                      </td>
                      <td>
                        <span className="employees-name">{row.name}</span>
                      </td>
                      <td>
                        <span className="employees-meta">{row.workplace || '-'}</span>
                      </td>
                      <td>
                        <span className="employees-meta">{row.process || '-'}</span>
                      </td>
                      <td>
                        <span className="employees-meta">{row.position || '-'}</span>
                      </td>
                      <td>
                        <span className="table-status" data-tone={statusTone}>
                          {row.employmentStatus || '-'}
                        </span>
                      </td>
                      <td className="num">{row.joinDate ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pageRows.length === 0 ? (
              <p className="employees-list-empty">
                조건에 맞는 인원이 없습니다.
              </p>
            ) : null}
          </div>
        </div>
        <Pager
          embedded
          page={safePage}
          totalPages={totalPages}
          totalCount={sorted.length}
          onPageChange={(p) => setView((prev) => ({ ...prev, page: p }))}
        />
      </Panel>
    </div>
  );
}
