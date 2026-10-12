'use client';

import { ChartSummary } from '@/components/charts/ChartSummary';
import { chartColorFor } from '@/lib/vina/chartPalette';
import { formatCount, formatRatio } from '@/lib/vina/format';
import type { CSSProperties } from 'react';

export interface ShareBarDatum {
  id: string;
  label: string;
  count: number;
  ratio: number | null;
  color?: string;
}

export interface ShareBarChartProps {
  data: ShareBarDatum[];
  title?: string;
  className?: string;
  showLead?: boolean;
}

export function ShareBarChart({
  data,
  title = '비중',
  className = '',
  showLead = true,
}: ShareBarChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const segments = data
    .filter((d) => d.count > 0)
    .map((d, index) => {
      const ratio = total > 0 ? d.count / total : 0;
      return {
        ...d,
        ratio,
        color: d.color ?? chartColorFor(d.id, index),
        pctLabel: formatRatio(ratio),
        widthPct: Math.max(ratio * 100, 0),
      };
    });

  return (
    <div className={`share-bar chart-surface ${className}`.trim()}>
      <div className="share-bar-head">
        <span className="share-bar-title">{title}</span>
        <strong className="share-bar-total">
          합계 {total.toLocaleString('ko-KR')}
        </strong>
      </div>

      {segments.length > 0 ? (
        <div
          className="share-bar-track"
          role="img"
          aria-label={segments
            .map((s) => `${s.label} ${s.pctLabel}`)
            .join(', ')}
        >
          {segments.map((seg) => {
            const showInside = seg.widthPct >= 14;
            return (
              <div
                key={seg.id}
                className="share-bar-segment"
                style={
                  {
                    '--share-color': seg.color,
                    width: `${seg.widthPct}%`,
                  } as CSSProperties
                }
                title={`${seg.label} ${formatCount(seg.count)} (${seg.pctLabel})`}
              >
                {showInside ? (
                  <span className="share-bar-segment-label">
                    {seg.label} {seg.pctLabel}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="share-bar-empty">표시할 데이터가 없습니다.</p>
      )}

      <ChartSummary
        showLead={showLead}
        ariaLabel="근무지별 비중 요약"
        items={segments.map((seg) => ({
          id: seg.id,
          label: seg.label,
          count: seg.count,
          ratio: seg.ratio,
          color: seg.color,
        }))}
      />
    </div>
  );
}
