'use client';

import { DonutChart } from '@/components/charts/DonutChart';
import { VerticalBarChart } from '@/components/charts/VerticalBarChart';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import {
  ATTENDANCE_ANALYSIS_WORKPLACES,
  type AttendanceAnalysisResult,
} from '@/lib/vina/attendance/analysis';
import { isSupabaseDataSource } from '@/lib/vina';
import { formatRatio } from '@/lib/vina/format';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendanceAnalysisPage() {
  const supabaseMode = isSupabaseDataSource();
  const [date, setDate] = useState('');
  const [data, setData] = useState<AttendanceAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (selectedDate: string) => {
      if (!supabaseMode) {
        setLoading(false);
        setError('Supabase 모드에서만 근태 분석을 사용할 수 있습니다.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedDate) params.set('date', selectedDate);
        const res = await fetch(
          `/api/analysis/attendance?${params.toString()}`,
          { credentials: 'include' },
        );
        const body = (await res.json()) as AttendanceAnalysisResult & {
          message?: string;
        };
        if (!res.ok) throw new Error(body.message || '조회에 실패했습니다.');
        setData(body);
        if (!selectedDate && body.date) {
          setDate(body.date);
        }
      } catch (err) {
        setData(null);
        setError(err instanceof Error ? err.message : '조회에 실패했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [supabaseMode],
  );

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const factoryPanels = useMemo(() => {
    if (data?.factories?.length) return data.factories;
    return ATTENDANCE_ANALYSIS_WORKPLACES.map((workplace) => ({
      workplace,
      total: 0,
      absent: 0,
      present: 0,
      absentRatio: null as number | null,
    }));
  }, [data]);

  const topBarData = useMemo(() => {
    if (!data?.topAbsentees.length) return [];
    const max = data.topAbsentees[0]?.count ?? 0;
    return data.topAbsentees.map((row) => ({
      id: row.employeeNo,
      label: row.name || row.employeeNo,
      count: row.count,
      ratio: max > 0 ? row.count / max : null,
      color: '#ef4444',
    }));
  }, [data]);

  const activeDate = date || data?.date || todayIso();

  if (!supabaseMode) {
    return (
      <>
        <PageHeader
          title="근태 분석"
          description="공장별 결근 비중과 최근 결근 건수 TOP10을 확인합니다."
        />
        <EmptyState title="Supabase 모드에서만 사용할 수 있습니다" />
      </>
    );
  }

  return (
    <div className="analysis-page space-y-6">
      <PageHeader
        title="근태 분석"
        description="1·2공장 총인원(근무중) 대비 일별 결근 현황과 최근 6개월 결근 건수 TOP10입니다. 사유에 ‘결근’이 포함된 기록만 집계합니다."
      />

      {error ? <p className="manage-error-banner">{error}</p> : null}

      <div className="attendance-analysis-grid">
        {factoryPanels.map((factory) => {
          const total = factory.total;
          const absent = factory.absent;
          const present = factory.present;
          const donut = [
            {
              id: 'absent',
              label: '결근',
              count: absent,
              ratio: total > 0 ? absent / total : null,
              color: '#ef4444',
            },
            {
              id: 'present',
              label: '정상',
              count: present,
              ratio: total > 0 ? present / total : null,
              color: '#10b981',
            },
          ];
          return (
            <Panel
              key={factory.workplace}
              title={`${factory.workplace} 결근 현황`}
              description={`총인원 ${total.toLocaleString('ko-KR')}명 · 결근 ${absent.toLocaleString('ko-KR')}명 (${formatRatio(factory.absentRatio)})`}
              actions={
                <label className="attendance-analysis-date attendance-analysis-date-compact">
                  <span className="attendance-analysis-date-label">날짜</span>
                  <input
                    type="date"
                    className="query-filter-input"
                    value={activeDate}
                    max={data?.latestDate ?? undefined}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
              }
            >
              {loading && !data ? (
                <p className="text-muted text-sm">불러오는 중…</p>
              ) : total === 0 && absent === 0 ? (
                <p className="text-muted text-sm">표시할 인원이 없습니다.</p>
              ) : (
                <DonutChart showLead={false} data={donut} height={240} />
              )}
            </Panel>
          );
        })}
      </div>

      <Panel
        className="attendance-analysis-top"
        title="결근 건수 TOP10"
        description={`최근 ${data?.topAbsenteesMonths ?? 6}개월 · 사유에 ‘결근’ 포함 · 막대 클릭 시 해당 사번 근태 목록`}
      >
        {loading && !data ? (
          <p className="text-muted text-sm">불러오는 중…</p>
        ) : topBarData.length === 0 ? (
          <p className="text-muted text-sm">결근 기록이 없습니다.</p>
        ) : (
          <VerticalBarChart
            showLead={false}
            data={topBarData}
            height={380}
            getItemHref={(id) =>
              `/attendance?employeeNo=${encodeURIComponent(id)}`
            }
          />
        )}
      </Panel>

      {data?.topAbsentees.length ? (
        <Panel
          title="결근 건수 TOP10 상세"
          description="사번을 누르면 인원 상세로 이동합니다."
          bodyClassName="ui-panel-body-flush"
        >
          <div className="table-wrap table-wrap-list overflow-hidden">
            <table className="data-table min-w-[720px] w-full">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>사번</th>
                  <th>사진</th>
                  <th>성명</th>
                  <th>근무지</th>
                  <th>결근 건수</th>
                </tr>
              </thead>
              <tbody>
                {data.topAbsentees.map((row, idx) => (
                  <tr key={row.employeeNo}>
                    <td>{idx + 1}</td>
                    <td>
                      <Link
                        href={`/employees/${encodeURIComponent(row.employeeNo)}?from=${encodeURIComponent('/analysis/attendance')}`}
                        className="table-link"
                      >
                        {row.employeeNo}
                      </Link>
                    </td>
                    <td className="employees-photo-cell">
                      {row.photoPath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.photoPath}
                          alt=""
                          className="employees-list-thumb"
                          loading="lazy"
                        />
                      ) : (
                        <span className="employees-photo-empty" aria-hidden>
                          —
                        </span>
                      )}
                    </td>
                    <td>{row.name || '-'}</td>
                    <td>{row.workplace || '-'}</td>
                    <td>{row.count.toLocaleString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
