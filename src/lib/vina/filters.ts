import { EMPLOYMENT_STATUS_ACTIVE, processMatchesScope } from './codes';
import { ageBand, tenureBand } from './dates';
import type { FilterState, GenderCode, Personnel } from './types';

export function createDefaultFilterState(): FilterState {
  return {
    scope: 'all',
    search: '',
    workplaces: [],
    processes: [],
    positions: [],
    genders: [],
    employmentStatuses: [],
    categories: [],
    category1s: [],
    category3s: [],
    category4s: [],
    ageBands: [],
    tenureBands: [],
  };
}

function matchesMultiSelect<T extends string>(
  selected: T[],
  value: T | string,
): boolean {
  if (selected.length === 0) return true;
  return selected.includes(value as T);
}

function matchesEmploymentStatus(
  selected: string[],
  status: string,
): boolean {
  if (selected.length === 0) {
    return EMPLOYMENT_STATUS_ACTIVE.includes(
      status as (typeof EMPLOYMENT_STATUS_ACTIVE)[number],
    );
  }
  return selected.includes(status);
}

function matchesSearch(person: Personnel, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    person.employeeNo.toLowerCase().includes(q) ||
    person.name.toLowerCase().includes(q)
  );
}

export function matchPersonnel(
  person: Personnel,
  filters: FilterState,
): boolean {
  if (!processMatchesScope(person.process, filters.scope)) {
    return false;
  }

  if (!matchesSearch(person, filters.search)) return false;

  if (!matchesMultiSelect(filters.workplaces, person.workplace)) return false;
  if (!matchesMultiSelect(filters.processes, person.process)) return false;
  if (!matchesMultiSelect(filters.positions, person.position)) return false;
  if (
    filters.genders.length > 0 &&
    !filters.genders.includes(person.gender as GenderCode)
  ) {
    return false;
  }
  if (!matchesEmploymentStatus(filters.employmentStatuses, person.employmentStatus)) {
    return false;
  }
  if (!matchesMultiSelect(filters.categories, person.category)) return false;
  if (!matchesMultiSelect(filters.category1s, person.category1)) return false;
  if (!matchesMultiSelect(filters.category3s, person.category3)) return false;
  if (!matchesMultiSelect(filters.category4s, person.category4)) return false;

  const personAgeBand = ageBand(person.ageYears);
  if (
    filters.ageBands.length > 0 &&
    !filters.ageBands.includes(personAgeBand)
  ) {
    return false;
  }

  const personTenureBand = tenureBand(person.tenureTotalMonths);
  if (
    filters.tenureBands.length > 0 &&
    !filters.tenureBands.includes(personTenureBand)
  ) {
    return false;
  }

  return true;
}

export function filterPersonnel(
  personnel: Personnel[],
  filters: FilterState,
): Personnel[] {
  return personnel.filter((p) => matchPersonnel(p, filters));
}
