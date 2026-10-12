import {
  AGE_BAND_LABELS,
  TENURE_BAND_LABELS,
  ageBand,
  tenureBand,
} from './dates';
import type {
  AgeBand,
  FilterState,
  Personnel,
  TenureBand,
} from './types';
import { filterPersonnel } from './filters';

export interface CountEntry {
  key: string;
  label: string;
  count: number;
  ratio: number | null;
}

export interface HeadcountKpi {
  total: number;
  working: number;
  onLeave: number;
  otherActive: number;
  denominator: number;
}

export interface CrossCell {
  workplace: string;
  process: string;
  employmentStatus: string;
  count: number;
}

export interface ProcessAgeCell {
  process: string;
  ageBand: AgeBand;
  count: number;
}

function ratio(count: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return count / denominator;
}

export function computeHeadcountKpi(
  filtered: Personnel[],
): HeadcountKpi {
  const denominator = filtered.length;
  let working = 0;
  let onLeave = 0;
  let otherActive = 0;

  for (const p of filtered) {
    if (p.employmentStatus === '근무중') working += 1;
    else if (p.employmentStatus === '휴직') onLeave += 1;
    else otherActive += 1;
  }

  return {
    total: denominator,
    working,
    onLeave,
    otherActive,
    denominator,
  };
}

function countByField(
  filtered: Personnel[],
  pick: (p: Personnel) => string,
  labelFor?: (key: string) => string,
): CountEntry[] {
  const denominator = filtered.length;
  const map = new Map<string, number>();
  for (const p of filtered) {
    const key = pick(p) || '(빈 값)';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    .map(([key, count]) => ({
      key,
      label: labelFor ? labelFor(key) : key,
      count,
      ratio: ratio(count, denominator),
    }));
}

export function byWorkplace(filtered: Personnel[]): CountEntry[] {
  return countByField(filtered, (p) => p.workplace);
}

export function byProcess(filtered: Personnel[]): CountEntry[] {
  return countByField(filtered, (p) => p.process);
}

export function byPosition(filtered: Personnel[]): CountEntry[] {
  return countByField(filtered, (p) => p.position);
}

export function byGender(filtered: Personnel[]): CountEntry[] {
  return countByField(filtered, (p) => p.gender);
}

export function byAgeBand(filtered: Personnel[]): CountEntry[] {
  const denominator = filtered.length;
  const order: AgeBand[] = [
    'under20',
    '20s',
    '30s',
    '40s',
    '50s',
    '60plus',
    'missingBirth',
  ];
  const map = new Map<AgeBand, number>();
  for (const band of order) map.set(band, 0);
  for (const p of filtered) {
    const band = ageBand(p.ageYears);
    map.set(band, (map.get(band) ?? 0) + 1);
  }
  return order.map((band) => {
    const count = map.get(band) ?? 0;
    return {
      key: band,
      label: AGE_BAND_LABELS[band],
      count,
      ratio: ratio(count, denominator),
    };
  });
}

export function byTenureBand(filtered: Personnel[]): CountEntry[] {
  const denominator = filtered.length;
  const order: TenureBand[] = [
    'under6Months',
    '6monthsTo1Year',
    '1to2Years',
    '2to3Years',
    '3plusYears',
    'missingJoin',
  ];
  const map = new Map<TenureBand, number>();
  for (const band of order) map.set(band, 0);
  for (const p of filtered) {
    const band = tenureBand(p.tenureTotalMonths);
    map.set(band, (map.get(band) ?? 0) + 1);
  }
  return order.map((band) => {
    const count = map.get(band) ?? 0;
    return {
      key: band,
      label: TENURE_BAND_LABELS[band],
      count,
      ratio: ratio(count, denominator),
    };
  });
}

export function crossWorkplaceProcessStatus(
  filtered: Personnel[],
): CrossCell[] {
  const map = new Map<string, CrossCell>();
  for (const p of filtered) {
    const key = `${p.workplace}\0${p.process}\0${p.employmentStatus}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        workplace: p.workplace,
        process: p.process,
        employmentStatus: p.employmentStatus,
        count: 1,
      });
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      a.workplace.localeCompare(b.workplace, 'ko') ||
      a.process.localeCompare(b.process, 'ko') ||
      a.employmentStatus.localeCompare(b.employmentStatus, 'ko'),
  );
}

export function processAgeMatrix(filtered: Personnel[]): ProcessAgeCell[] {
  const map = new Map<string, ProcessAgeCell>();
  for (const p of filtered) {
    const band = ageBand(p.ageYears);
    const key = `${p.process}\0${band}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { process: p.process, ageBand: band, count: 1 });
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      a.process.localeCompare(b.process, 'ko') ||
      a.ageBand.localeCompare(b.ageBand),
  );
}

export interface AggregatedDashboard {
  kpi: HeadcountKpi;
  workplaces: CountEntry[];
  processes: CountEntry[];
  positions: CountEntry[];
  genders: CountEntry[];
  ageBands: CountEntry[];
  tenureBands: CountEntry[];
  crossWorkplaceProcessStatus: CrossCell[];
  processAgeMatrix: ProcessAgeCell[];
}

export function aggregateDashboard(
  personnel: Personnel[],
  filters: FilterState,
): AggregatedDashboard {
  const filtered = filterPersonnel(personnel, filters);
  return {
    kpi: computeHeadcountKpi(filtered),
    workplaces: byWorkplace(filtered),
    processes: byProcess(filtered),
    positions: byPosition(filtered),
    genders: byGender(filtered),
    ageBands: byAgeBand(filtered),
    tenureBands: byTenureBand(filtered),
    crossWorkplaceProcessStatus: crossWorkplaceProcessStatus(filtered),
    processAgeMatrix: processAgeMatrix(filtered),
  };
}
