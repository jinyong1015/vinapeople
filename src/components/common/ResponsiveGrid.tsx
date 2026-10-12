import type { ReactNode } from 'react';

type GridPreset = 'kpi' | 'filter' | 'panel-split' | 'office-cards' | 'dense';

const PRESET_CLASS: Record<GridPreset, string> = {
  kpi: 'grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4',
  filter: 'grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3',
  'panel-split': 'grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-5',
  'office-cards': 'grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4',
  dense: 'grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3',
};

export interface ResponsiveGridProps {
  preset?: GridPreset;
  children: ReactNode;
  className?: string;
}

export function ResponsiveGrid({
  preset = 'kpi',
  children,
  className = '',
}: ResponsiveGridProps) {
  return (
    <div className={`responsive-grid grid ${PRESET_CLASS[preset]} ${className}`}>
      {children}
    </div>
  );
}
