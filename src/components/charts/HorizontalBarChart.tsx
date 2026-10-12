'use client';

import { ChartSummary } from '@/components/charts/ChartSummary';
import { chartColorFor } from '@/lib/vina/chartPalette';
import { formatCount, formatRatio } from '@/lib/vina/format';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface HorizontalBarDatum {
  id: string;
  label: string;
  count: number;
  ratio: number | null;
  color?: string;
}

export interface HorizontalBarChartProps {
  data: HorizontalBarDatum[];
  height?: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** 막대·요약 클릭 시 상세인원으로 이동 */
  getItemHref?: (id: string) => string | null | undefined;
  className?: string;
  showSummary?: boolean;
  showLead?: boolean;
}

export function HorizontalBarChart({
  data,
  height = 280,
  selectedId = null,
  onSelect,
  getItemHref,
  className = '',
  showSummary = true,
  showLead = true,
}: HorizontalBarChartProps) {
  const router = useRouter();
  const interactive = Boolean(onSelect || getItemHref);
  const chartHeight = Math.max(height, Math.min(520, 48 + data.length * 38));
  const colored = data.map((d, index) => ({
    ...d,
    fill: d.color ?? chartColorFor(d.id, index),
  }));

  const handlePick = (id: string) => {
    if (getItemHref) {
      const href = getItemHref(id);
      if (href) router.push(href);
      return;
    }
    onSelect?.(selectedId === id ? null : id);
  };

  return (
    <div
      className={`chart-horizontal-bar chart-surface w-full ${className}`.trim()}
    >
      <div className="chart-horizontal-bar-plot" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={colored}
            layout="vertical"
            margin={{ top: 8, right: 52, left: 2, bottom: 4 }}
            barCategoryGap="28%"
          >
            <defs>
              {colored.map((entry) => (
                <linearGradient
                  key={`grad-${entry.id}`}
                  id={`bar-grad-${entry.id}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor={entry.fill} stopOpacity={0.78} />
                  <stop offset="100%" stopColor={entry.fill} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 8"
              horizontal={false}
              stroke="var(--border)"
              opacity={0.5}
            />
            <XAxis
              type="number"
              tickFormatter={(v) => `${v}`}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={88}
              tick={{ fontSize: 12, fill: 'var(--text)', fontWeight: 650 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'color-mix(in srgb, var(--accent) 7%, transparent)' }}
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
                const payload = item.payload as HorizontalBarDatum;
                return [
                  `${formatCount(count)} (${formatRatio(payload.ratio)})`,
                  payload.label,
                ];
              }}
            />
            <Bar
              dataKey="count"
              radius={[0, 10, 10, 0]}
              maxBarSize={24}
              background={{
                fill: 'color-mix(in srgb, var(--border) 35%, transparent)',
              }}
              cursor={interactive ? 'pointer' : 'default'}
              onClick={(_state, index) => {
                if (!interactive || index === undefined) return;
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
                    fill={`url(#bar-grad-${entry.id})`}
                    fillOpacity={dimmed ? 0.28 : 1}
                    stroke={active ? entry.fill : 'transparent'}
                    strokeWidth={active ? 2 : 0}
                  />
                );
              })}
              <LabelList
                dataKey="count"
                position="right"
                formatter={(value) => {
                  const n = typeof value === 'number' ? value : Number(value ?? 0);
                  return `${n.toLocaleString('ko-KR')}`;
                }}
                style={{
                  fill: 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
    </div>
  );
}
