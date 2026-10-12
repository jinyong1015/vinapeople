const PAGE_VIEW_PREFIX = 'vina-workforce-page:';

export function loadPageViewState<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PAGE_VIEW_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function savePageViewState<T>(key: string, value: T): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(PAGE_VIEW_PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/** Excel 교체 등으로 화면 로컬 조회 상태를 일괄 비울 때 사용 */
export function clearAllPageViewState(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(PAGE_VIEW_PREFIX)) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}
