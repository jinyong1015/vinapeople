'use client';

import { formatCount, formatRatio } from '@/lib/vina/format';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

export interface ChartSummaryItem {
  id: string;
  label: string;
  count: number;
  ratio: number | null;
  color: string;
}

export interface ChartSummaryProps {
  items: ChartSummaryItem[];
  className?: string;
  /** 항목이 많을 때 더 촘촘한 카드 */
  compact?: boolean;
  /** 최다 항목 배지 표시 */
  showLead?: boolean;
  ariaLabel?: string;
  /** 항목 클릭 시 이동할 상세인원 URL */
  getItemHref?: (item: ChartSummaryItem) => string | null | undefined;
}

export function ChartSummary({
  items,
  className = '',
  compact,
  showLead = true,
  ariaLabel = '구간별 요약',
  getItemHref,
}: ChartSummaryProps) {
  if (items.length === 0) return null;

  const dense = compact ?? items.length > 6;
  const leadId = items.reduce((best, cur) =>
    cur.count > best.count ? cur : best,
  ).id;

  return (
    <ul
      className={`chart-summary ${dense ? 'is-compact' : ''} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const isLead = showLead && item.id === leadId && item.count > 0;
        const href = getItemHref?.(item) ?? null;
        const meterPct =
          item.ratio != null && Number.isFinite(item.ratio)
            ? Math.round(Math.min(1, Math.max(0, item.ratio)) * 100)
            : 0;
        const style = {
          '--summary-color': item.color,
          '--summary-meter': `${meterPct}%`,
        } as CSSProperties;

        const body: ReactNode = (
          <>
            <span className="chart-summary-swatch" aria-hidden />
            <span className="chart-summary-label">{item.label}</span>
            <strong className="chart-summary-ratio">
              {formatRatio(item.ratio)}
            </strong>
            <span className="chart-summary-count">
              {formatCount(item.count)}
              {isLead ? <em className="chart-summary-lead">최다</em> : null}
            </span>
            <span className="chart-summary-meter" aria-hidden>
              <span className="chart-summary-meter-fill" />
            </span>
          </>
        );

        return (
          <li key={item.id} className="chart-summary-slot">
            {href ? (
              <Link
                href={href}
                className="chart-summary-item is-link"
                data-lead={isLead ? 'true' : 'false'}
                style={style}
                title={`${item.label} 인원 상세 보기`}
              >
                {body}
              </Link>
            ) : (
              <div
                className="chart-summary-item"
                data-lead={isLead ? 'true' : 'false'}
                style={style}
              >
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
