'use client';

import { useWorkforce } from '@/components/providers/WorkforceProvider';
import {
  aggregateDashboard,
  createDefaultFilterState,
  filterPersonnel,
  loadPageViewState,
  savePageViewState,
} from '@/lib/vina';
import type { FilterState } from '@/lib/vina/types';
import { useEffect, useMemo, useState } from 'react';

export function useAnalysisFilters(pageKey: string) {
  const storageKey = `analysis-${pageKey}`;
  const { dataset, personnel, loading } = useWorkforce();

  const [filters, setFilters] = useState<FilterState>(() => {
    const saved = loadPageViewState<{ filters: FilterState }>(storageKey);
    return saved?.filters ?? createDefaultFilterState();
  });

  useEffect(() => {
    savePageViewState(storageKey, { filters });
  }, [filters, storageKey]);

  const filtered = useMemo(
    () => filterPersonnel(personnel, filters),
    [personnel, filters],
  );

  const aggregated = useMemo(
    () => aggregateDashboard(personnel, filters),
    [personnel, filters],
  );

  return { dataset, personnel, loading, filters, setFilters, filtered, aggregated };
}
