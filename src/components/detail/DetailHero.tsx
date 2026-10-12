import { StatusBadge } from '@/components/common/StatusBadge';
import type { ReactNode } from 'react';

export interface DetailHeroProps {
  name: string;
  status: string;
  /** 사번 · 근무지 · 공정 등 한 줄 요약 */
  meta?: string;
  photo?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function DetailHero({
  name,
  status,
  meta,
  photo,
  actions,
  className = '',
}: DetailHeroProps) {
  return (
    <header className={`detail-hero detail-hero-profile ${className}`.trim()}>
      <div className="detail-hero-profile-inner">
        {photo ? (
          <div className="detail-hero-photo shrink-0">{photo}</div>
        ) : null}

        <div className="detail-hero-profile-copy min-w-0 flex-1">
          <StatusBadge status={status} />
          <h1 className="detail-hero-title">{name}</h1>
          {meta ? <p className="detail-hero-meta">{meta}</p> : null}
        </div>

        {actions ? (
          <div className="detail-hero-actions">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
