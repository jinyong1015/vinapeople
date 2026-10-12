'use client';

export interface CrossTableCell {
  rowId: string;
  colId: string;
  count: number;
}

export interface CrossTableProps {
  rowLabels: { id: string; label: string }[];
  colLabels: { id: string; label: string }[];
  cells: CrossTableCell[];
  selected?: { rowId: string; colId: string } | null;
  onCellClick?: (rowId: string, colId: string) => void;
  className?: string;
  /** plain: 더 단순한 테두리·배경 */
  variant?: 'default' | 'plain';
}

function cellKey(rowId: string, colId: string): string {
  return `${rowId}::${colId}`;
}

function PlainCount({
  count,
  tone = 'default',
  interactive = false,
  selected = false,
  onClick,
}: {
  count: number;
  tone?: 'default' | 'total' | 'grand';
  interactive?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const empty = count === 0;
  const className = [
    'plain-count',
    `plain-count-${tone}`,
    empty ? 'is-empty' : '',
    selected ? 'is-selected' : '',
    interactive ? 'is-interactive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const text = empty ? '-' : count.toLocaleString('ko-KR');

  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        data-selected={selected ? 'true' : 'false'}
        onClick={onClick}
      >
        {text}
      </button>
    );
  }

  return <span className={className}>{text}</span>;
}

export function CrossTable({
  rowLabels,
  colLabels,
  cells,
  selected = null,
  onCellClick,
  className = '',
  variant = 'default',
}: CrossTableProps) {
  const map = new Map(cells.map((c) => [cellKey(c.rowId, c.colId), c.count]));
  const plain = variant === 'plain';

  const rowTotal = (rowId: string) =>
    colLabels.reduce((sum, col) => sum + (map.get(cellKey(rowId, col.id)) ?? 0), 0);

  const colTotal = (colId: string) =>
    rowLabels.reduce((sum, row) => sum + (map.get(cellKey(row.id, colId)) ?? 0), 0);

  const grandTotal = rowLabels.reduce((sum, row) => sum + rowTotal(row.id), 0);

  const renderCount = (
    count: number,
    tone: 'default' | 'total' | 'grand' = 'default',
    opts?: { selected?: boolean; onClick?: () => void },
  ) => (
    <PlainCount
      count={count}
      tone={tone}
      interactive={Boolean(onCellClick) && tone === 'default'}
      selected={opts?.selected}
      onClick={opts?.onClick}
    />
  );

  return (
    <div
      className={`table-wrap table-wrap-matrix cross-table ${plain ? 'cross-table-plain' : 'cross-table-numbers'} ${className}`.trim()}
    >
      <table className="data-table matrix-table min-w-[720px]">
        <thead>
          <tr>
            <th scope="col" className="sticky-col cross-corner">
              구분
            </th>
            {colLabels.map((col) => (
              <th key={col.id} scope="col" className="matrix-col-head">
                {col.label}
              </th>
            ))}
            <th scope="col" className="matrix-col-head cross-total-col">
              합계
            </th>
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((row) => (
            <tr key={row.id}>
              <th scope="row" className="sticky-col cross-row-label">
                {row.label}
              </th>
              {colLabels.map((col) => {
                const count = map.get(cellKey(row.id, col.id)) ?? 0;
                const isSelected =
                  selected?.rowId === row.id && selected?.colId === col.id;
                return (
                  <td key={col.id} className="matrix-cell">
                    {renderCount(count, 'default', {
                      selected: isSelected,
                      onClick: () => onCellClick?.(row.id, col.id),
                    })}
                  </td>
                );
              })}
              <td className="matrix-cell cross-total-col">
                {renderCount(rowTotal(row.id), 'total')}
              </td>
            </tr>
          ))}
          <tr className="cross-total-row">
            <th scope="row" className="sticky-col cross-row-label">
              합계
            </th>
            {colLabels.map((col) => (
              <td key={col.id} className="matrix-cell">
                {renderCount(colTotal(col.id), 'total')}
              </td>
            ))}
            <td className="matrix-cell cross-total-col">
              {renderCount(grandTotal, 'grand')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
