'use client';

import { VerticalBarChart } from '@/components/charts/VerticalBarChart';
import { chartColorFor } from '@/lib/vina/chartPalette';
import { formatCount, formatRatio } from '@/lib/vina/format';
import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export interface SplitRankDatum {
  id: string;
  label: string;
  count: number;
  ratio: number | null;
  color?: string;
}

export interface SplitRankChartProps {
  data: SplitRankDatum[];
  className?: string;
  /** 차트에 표시할 최대 항목 수 (나머지 요약만) */
  chartLimit?: number;
}

function shortLabel(label: string, max = 6): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function SplitRankChart({
  data,
  className = '',
  chartLimit = 12,
}: SplitRankChartProps) {
  const ranked = useMemo(() => {
    return [...data]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ko'))
      .map((d, index) => ({
        ...d,
        rank: index + 1,
        color: d.color ?? chartColorFor(d.id, index),
        shortLabel: shortLabel(d.label),
      }));
  }, [data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [plotHeight, setPlotHeight] = useState(280);

  useEffect(() => {
    setSelectedId(null);
  }, [data]);

  /** 오른쪽 요약 높이에 맞춰 왼쪽 그래프를 늘림 */
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const apply = () => {
      const note = el.querySelector('.chart-split-note');
      const noteH = note
        ? note.getBoundingClientRect().height + 8
        : 0;
      const next = Math.max(240, Math.round(el.clientHeight - noteH));
      setPlotHeight((prev) => (prev === next ? prev : next));
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ranked.length, chartLimit]);

  const focus =
    ranked.find((d) => d.id === selectedId) ?? ranked[0] ?? null;
  const chartData = ranked.slice(0, chartLimit);

  if (ranked.length === 0) {
    return (
      <p className="text-muted text-sm">표시할 공정 데이터가 없습니다.</p>
    );
  }

  return (
    <div className={`chart-split ${className}`.trim()}>
      <div className="chart-split-main" ref={mainRef}>
        <VerticalBarChart
          height={plotHeight}
          showSummary={false}
          selectedId={selectedId}
          onSelect={setSelectedId}
          data={chartData.map((d) => ({
            id: d.id,
            label: d.label,
            shortLabel: d.shortLabel,
            count: d.count,
            ratio: d.ratio,
            color: d.color,
          }))}
        />
        {ranked.length > chartLimit ? (
          <p className="chart-split-note">
            차트는 상위 {chartLimit}개 · 전체 {ranked.length}개
          </p>
        ) : null}
      </div>

      <aside className="chart-split-side" aria-label="공정 요약">
        {focus ? (
          <div
            className="chart-split-focus"
            style={{ '--split-color': focus.color } as CSSProperties}
          >
            <span className="chart-split-focus-rank" aria-hidden>
              {focus.rank}
            </span>
            <div className="chart-split-focus-body">
              <p className="chart-split-focus-label">{focus.label}</p>
              <div className="chart-split-focus-metrics">
                <div className="chart-split-metric">
                  <span>비율</span>
                  <strong>{formatRatio(focus.ratio)}</strong>
                </div>
                <div className="chart-split-metric">
                  <span>인원</span>
                  <strong>{formatCount(focus.count)}</strong>
                </div>
                <div className="chart-split-metric">
                  <span>순위</span>
                  <strong>{focus.rank}위</strong>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="chart-split-rank-head">
          <span>순위</span>
          <span>{ranked.length}개</span>
        </div>
        <ol
          className={`chart-split-rank ${ranked.length > 6 ? 'is-dense' : ''}`.trim()}
        >
          {ranked.map((item) => {
            const active = focus?.id === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="chart-split-rank-item"
                  data-active={active ? 'true' : 'false'}
                  style={{ '--split-color': item.color } as CSSProperties}
                  onClick={() =>
                    setSelectedId(active ? null : item.id)
                  }
                >
                  <span className="chart-split-rank-badge" aria-hidden>
                    {item.rank}
                  </span>
                  <span className="chart-split-rank-copy">
                    <span className="chart-split-rank-label">
                      {item.label}
                      {active ? (
                        <em className="chart-split-rank-selected">선택</em>
                      ) : null}
                    </span>
                    <span className="chart-split-rank-count">
                      {formatCount(item.count)}
                    </span>
                  </span>
                  <span className="chart-split-rank-ratio">
                    {formatRatio(item.ratio)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
