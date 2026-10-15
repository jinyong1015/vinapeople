'use client';

import { Panel } from '@/components/common/Panel';
import { CalendarDays, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AttendanceRow {
  id: string;
  attendanceDate: string;
  departmentSnapshot: string;
  shift: string;
  reason: string;
  personCount: number | null;
  remarks: string;
}

export function EmployeeAttendanceSection({
  employeeNo,
  enabled,
}: {
  employeeNo: string;
  enabled: boolean;
}) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !employeeNo.trim()) {
      setRows([]);
      setTotal(0);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({
      employeeNo: employeeNo.trim(),
      exact: '1',
      page: '1',
      pageSize: '50',
      sort: 'attendance_date',
      dir: 'desc',
    });

    void fetch(`/api/attendance?${params.toString()}`, { credentials: 'include' })
      .then(async (res) => {
        const body = (await res.json()) as {
          rows?: AttendanceRow[];
          total?: number;
        };
        if (!res.ok || cancelled) return;
        setRows(body.rows ?? []);
        setTotal(body.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeNo, enabled]);

  if (!enabled || loading || total === 0) return null;

  return (
    <Panel
      title="근태 현황"
      description={`누적 ${total.toLocaleString('ko-KR')}건 · 최근 ${rows.length}건`}
      bodyClassName="ui-panel-body-flush"
    >
      <div className="table-wrap table-wrap-list overflow-hidden">
        <table className="data-table min-w-[720px] w-full">
          <thead>
            <tr>
              <th>근태 날짜</th>
              <th>부서</th>
              <th>주/야</th>
              <th>사유</th>
              <th>인원수</th>
              <th>비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.attendanceDate}</td>
                <td>{row.departmentSnapshot || '-'}</td>
                <td>{row.shift || '-'}</td>
                <td>{row.reason || '-'}</td>
                <td className="num">
                  {row.personCount === null || row.personCount === undefined
                    ? '-'
                    : row.personCount}
                </td>
                <td>{row.remarks || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="employee-attendance-more">
        <Link
          href={`/attendance?employeeNo=${encodeURIComponent(employeeNo.trim())}`}
          className="employee-attendance-more-link"
        >
          <span className="employee-attendance-more-icon" aria-hidden>
            <CalendarDays size={16} strokeWidth={2} />
          </span>
          <span className="employee-attendance-more-copy">
            <span className="employee-attendance-more-title">전체 근태 보기</span>
            <span className="employee-attendance-more-sub">
              근태 현황에서 이 사번 기록 전체 조회
            </span>
          </span>
          <ChevronRight
            size={16}
            className="employee-attendance-more-chevron"
            aria-hidden
          />
        </Link>
      </div>
    </Panel>
  );
}
