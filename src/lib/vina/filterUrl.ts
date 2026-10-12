import type { AgeBand, FilterState, GenderCode, TenureBand, WorkforceScope } from './types';
import { createDefaultFilterState } from './filters';

const ARRAY_KEYS = {
  workplace: 'workplaces',
  process: 'processes',
  position: 'positions',
  gender: 'genders',
  status: 'employmentStatuses',
  category: 'categories',
  category1: 'category1s',
  category3: 'category3s',
  category4: 'category4s',
  age: 'ageBands',
  tenure: 'tenureBands',
} as const;

type ArrayParamKey = keyof typeof ARRAY_KEYS;

function splitList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => decodeURIComponent(part.trim()))
    .filter(Boolean);
}

function appendList(params: URLSearchParams, key: string, values: string[]): void {
  if (values.length === 0) return;
  params.set(key, values.map(encodeURIComponent).join(','));
}

export function parseFilterSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): Partial<FilterState> {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) {
      return params.get(key);
    }
    const raw = params[key];
    if (raw === undefined) return null;
    return Array.isArray(raw) ? (raw[0] ?? null) : raw;
  };

  const partial: Partial<FilterState> = {};

  const scope = get('scope');
  if (scope) partial.scope = scope as WorkforceScope;

  const search = get('q') ?? get('search');
  if (search) partial.search = search;

  for (const [paramKey, field] of Object.entries(ARRAY_KEYS) as [
    ArrayParamKey,
    keyof FilterState,
  ][]) {
    const values = splitList(get(paramKey));
    if (values.length > 0) {
      (partial as Record<string, unknown>)[field] = values;
    }
  }

  return partial;
}

export function serializeFilterParams(filters: Partial<FilterState>): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.scope && filters.scope !== 'all') {
    params.set('scope', filters.scope);
  }
  if (filters.search?.trim()) {
    params.set('q', filters.search.trim());
  }

  appendList(params, 'workplace', filters.workplaces ?? []);
  appendList(params, 'process', filters.processes ?? []);
  appendList(params, 'position', filters.positions ?? []);
  appendList(params, 'gender', (filters.genders ?? []) as string[]);
  appendList(params, 'status', filters.employmentStatuses ?? []);
  appendList(params, 'category', filters.categories ?? []);
  appendList(params, 'category1', filters.category1s ?? []);
  appendList(params, 'category3', filters.category3s ?? []);
  appendList(params, 'category4', filters.category4s ?? []);
  appendList(params, 'age', (filters.ageBands ?? []) as string[]);
  appendList(params, 'tenure', (filters.tenureBands ?? []) as string[]);

  return params;
}

/** URL 드릴다운 값을 기존 FilterState 배열 필드에 병합합니다. */
export function mergeFilterState(
  base: FilterState,
  partial: Partial<FilterState>,
): FilterState {
  const next: FilterState = { ...base, ...partial };

  const mergeArray = <T extends string>(
    baseValues: T[],
    partialValues: T[] | undefined,
  ): T[] => {
    if (!partialValues || partialValues.length === 0) return baseValues;
    return [...new Set([...baseValues, ...partialValues])];
  };

  next.workplaces = mergeArray(base.workplaces, partial.workplaces);
  next.processes = mergeArray(base.processes, partial.processes);
  next.positions = mergeArray(base.positions, partial.positions);
  next.genders = mergeArray(base.genders, partial.genders);
  next.employmentStatuses = mergeArray(
    base.employmentStatuses,
    partial.employmentStatuses,
  );
  next.categories = mergeArray(base.categories, partial.categories);
  next.category1s = mergeArray(base.category1s, partial.category1s);
  next.category3s = mergeArray(base.category3s, partial.category3s);
  next.category4s = mergeArray(base.category4s, partial.category4s);
  next.ageBands = mergeArray(base.ageBands, partial.ageBands);
  next.tenureBands = mergeArray(base.tenureBands, partial.tenureBands);

  if (partial.scope !== undefined) next.scope = partial.scope;
  if (partial.search !== undefined) next.search = partial.search;

  return next;
}

/** 분석→상세인원 드릴다운: URL에 있는 필드는 병합이 아니라 교체합니다. */
export function overlayFilterState(
  base: FilterState,
  partial: Partial<FilterState>,
): FilterState {
  return { ...base, ...partial };
}

const ANALYSIS_FROM_LABELS: Record<string, string> = {
  '/analysis/positions': '직급 분석',
  '/analysis/gender': '성별 분석',
  '/analysis/age': '나이 분석',
  '/analysis/tenure': '근속 분석',
  '/analysis/process-age': '공정별 나이',
};

/** 분석→상세인원 이동 시 복귀용 from 경로만 허용 */
export function sanitizeEmployeesFromPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const path = value.trim();
  if (!path.startsWith('/analysis/')) return null;
  if (path.includes('://') || path.includes('?') || path.includes('#')) {
    return null;
  }
  return path;
}

export function analysisFromLabel(path: string): string {
  return ANALYSIS_FROM_LABELS[path] ?? '분석';
}

export function buildEmployeesHref(
  filters: Partial<FilterState>,
  options?: { from?: string },
): string {
  const params = serializeFilterParams(filters);
  const from = sanitizeEmployeesFromPath(options?.from);
  if (from) params.set('from', from);
  const qs = params.toString();
  return qs ? `/employees?${qs}` : '/employees';
}

export function filtersFromSearchParams(
  params: URLSearchParams,
  base?: FilterState,
): FilterState {
  return mergeFilterState(base ?? createDefaultFilterState(), parseFilterSearchParams(params));
}
