'use client';

import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';

export interface QueryFilterShellProps {
  title: string;
  badgeCount?: number;
  onReset?: () => void;
  resetLabel?: string;
  children: ReactNode;
  className?: string;
}

export function QueryFilterShell({
  title,
  badgeCount,
  onReset,
  resetLabel = '초기화',
  children,
  className = '',
}: QueryFilterShellProps) {
  return (
    <section className={`query-filter ${className}`.trim()}>
      <div className="query-filter-header">
        <div className="query-filter-title-row">
          <h2 className="query-filter-title">{title}</h2>
          {typeof badgeCount === 'number' && badgeCount > 0 ? (
            <span className="query-filter-badge" aria-label={`적용 ${badgeCount}개`}>
              {badgeCount}
            </span>
          ) : null}
        </div>
        <div className="query-filter-actions">
          {onReset ? (
            <button
              type="button"
              className="query-filter-action"
              data-tone="reset"
              onClick={onReset}
            >
              <RotateCcw size={14} aria-hidden />
              {resetLabel}
            </button>
          ) : null}
        </div>
      </div>

      <div className="query-filter-body">{children}</div>
    </section>
  );
}
