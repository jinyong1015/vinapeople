'use client';

import { formatCount, formatRatio } from '@/lib/vina/format';
import type { ReactNode } from 'react';

export type KpiTone = 'default' | 'accent' | 'ok' | 'warn';

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: KpiTone;
  /** 0~1, 있으면 우측 링·하단 비중 표시 */
  share?: number | null;
  onClick?: () => void;
  className?: string;
}

function renderValue(value: ReactNode): ReactNode {
  if (typeof value === 'number') return formatCount(value);
  return value;
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <svg
      className="kpi-card-ring"
      viewBox="0 0 72 72"
      width="72"
      height="72"
      aria-hidden
    >
      <circle className="kpi-card-ring-track" cx="36" cy="36" r={r} />
      <circle
        className="kpi-card-ring-value"
        cx="36"
        cy="36"
        r={r}
        strokeDasharray={`${dash} ${c - dash}`}
        transform="rotate(-90 36 36)"
      />
      <text className="kpi-card-ring-text" x="36" y="39" textAnchor="middle">
        {label}
      </text>
    </svg>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = 'default',
  share = null,
  onClick,
  className = '',
}: KpiCardProps) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';
  const hasShare =
    typeof share === 'number' && Number.isFinite(share) && share >= 0;
  const sharePct = hasShare ? Math.max(0, Math.min(100, share * 100)) : null;

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      className={`kpi-card kpi-card-${tone}${interactive ? ' is-interactive' : ''} ${className}`.trim()}
      onClick={onClick}
    >
      <div className="kpi-card-copy">
        <span className="kpi-card-label">{label}</span>
        <p className="kpi-card-value num">{renderValue(value)}</p>
        {hint ? <p className="kpi-card-hint">{hint}</p> : null}
        {interactive ? <span className="kpi-card-cta">상세 보기</span> : null}
      </div>
      <div className="kpi-card-visual" aria-hidden>
        {sharePct !== null ? (
          <Ring pct={sharePct} label={formatRatio(share)} />
        ) : (
          <span className="kpi-card-orb">
            <span className="kpi-card-orb-inner" />
          </span>
        )}
      </div>
    </Tag>
  );
}
