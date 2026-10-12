'use client';

import { ChartSummary } from '@/components/charts/ChartSummary';
import { chartColorFor } from '@/lib/vina/chartPalette';
import { formatCount, formatRatio } from '@/lib/vina/format';
import { useRouter } from 'next/navigation';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export interface DonutDatum {
  id: string;
  label: string;
  count: number;
  ratio: number | null;
  color?: string;
}

export interface DonutChartProps {
  data: DonutDatum[];
  height?: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** 조각·요약 클릭 시 상세인원으로 이동 */
  getItemHref?: (id: string) => string | null | undefined;
  innerRadius?: number;
  outerRadius?: number;
  className?: string;
  showLegend?: boolean;
  showSummary?: boolean;
  showLead?: boolean;
}

export function DonutChart({
  data,
  height = 280,
  selectedId = null,
  onSelect,
  getItemHref,
  innerRadius = 66,
  outerRadius = 100,
  className = '',
  showLegend = false,
  showSummary = true,
  showLead = true,
}: DonutChartProps) {
  const router = useRouter();
  const interactive = Boolean(onSelect || getItemHref);
  const colored = data.map((d, index) => ({
    ...d,
    fill: d.color ?? chartColorFor(d.id, index),
  }));
  const total = colored.reduce((sum, d) => d.count + sum, 0);

  const handlePick = (id: string) => {
    if (getItemHref) {
      const href = getItemHref(id);
      if (href) router.push(href);
      return;
    }
    onSelect?.(selectedId === id ? null : id);
  };

  return (
    <div className={`chart-donut chart-surface ${className}`.trim()}>
      <div className="chart-donut-plot" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={colored}
              dataKey="count"
              nameKey="label"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={3}
              cornerRadius={5}
              strokeWidth={3}
              onClick={(_, index) => {
                if (!interactive) return;
                const item = colored[index];
                if (!item) return;
                handlePick(item.id);
              }}
            >
              {colored.map((entry) => {
                const active = selectedId === entry.id;
                const dimmed = Boolean(selectedId) && !active;
                return (
                  <Cell
                    key={entry.id}
                    fill={entry.fill}
                    fillOpacity={dimmed ? 0.28 : 1}
                    stroke={active ? entry.fill : 'var(--card, #fff)'}
                    strokeWidth={3}
                    style={{
                      cursor: interactive ? 'pointer' : 'default',
                      filter: active
                        ? 'drop-shadow(0 4px 10px rgba(15,23,42,0.18))'
                        : undefined,
                    }}
                  />
                );
              })}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                boxShadow: '0 14px 36px rgba(15,23,42,0.14)',
                fontSize: 13,
                padding: '10px 12px',
              }}
              formatter={(value, _name, item) => {
                const count = typeof value === 'number' ? value : Number(value ?? 0);
                const payload = item.payload as DonutDatum;
                return [
                  `${formatCount(count)} (${formatRatio(payload.ratio)})`,
                  payload.label,
                ];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="chart-donut-center" aria-hidden>
          <strong>{total.toLocaleString('ko-KR')}</strong>
          <span>명</span>
        </div>
      </div>

      {showSummary ? (
        <ChartSummary
          showLead={showLead}
          getItemHref={
            getItemHref
              ? (item) => getItemHref(item.id)
              : undefined
          }
          items={colored.map((d) => ({
            id: d.id,
            label: d.label,
            count: d.count,
            ratio: d.ratio,
            color: d.fill,
          }))}
        />
      ) : null}

      {showLegend ? (
        <ul className="chart-legend" aria-label="범례">
          {colored.map((entry) => {
            const active = selectedId === entry.id;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className="chart-legend-item"
                  data-active={active ? 'true' : 'false'}
                  data-dimmed={selectedId && !active ? 'true' : 'false'}
                  onClick={() => {
                    if (!interactive) return;
                    handlePick(entry.id);
                  }}
                  disabled={!interactive}
                >
                  <span
                    className="chart-legend-swatch"
                    style={{ background: entry.fill }}
                    aria-hidden
                  />
                  <span className="chart-legend-label">{entry.label}</span>
                  <span className="chart-legend-value">
                    {formatCount(entry.count)}
                    <span className="chart-legend-ratio">
                      {formatRatio(entry.ratio)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
