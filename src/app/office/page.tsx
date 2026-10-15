'use client';

import { OfficeOrgChart } from '@/components/office/OfficeOrgChart';
import { EmployeePhotoFrame } from '@/components/detail/EmployeePhotoFrame';
import { AdminUploadCta } from '@/components/common/AdminUploadCta';
import { EmptyState } from '@/components/common/EmptyState';
import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { ResponsiveGrid } from '@/components/common/ResponsiveGrid';
import { StatusBadge } from '@/components/common/StatusBadge';
import { GlobalWorkforceFilter } from '@/components/filters/GlobalWorkforceFilter';
import { useWorkforce } from '@/components/providers/WorkforceProvider';
import {
  buildOfficeOrgChart,
  computeHeadcountKpi,
  createDefaultFilterState,
  displayDepartment,
  filterPersonnel,
  loadPageViewState,
  savePageViewState,
} from '@/lib/vina';
import type { FilterState } from '@/lib/vina/types';
import { Network, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const OFFICE_FILTERS_KEY = 'office-filters';
const OFFICE_VIEW_KEY = 'office-view-mode';

type OfficeViewMode = 'org' | 'list';

function officeDefaultFilters(): FilterState {
  return { ...createDefaultFilterState(), scope: 'office' };
}

export default function OfficePage() {
  const { dataset, personnel, loading } = useWorkforce();

  const [filters, setFilters] = useState<FilterState>(officeDefaultFilters);
  const [viewMode, setViewMode] = useState<OfficeViewMode>('org');
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const savedFilters = loadPageViewState<FilterState>(OFFICE_FILTERS_KEY);
    const savedView = loadPageViewState<OfficeViewMode>(OFFICE_VIEW_KEY);
    if (savedFilters) setFilters({ ...savedFilters, scope: 'office' });
    if (savedView === 'list' || savedView === 'org') setViewMode(savedView);
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    savePageViewState(OFFICE_FILTERS_KEY, filters);
  }, [filters, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    savePageViewState(OFFICE_VIEW_KEY, viewMode);
  }, [viewMode, storageReady]);

  const filtered = useMemo(
    () => filterPersonnel(personnel, filters),
    [personnel, filters],
  );
  const kpi = useMemo(() => computeHeadcountKpi(filtered), [filtered]);

  const sorted = useMemo(
    () =>
      [...filtered].sort(
        (a, b) =>
          a.name.localeCompare(b.name, 'ko') ||
          a.employeeNo.localeCompare(b.employeeNo, 'ko', { numeric: true }),
      ),
    [filtered],
  );

  const orgRoot = useMemo(() => buildOfficeOrgChart(filtered), [filtered]);

  const hasDepartment = useMemo(
    () => filtered.some((p) => Boolean(displayDepartment(p))),
    [filtered],
  );

  if (!loading && !dataset) {
    return (
      <>
        <PageHeader title="사무직 인원" />
        <EmptyState
          title="반영된 인원 데이터가 없습니다"
          actions={<AdminUploadCta />}
        />
      </>
    );
  }

  return (
    <div className="office-page space-y-6">
      <PageHeader title="사무직 인원" />
      <GlobalWorkforceFilter
        officeMode
        value={filters}
        onChange={(next) => setFilters({ ...next, scope: 'office' })}
      />

      <ResponsiveGrid preset="kpi">
        <KpiCard
          label="사무직 인원"
          tone="accent"
          value={kpi.total}
          hint="공정=사무직"
        />
        <KpiCard
          label="근무중"
          tone="ok"
          value={kpi.working}
          hint="전체 대비 비중"
          share={kpi.total > 0 ? kpi.working / kpi.total : 0}
        />
        <KpiCard
          label="휴직"
          tone="warn"
          value={kpi.onLeave}
          hint="전체 대비 비중"
          share={kpi.total > 0 ? kpi.onLeave / kpi.total : 0}
        />
      </ResponsiveGrid>

      <div className="office-view-switch">
        <div className="flex flex-wrap items-center gap-3">
          <p className="office-view-switch-label">보기 전환</p>
          <div className="office-view-tabs" role="tablist" aria-label="보기 전환">
            <button
              type="button"
              role="tab"
              className="office-view-tab"
              data-active={viewMode === 'org' ? 'true' : 'false'}
              aria-selected={viewMode === 'org'}
              onClick={() => setViewMode('org')}
            >
              <span className="office-view-tab-icon" aria-hidden>
                <Network size={17} strokeWidth={2.4} />
              </span>
              조직도
            </button>
            <button
              type="button"
              role="tab"
              className="office-view-tab"
              data-active={viewMode === 'list' ? 'true' : 'false'}
              aria-selected={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            >
              <span className="office-view-tab-icon" aria-hidden>
                <Users size={17} strokeWidth={2.4} />
              </span>
              인원 목록
            </button>
          </div>
        </div>
        {!hasDepartment && viewMode === 'org' && !loading ? (
          <p className="ui-notice m-0 text-xs">
            부서 열이 비어 있습니다. 부서가 포함된 Excel을 다시 업로드하면 조직도가
            채워집니다.
          </p>
        ) : null}
      </div>

      {viewMode === 'org' ? (
        <Panel
          title="사무직 조직도"
          description="법인장 아래 부서별 소속·보고 관계를 표시합니다. 카드를 클릭하면 상세로 이동합니다."
        >
          <div className="org-chart-panel">
            <OfficeOrgChart root={orgRoot} />
          </div>
        </Panel>
      ) : (
        <>
          <ResponsiveGrid preset="office-cards">
            {sorted.map((person) => (
              <Link
                key={person.id}
                href={`/employees/${person.id}?from=office`}
                className="office-person-card"
              >
                <div className="office-person-card-inner">
                  <EmployeePhotoFrame
                    variant="compact"
                    photoPath={person.photoPath}
                    name={person.name}
                  />
                  <div className="office-person-card-copy min-w-0">
                    <p className="office-person-name">{person.name}</p>
                    <p className="text-muted num text-sm">{person.employeeNo}</p>
                    <p className="mt-2 text-sm font-semibold">
                      {displayDepartment(person) || person.position}
                    </p>
                    <p className="text-muted text-sm">
                      {person.position}
                      {displayDepartment(person)
                        ? ` · ${displayDepartment(person)}`
                        : ''}
                    </p>
                    <p className="text-muted text-sm">{person.workplace}</p>
                    <p className="text-muted text-xs">
                      입사 {person.joinDate ?? '-'}
                    </p>
                    <div className="mt-2">
                      <StatusBadge status={person.employmentStatus} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </ResponsiveGrid>

          {sorted.length === 0 && !loading ? (
            <EmptyState title="조건에 맞는 사무직 인원이 없습니다" />
          ) : null}
        </>
      )}
    </div>
  );
}
