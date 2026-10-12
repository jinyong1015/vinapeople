'use client';

export type WorkplaceTab = 'all' | '1공장' | '2공장';

const TABS: { id: WorkplaceTab; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: '1공장', label: '1공장' },
  { id: '2공장', label: '2공장' },
];

export interface WorkplaceTabControlProps {
  value: WorkplaceTab;
  onChange: (value: WorkplaceTab) => void;
  ariaLabel?: string;
  className?: string;
}

export function WorkplaceTabControl({
  value,
  onChange,
  ariaLabel = '근무지 선택',
  className = '',
}: WorkplaceTabControlProps) {
  return (
    <div
      className={`dashboard-chart-tabs ${className}`.trim()}
      role="tablist"
      aria-label={ariaLabel}
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className="dashboard-chart-tab"
          data-active={value === tab.id ? 'true' : 'false'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
