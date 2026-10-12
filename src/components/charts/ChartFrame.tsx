import type { ReactNode } from 'react';

export interface ChartFrameProps {
  title: string;
  description?: string;
  meta?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartFrame({
  title,
  description,
  meta,
  actions,
  children,
  className = '',
}: ChartFrameProps) {
  return (
    <section className={`ui-panel chart-frame ${className}`.trim()}>
      <div className="ui-panel-head">
        <div className="min-w-0">
          <h3 className="ui-panel-title">{title}</h3>
          {description ? <p className="ui-panel-desc">{description}</p> : null}
          {meta ? <p className="ui-panel-meta">{meta}</p> : null}
        </div>
        {actions ? <div className="ui-panel-actions">{actions}</div> : null}
      </div>
      <div className="ui-panel-body chart-frame-body">{children}</div>
    </section>
  );
}
