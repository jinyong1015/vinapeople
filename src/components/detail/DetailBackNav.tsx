'use client';

import { ArrowLeft, ChevronRight, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

export type DetailBackMeta = {
  label: string;
  value: string;
};

export interface DetailBackNavProps {
  href: string;
  label?: string;
  ariaLabel?: string;
  Icon?: LucideIcon;
  metas?: DetailBackMeta[];
  className?: string;
}

export function DetailBackNav({
  href,
  label = '인원 관리',
  ariaLabel = '인원 관리로 돌아가기',
  Icon = Users,
  metas = [],
  className = '',
}: DetailBackNavProps) {
  const desktopMetas = metas.slice(0, 2);

  return (
    <nav
      aria-label={ariaLabel}
      className={`sticky top-[var(--app-header-offset,4.5rem)] z-20 ${className}`.trim()}
    >
      <Link href={href} className="detail-back group">
        <span className="detail-back-back-icon" aria-hidden>
          <ArrowLeft size={18} strokeWidth={2.5} />
        </span>
        <span className="detail-back-type-icon" aria-hidden>
          <Icon size={18} strokeWidth={2.25} />
        </span>

        <span className="min-w-0 shrink">
          <span className="detail-back-kicker">돌아가기</span>
          <span className="detail-back-label">{label}</span>
        </span>

        <span className="detail-back-trailing">
          {desktopMetas.map((meta) => (
            <span
              key={`${meta.label}:${meta.value}`}
              className="detail-back-meta"
            >
              <span className="detail-back-meta-label">{meta.label}</span>
              <span className="detail-back-meta-value" title={meta.value}>
                {meta.value}
              </span>
            </span>
          ))}
          <ChevronRight size={18} className="detail-back-chevron" aria-hidden />
        </span>
      </Link>

      {metas.length > 0 ? (
        <p className="detail-back-mobile-metas">
          {metas.map((meta, idx) => (
            <span key={`${meta.label}:${meta.value}`}>
              {idx > 0 ? <span className="mx-1.5 opacity-40">·</span> : null}
              <span>
                {meta.label}{' '}
                <span className="font-semibold text-ink">{meta.value}</span>
              </span>
            </span>
          ))}
        </p>
      ) : null}
    </nav>
  );
}
