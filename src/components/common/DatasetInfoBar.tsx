import type { ActiveDataset } from '@/lib/vina/types';

export interface DatasetInfoBarProps {
  dataset: ActiveDataset | null;
  loading?: boolean;
  className?: string;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function DatasetInfoBar({
  dataset,
  loading = false,
  className = '',
}: DatasetInfoBarProps) {
  if (loading) {
    return (
      <div className={`dataset-info-bar ${className}`.trim()}>
        <span className="dataset-info-chip">데이터 정보를 불러오는 중…</span>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className={`dataset-info-bar ${className}`.trim()}>
        <span className="dataset-info-chip is-muted">반영된 인원 데이터가 없습니다.</span>
      </div>
    );
  }

  return (
    <div className={`dataset-info-bar ${className}`.trim()}>
      <span className="dataset-info-chip">
        <span className="dataset-info-key">기준일</span>
        <span className="dataset-info-val num">{dataset.asOfDate}</span>
      </span>
      <span className="dataset-info-chip">
        <span className="dataset-info-key">최근 반영</span>
        <span className="dataset-info-val">{formatDateTime(dataset.appliedAt)}</span>
      </span>
      <span className="dataset-info-chip dataset-info-chip-file" title={dataset.fileName}>
        <span className="dataset-info-key">파일</span>
        <span className="dataset-info-val">{dataset.fileName}</span>
      </span>
      <span className="dataset-info-chip is-accent">
        <span className="dataset-info-key">인원</span>
        <span className="dataset-info-val num">
          {dataset.personnel.length.toLocaleString('ko-KR')}명
        </span>
      </span>
    </div>
  );
}
