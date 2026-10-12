'use client';

import { AnalysisPageShell } from '@/components/analysis/AnalysisPageShell';
import { useAnalysisFilters } from '@/components/analysis/useAnalysisFilters';
import { CrossTable } from '@/components/charts/CrossTable';
import { Panel } from '@/components/common/Panel';
import { AGE_BAND_LABELS } from '@/lib/vina/dates';
import { buildEmployeesHref } from '@/lib/vina/filterUrl';
import type { AgeBand } from '@/lib/vina/types';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

export default function ProcessAgeAnalysisPage() {
  const router = useRouter();
  const { dataset, loading, filters, setFilters, aggregated } =
    useAnalysisFilters('process-age');

  const model = useMemo(() => {
    const processSet = new Set<string>();
    const ageSet = new Set<AgeBand>();
    for (const cell of aggregated.processAgeMatrix) {
      processSet.add(cell.process);
      ageSet.add(cell.ageBand);
    }
    const ageOrder = (Object.keys(AGE_BAND_LABELS) as AgeBand[]).filter((b) =>
      ageSet.has(b),
    );
    const rowLabels = [...processSet]
      .sort((a, b) => a.localeCompare(b, 'ko'))
      .map((id) => ({ id, label: id }));
    const colLabels = ageOrder.map((id) => ({
      id,
      label: AGE_BAND_LABELS[id],
    }));
    const cells = aggregated.processAgeMatrix.map((c) => ({
      rowId: c.process,
      colId: c.ageBand,
      count: c.count,
    }));
    return { rowLabels, colLabels, cells };
  }, [aggregated.processAgeMatrix]);

  return (
    <AnalysisPageShell
      title="공정별 나이"
      dataset={dataset}
      loading={loading}
      filters={filters}
      onFiltersChange={setFilters}
      kpiTotal={aggregated.kpi.total}
      kpiWorking={aggregated.kpi.working}
      kpiLeave={aggregated.kpi.onLeave}
    >
      <Panel title="공정 × 나이대">
        <CrossTable
          rowLabels={model.rowLabels}
          colLabels={model.colLabels}
          cells={model.cells}
          onCellClick={(process, ageBand) => {
            const count =
              model.cells.find(
                (c) => c.rowId === process && c.colId === ageBand,
              )?.count ?? 0;
            if (count <= 0) return;
            router.push(
              buildEmployeesHref(
                {
                  ...filters,
                  processes: [process],
                  ageBands: [ageBand as AgeBand],
                },
                { from: '/analysis/process-age' },
              ),
            );
          }}
        />
      </Panel>
    </AnalysisPageShell>
  );
}
