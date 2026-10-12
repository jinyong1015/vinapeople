import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actions,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      <div className="empty-state-icon" aria-hidden="true" />
      <h3 className="empty-state-title">{title}</h3>
      {description ? (
        <p className="empty-state-desc">{description}</p>
      ) : null}
      {actions ? <div className="empty-state-actions">{actions}</div> : null}
    </div>
  );
}
