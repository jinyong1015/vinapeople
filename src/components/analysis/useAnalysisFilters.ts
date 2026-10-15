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

  const [filters, setFilters] = useState<FilterState>(createDefaultFilterState);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const saved = loadPageViewState<{ filters: FilterState }>(storageKey);
    if (saved?.filters) setFilters(saved.filters);
    setStorageReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageReady) return;
    savePageViewState(storageKey, { filters });
  }, [filters, storageKey, storageReady]);

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
