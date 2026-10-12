export function formatTenureLabel(
  years: number | null,
  months: number | null,
): string {
  if (years === null && months === null) return '-';
  const y = years ?? 0;
  const m = months ?? 0;
  if (y === 0 && m === 0) return '0개월';
  if (y === 0) return `${m}개월`;
  if (m === 0) return `${y}년`;
  return `${y}년 ${m}개월`;
}

export function formatCount(count: number): string {
  return `${count.toLocaleString('ko-KR')}명`;
}

/** ratio 0~1, null이면 표시용 '-' */
export function formatRatio(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '-';
  return `${(ratio * 100).toFixed(1)}%`;
}
