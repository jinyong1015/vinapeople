'use client';

import { AnalysisPageShell } from '@/components/analysis/AnalysisPageShell';
import { useAnalysisFilters } from '@/components/analysis/useAnalysisFilters';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { Panel } from '@/components/common/Panel';
import { buildEmployeesHref } from '@/lib/vina/filterUrl';

export default function PositionsAnalysisPage() {
  const { dataset, loading, filters, setFilters, aggregated } =
    useAnalysisFilters('positions');
  const entries = aggregated.positions;

  return (
    <AnalysisPageShell
      title="직급 분석"
      dataset={dataset}
      loading={loading}
      filters={filters}
      onFiltersChange={setFilters}
      kpiTotal={aggregated.kpi.total}
      kpiWorking={aggregated.kpi.working}
      kpiLeave={aggregated.kpi.onLeave}
    >
      <Panel title="직급별 인원">
        <HorizontalBarChart
          data={entries.map((e) => ({
            id: e.key,
            label: e.label,
            count: e.count,
            ratio: e.ratio,
          }))}
          getItemHref={(id) =>
            buildEmployeesHref(
              { ...filters, positions: [id] },
              { from: '/analysis/positions' },
            )
          }
        />
      </Panel>
    </AnalysisPageShell>
  );
}
