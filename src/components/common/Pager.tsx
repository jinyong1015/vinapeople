'use client';

export type PageItem = number | 'ellipsis';

/** company 패턴: 5페이지 이하 전부, 앞/중/뒤 구간별 ellipsis */
export function pageItems(current: number, totalPages: number): PageItem[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }

  if (current >= totalPages - 2) {
    return [
      1,
      'ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    'ellipsis',
    current - 1,
    current,
    current + 1,
    'ellipsis',
    totalPages,
  ];
}

export interface PagerProps {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** 패널 하단 푸터용 */
  embedded?: boolean;
}

export function Pager({
  page,
  totalPages,
  totalCount,
  onPageChange,
  className = '',
  embedded = false,
}: PagerProps) {
  const items = pageItems(page, totalPages);
  const safePage = totalPages > 0 ? Math.min(Math.max(1, page), totalPages) : 1;

  return (
    <nav
      className={`pager ${embedded ? 'pager-embedded' : ''} ${className}`.trim()}
      aria-label="페이지"
    >
      <span className="pager-total">
        전체 <strong>{totalCount.toLocaleString('ko-KR')}</strong>명
        {totalPages > 0 ? (
          <span className="pager-page-meta">
            · {safePage}/{totalPages} 페이지
          </span>
        ) : null}
      </span>
      <div className="pager-controls">
        <button
          type="button"
          className="pager-nav"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
        >
          처음
        </button>
        <button
          type="button"
          className="pager-nav"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
        >
          이전
        </button>
        <div className="pager-pages">
          {items.map((item, index) =>
            item === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="pager-ellipsis"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className="pager-page num"
                data-active={item === safePage ? 'true' : undefined}
                aria-current={item === safePage ? 'page' : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </button>
            ),
          )}
        </div>
        <button
          type="button"
          className="pager-nav"
          disabled={safePage >= totalPages || totalPages === 0}
          onClick={() => onPageChange(safePage + 1)}
        >
          다음
        </button>
        <button
          type="button"
          className="pager-nav"
          disabled={safePage >= totalPages || totalPages === 0}
          onClick={() => onPageChange(totalPages)}
        >
          마지막
        </button>
      </div>
    </nav>
  );
}
