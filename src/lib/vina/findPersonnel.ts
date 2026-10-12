import { createStablePersonnelId } from './codes';
import type { Personnel } from './types';

/** URL 파라미터(내부 ID 또는 사번)로 인원을 찾습니다. */
export function findPersonnelByParam(
  personnel: Personnel[],
  rawParam: string,
): Personnel | null {
  if (!rawParam) return null;
  let key = rawParam;
  try {
    key = decodeURIComponent(rawParam);
  } catch {
    // keep raw
  }
  key = key.trim();
  if (!key) return null;

  const byId = personnel.find((p) => p.id === key);
  if (byId) return byId;

  const employeeNo = key.replace(/^emp:/i, '').trim();
  if (!employeeNo) return null;

  const stableId = createStablePersonnelId(employeeNo);
  const byStable = personnel.find((p) => p.id === stableId);
  if (byStable) return byStable;

  const upper = employeeNo.toUpperCase();
  return (
    personnel.find((p) => p.employeeNo.trim().toUpperCase() === upper) ?? null
  );
}
