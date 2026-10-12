'use client';

import { AnalysisPageShell } from '@/components/analysis/AnalysisPageShell';
import { useAnalysisFilters } from '@/components/analysis/useAnalysisFilters';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { Panel } from '@/components/common/Panel';
import { buildEmployeesHref } from '@/lib/vina/filterUrl';
import type { AgeBand } from '@/lib/vina/types';

export default function AgeAnalysisPage() {
  const { dataset, loading, filters, setFilters, aggregated } =
    useAnalysisFilters('age');
  const entries = aggregated.ageBands;

  return (
    <AnalysisPageShell
      title="나이 분석"
      dataset={dataset}
      loading={loading}
      filters={filters}
      onFiltersChange={setFilters}
      kpiTotal={aggregated.kpi.total}
      kpiWorking={aggregated.kpi.working}
      kpiLeave={aggregated.kpi.onLeave}
    >
      <Panel title="나이대별 인원">
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
                ageBands: [id as AgeBand],
              },
              { from: '/analysis/age' },
            )
          }
        />
      </Panel>
    </AnalysisPageShell>
  );
}
