import type { Personnel } from './types';

export interface CrossTableCellModel {
  rowId: string;
  colId: string;
  count: number;
}

export interface StatusProcessCrossModel {
  rowLabels: { id: string; label: string }[];
  colLabels: { id: string; label: string }[];
  cells: CrossTableCellModel[];
}

export function buildStatusProcessCross(
  people: Personnel[],
): StatusProcessCrossModel {
  const statusSet = new Set<string>();
  const processSet = new Set<string>();
  const counts = new Map<string, number>();

  for (const p of people) {
    const status = p.employmentStatus || '(빈 값)';
    const process = p.process || '(빈 값)';
    statusSet.add(status);
    processSet.add(process);
    const key = `${status}\0${process}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const rowLabels = [...statusSet]
    .sort((a, b) => a.localeCompare(b, 'ko'))
    .map((id) => ({ id, label: id }));
  const colLabels = [...processSet]
    .sort((a, b) => a.localeCompare(b, 'ko'))
    .map((id) => ({ id, label: id }));

  const cells: CrossTableCellModel[] = [];
  for (const row of rowLabels) {
    for (const col of colLabels) {
      const count = counts.get(`${row.id}\0${col.id}`) ?? 0;
      if (count > 0) {
        cells.push({ rowId: row.id, colId: col.id, count });
      }
    }
  }

  return { rowLabels, colLabels, cells };
}
