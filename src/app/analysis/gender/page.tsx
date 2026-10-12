'use client';

import { AnalysisPageShell } from '@/components/analysis/AnalysisPageShell';
import { useAnalysisFilters } from '@/components/analysis/useAnalysisFilters';
import { DonutChart } from '@/components/charts/DonutChart';
import { Panel } from '@/components/common/Panel';
import { buildEmployeesHref } from '@/lib/vina/filterUrl';
import type { GenderCode } from '@/lib/vina/types';

export default function GenderAnalysisPage() {
  const { dataset, loading, filters, setFilters, aggregated } =
    useAnalysisFilters('gender');
  const entries = aggregated.genders;

  return (
    <AnalysisPageShell
      title="성별 분석"
      dataset={dataset}
      loading={loading}
      filters={filters}
      onFiltersChange={setFilters}
      kpiTotal={aggregated.kpi.total}
      kpiWorking={aggregated.kpi.working}
      kpiLeave={aggregated.kpi.onLeave}
    >
      <Panel title="성별 분포">
        <DonutChart
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
                genders: [id as GenderCode],
              },
              { from: '/analysis/gender' },
            )
          }
        />
      </Panel>
    </AnalysisPageShell>
  );
}
