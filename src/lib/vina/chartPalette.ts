/**
 * 차트용 구분색 팔레트.
 * 비슷한 파란 계열만 쓰지 않고 hue를 분산해 항목 구분을 쉽게 한다.
 */
export const CHART_PALETTE = [
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#ec4899', // pink
  '#6366f1', // indigo
  '#10b981', // emerald
  '#a855f7', // purple
] as const;

/** 성별 등 고정 의미 색 */
export const CHART_SEMANTIC: Record<string, string> = {
  남자: '#3b82f6',
  여자: '#ec4899',
  M: '#3b82f6',
  N: '#ec4899',
  근무중: '#10b981',
  휴직: '#f59e0b',
  '1공장': '#3b82f6',
  '2공장': '#14b8a6',
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * 차트 항목 색.
 * - 성별/근무현황 등 의미 색 우선
 * - 그 외는 인덱스 순으로 hue 분산 (인접 막대 구분)
 */
export function chartColorFor(id: string, index = 0): string {
  const semantic = CHART_SEMANTIC[id];
  if (semantic) return semantic;
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

export function chartColorAt(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

/** 동일 id를 여러 화면에서 같은 색으로 쓰고 싶을 때 */
export function chartColorById(id: string): string {
  const semantic = CHART_SEMANTIC[id];
  if (semantic) return semantic;
  return CHART_PALETTE[hashId(id) % CHART_PALETTE.length];
}
