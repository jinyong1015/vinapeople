'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  searchPlaceholder?: string;
  className?: string;
}

function formatSelectionLabel(
  selected: string[],
  options: MultiSelectOption[],
  emptyLabel: string,
): string {
  if (selected.length === 0) return emptyLabel;
  // 모든 선택지가 선택된 경우도 전체와 동일하게 표시
  if (
    options.length > 0 &&
    selected.length === options.length &&
    options.every((o) => selected.includes(o.value))
  ) {
    return emptyLabel;
  }
  const labels = selected
    .map((v) => options.find((o) => o.value === v)?.label ?? v)
    .filter(Boolean);
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
  return `${labels[0]} 외 ${labels.length - 1}개`;
}

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  emptyLabel = '전체',
  searchPlaceholder = '검색',
  className = '',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const display = formatSelectionLabel(selected, options, emptyLabel);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAllFiltered = () => {
    const values = filtered.map((o) => o.value);
    const merged = new Set([...selected, ...values]);
    onChange([...merged]);
  };

  const clearAll = () => onChange([]);

  return (
    <div
      ref={rootRef}
      className={`multi-select query-filter-field relative ${className}`}
      data-open={open ? 'true' : 'false'}
      data-active={selected.length > 0 ? 'true' : 'false'}
    >
      <span className="query-filter-field-label">{label}</span>
      <button
        type="button"
        className="query-filter-input query-filter-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{display}</span>
        <ChevronDown className="text-muted size-4 shrink-0" aria-hidden />
      </button>
      {open ? (
        <div className="filter-popover min-w-[14rem] p-2">
          <div className="filter-popover-search mb-2">
            <Search className="filter-popover-search-icon" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              className="query-filter-input filter-popover-search-input w-full"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              className="text-xs font-semibold underline-offset-2 hover:underline"
              onClick={selectAllFiltered}
            >
              모두 선택
            </button>
            <button
              type="button"
              className="text-muted text-xs font-semibold underline-offset-2 hover:underline"
              onClick={clearAll}
            >
              전체 해제
            </button>
            <span className="text-muted ml-auto text-xs">
              {selected.length}/{options.length}
            </span>
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-52 overflow-auto"
          >
            {filtered.length === 0 ? (
              <li className="text-muted px-2 py-2 text-sm">검색 결과 없음</li>
            ) : (
              filtered.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <li key={opt.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={checked}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                      onClick={() => toggleValue(opt.value)}
                    >
                      <span
                        className="flex size-4 items-center justify-center rounded border"
                        data-active={checked ? 'true' : 'false'}
                      >
                        {checked ? <Check className="size-3" aria-hidden /> : null}
                      </span>
                      {opt.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
