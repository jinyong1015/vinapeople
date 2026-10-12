import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  kicker?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  kicker = 'VINA WORKFORCE',
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`page-header ${className}`.trim()}>
      <div className="min-w-0">
        {kicker ? <p className="page-header-kicker">{kicker}</p> : null}
        <h1 className="page-header-title">{title}</h1>
        {description ? (
          <p className="page-header-desc">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="page-header-actions">{actions}</div>
      ) : null}
    </header>
  );
}
