'use client';

import { Panel } from '@/components/common/Panel';
import { buildEmployeesHref } from '@/lib/vina/filterUrl';
import type { FilterState } from '@/lib/vina/types';
import Link from 'next/link';

export interface SelectionPreviewItem {
  id: string;
  label: string;
  count: number;
}

export interface SelectionPreviewPanelProps {
  title: string;
  items: SelectionPreviewItem[];
  filters: FilterState;
  paramKey:
    | 'positions'
    | 'genders'
    | 'ageBands'
    | 'tenureBands'
    | 'processes'
    | 'workplaces';
  selectedId?: string | null;
}

export function SelectionPreviewPanel({
  title,
  items,
  filters,
  paramKey,
  selectedId,
}: SelectionPreviewPanelProps) {
  const ordered = [...items].sort((a, b) => b.count - a.count);
  const top = ordered.slice(0, 10);

  return (
    <Panel title={title} description="최대 10건 · 상세인원으로 이동">
      <ul className="divide-y">
        {top.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
            data-selected={selectedId === item.id ? 'true' : undefined}
          >
            <span className="font-semibold">{item.label}</span>
            <span className="num text-muted">{item.count}명</span>
            <Link
              href={buildEmployeesHref({ ...filters, [paramKey]: [item.id] })}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
            >
              상세인원
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
