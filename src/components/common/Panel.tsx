import type { ReactNode } from 'react';

export interface PanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: PanelProps) {
  return (
    <section className={`ui-panel ${className}`.trim()}>
      {title || actions ? (
        <div className="ui-panel-head">
          <div className="min-w-0">
            {title ? <h2 className="ui-panel-title">{title}</h2> : null}
            {description ? (
              <p className="ui-panel-desc">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="ui-panel-actions">{actions}</div>
          ) : null}
        </div>
      ) : null}
      <div
        className={`ui-panel-body ${title || actions ? '' : 'ui-panel-body-flush'} ${bodyClassName}`.trim()}
      >
        {children}
      </div>
    </section>
  );
}
