'use client';

import { EmptyState } from '@/components/common/EmptyState';
import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { ResponsiveGrid } from '@/components/common/ResponsiveGrid';
import { GlobalWorkforceFilter } from '@/components/filters/GlobalWorkforceFilter';
import type { ActiveDataset } from '@/lib/vina/types';
import type { FilterState } from '@/lib/vina/types';
import Link from 'next/link';
import type { ReactNode } from 'react';

export interface AnalysisPageShellProps {
  title: string;
  description?: string;
  dataset: ActiveDataset | null;
  loading: boolean;
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  kpiTotal: number;
  kpiWorking: number;
  kpiLeave: number;
  children: ReactNode;
}

export function AnalysisPageShell({
  title,
  description,
  dataset,
  loading,
  filters,
  onFiltersChange,
  kpiTotal,
  kpiWorking,
  kpiLeave,
  children,
}: AnalysisPageShellProps) {
  if (!loading && !dataset) {
    return (
      <>
        <PageHeader title={title} description={description} />
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
    <div className="analysis-page space-y-6">
      <PageHeader title={title} description={description} />
      <GlobalWorkforceFilter value={filters} onChange={onFiltersChange} />
      <ResponsiveGrid preset="kpi">
        <KpiCard
          label="조회 인원"
          tone="accent"
          value={kpiTotal}
          hint="조회조건 반영"
        />
        <KpiCard
          label="근무중"
          tone="ok"
          value={kpiWorking}
          hint="전체 대비 비중"
          share={kpiTotal > 0 ? kpiWorking / kpiTotal : 0}
        />
        <KpiCard
          label="휴직"
          tone="warn"
          value={kpiLeave}
          hint="전체 대비 비중"
          share={kpiTotal > 0 ? kpiLeave / kpiTotal : 0}
        />
      </ResponsiveGrid>
      {children}
    </div>
  );
}
