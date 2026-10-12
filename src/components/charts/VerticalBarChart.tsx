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

export interface VerticalBarDatum {
  id: string;
  label: string;
  /** X축에 짧게 쓸 라벨 (없으면 label 사용) */
  shortLabel?: string;
  count: number;
  ratio: number | null;
  color?: string;
}

export interface VerticalBarChartProps {
  data: VerticalBarDatum[];
  height?: number;
  className?: string;
  /** 패널 높이에 맞춰 채울 때 */
  fill?: boolean;
  /** 하단 비율 요약 표시 */
  showSummary?: boolean;
  /** 요약 카드 최다 배지 */
  showLead?: boolean;
  /** 요약 카드 추가 class (레이아웃 등) */
  summaryClassName?: string;
  /** 요약 카드 조밀 모드 */
  summaryCompact?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** 막대·요약 클릭 시 상세인원으로 이동 */
  getItemHref?: (id: string) => string | null | undefined;
}

export function VerticalBarChart({
  data,
  height = 320,
  className = '',
  fill = false,
  showSummary = true,
  showLead = true,
  summaryClassName = '',
  summaryCompact,
  selectedId = null,
  onSelect,
  getItemHref,
}: VerticalBarChartProps) {
  const router = useRouter();
  const interactive = Boolean(onSelect || getItemHref);
  const colored = data.map((d, index) => ({
    ...d,
    axisLabel: d.shortLabel ?? d.label,
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
      className={`chart-vertical-bar chart-surface w-full ${fill ? 'is-fill' : ''} ${className}`.trim()}
      style={fill ? undefined : { height, minHeight: height }}
    >
      <div
        className="chart-vertical-bar-plot"
        style={fill ? undefined : { height, minHeight: height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={colored}
            margin={{
              top: showSummary ? 28 : 20,
              right: 12,
              left: 4,
              bottom: showSummary ? 4 : 0,
            }}
            barCategoryGap="18%"
          >
            <defs>
              {colored.map((entry) => (
                <linearGradient
                  key={`vgrad-${entry.id}`}
                  id={`vbar-grad-${entry.id}`}
                  x1="0"
                  y1="1"
                  x2="0"
                  y2="0"
                >
                  <stop offset="0%" stopColor={entry.fill} stopOpacity={0.78} />
                  <stop offset="100%" stopColor={entry.fill} stopOpacity={1} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 8"
              vertical={false}
              stroke="var(--border)"
              opacity={0.55}
            />
            <XAxis
              type="category"
              dataKey="axisLabel"
              interval={0}
              tick={{ fontSize: 11, fill: 'var(--text)', fontWeight: 650 }}
              axisLine={false}
              tickLine={false}
              height={36}
            />
            <YAxis
              type="number"
              tickFormatter={(v) => `${v}`}
              width={36}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
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
                const payload = item.payload as VerticalBarDatum;
                return [
                  `${formatCount(count)} (${formatRatio(payload.ratio)})`,
                  payload.label,
                ];
              }}
            />
            <Bar
              dataKey="count"
              radius={[10, 10, 0, 0]}
              maxBarSize={52}
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
                    fill={`url(#vbar-grad-${entry.id})`}
                    fillOpacity={dimmed ? 0.3 : 1}
                    stroke={active ? entry.fill : 'transparent'}
                    strokeWidth={active ? 2 : 0}
                  />
                );
              })}
              <LabelList
                dataKey="count"
                position="top"
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
          compact={summaryCompact}
          className={summaryClassName}
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
