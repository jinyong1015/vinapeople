import type { EmploymentStatus } from '@/lib/vina/types';

export interface StatusBadgeProps {
  status: string;
  className?: string;
}

function resolveTone(status: string): 'ok' | 'warn' | 'neutral' {
  if (status === '근무중') return 'ok';
  if (status === '휴직') return 'warn';
  if (status === '퇴사') return 'neutral';
  return 'neutral';
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const tone = resolveTone(status);
  const employment = status as EmploymentStatus;

  return (
    <span
      className={`status-badge inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
      data-tone={tone}
    >
      {employment || status}
    </span>
  );
}
