'use client';

import { AnalysisPageShell } from '@/components/analysis/AnalysisPageShell';
import { useAnalysisFilters } from '@/components/analysis/useAnalysisFilters';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { Panel } from '@/components/common/Panel';
import { buildEmployeesHref } from '@/lib/vina/filterUrl';
import type { TenureBand } from '@/lib/vina/types';

export default function TenureAnalysisPage() {
  const { dataset, loading, filters, setFilters, aggregated } =
    useAnalysisFilters('tenure');
  const entries = aggregated.tenureBands;

  return (
    <AnalysisPageShell
      title="근속 분석"
      dataset={dataset}
      loading={loading}
      filters={filters}
      onFiltersChange={setFilters}
      kpiTotal={aggregated.kpi.total}
      kpiWorking={aggregated.kpi.working}
      kpiLeave={aggregated.kpi.onLeave}
    >
      <Panel title="근속 구간별 인원">
        <HorizontalBarChart
          data={entries.map((e) => ({
            id: e.key,
            label: e.label,
            count: e.count,
            ratio: e.ratio,
          }))}
          getItemHref={(id) =>
            buildEmployeesHref(
              {
                ...filters,
                tenureBands: [id as TenureBand],
              },
              { from: '/analysis/tenure' },
            )
          }
        />
      </Panel>
    </AnalysisPageShell>
  );
}
