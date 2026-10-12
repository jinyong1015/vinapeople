'use client';

import { CrossTable } from '@/components/charts/CrossTable';
import { DonutChart } from '@/components/charts/DonutChart';
import { HorizontalBarChart } from '@/components/charts/HorizontalBarChart';
import { ShareBarChart } from '@/components/charts/ShareBarChart';
import { SplitRankChart } from '@/components/charts/SplitRankChart';
import { VerticalBarChart } from '@/components/charts/VerticalBarChart';
import { EmptyState } from '@/components/common/EmptyState';
import { KpiCard } from '@/components/common/KpiCard';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { ResponsiveGrid } from '@/components/common/ResponsiveGrid';
import {
  WorkplaceTabControl,
  type WorkplaceTab,
} from '@/components/common/WorkplaceTabControl';
import { useWorkforce } from '@/components/providers/WorkforceProvider';
import {
  aggregateDashboard,
  createDefaultFilterState,
  filterPersonnel,
  type AggregatedDashboard,
} from '@/lib/vina';
import { AGE_BAND_LABELS, TENURE_SHORT_LABELS } from '@/lib/vina/dates';
import { buildStatusProcessCross } from '@/lib/vina/statusProcessCross';
import type { AgeBand, FilterState } from '@/lib/vina/types';
import { ArrowRight, Briefcase, Calendar, Clock, Users, VenusAndMars } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type ChartKey =
  | 'gender'
  | 'age'
  | 'tenure'
  | 'processAge'
  | 'statusProcess';

type StatusProcessView = 'table' | 'chart';

function buildProcessAgeModel(
  cells: { process: string; ageBand: AgeBand; count: number }[],
) {
  const processSet = new Set<string>();
  const ageSet = new Set<AgeBand>();
  for (const cell of cells) {
    processSet.add(cell.process);
    ageSet.add(cell.ageBand);
  }
  const ageOrder = (Object.keys(AGE_BAND_LABELS) as AgeBand[]).filter((b) =>
    ageSet.has(b),
  );
  return {
    rowLabels: [...processSet]
      .sort((a, b) => a.localeCompare(b, 'ko'))
      .map((id) => ({ id, label: id })),
    colLabels: ageOrder.map((id) => ({ id, label: AGE_BAND_LABELS[id] })),
    cells: cells.map((c) => ({
      rowId: c.process,
      colId: c.ageBand,
      count: c.count,
    })),
  };
}

function withWorkplace(
  filters: FilterState,
  workplace: WorkplaceTab,
): FilterState {
  if (workplace === 'all') return filters;
  return { ...filters, workplaces: [workplace] };
}

export default function DashboardPage() {
  const { dataset, personnel, loading } = useWorkforce();
  const filters = useMemo(() => createDefaultFilterState(), []);

  const [chartTabs, setChartTabs] = useState<Record<ChartKey, WorkplaceTab>>({
    gender: 'all',
    age: 'all',
    tenure: 'all',
    processAge: 'all',
    statusProcess: 'all',
  });
  const [statusProcessView, setStatusProcessView] =
    useState<StatusProcessView>('table');

  const aggregated = useMemo(
    () => aggregateDashboard(personnel, filters),
    [personnel, filters],
  );

  const filtered = useMemo(
    () => filterPersonnel(personnel, filters),
    [personnel, filters],
  );

  const byWorkplaceAgg = useMemo(() => {
    const all = aggregated;
    const plant1 = aggregateDashboard(
      personnel,
      withWorkplace(filters, '1공장'),
    );
    const plant2 = aggregateDashboard(
      personnel,
      withWorkplace(filters, '2공장'),
    );
    return {
      all,
      '1공장': plant1,
      '2공장': plant2,
    } satisfies Record<WorkplaceTab, AggregatedDashboard>;
  }, [aggregated, personnel, filters]);

  const pickAgg = (key: ChartKey) => byWorkplaceAgg[chartTabs[key]];

  const processAgeModel = useMemo(() => {
    const agg = byWorkplaceAgg[chartTabs.processAge];
    return buildProcessAgeModel(agg.processAgeMatrix);
  }, [byWorkplaceAgg, chartTabs.processAge]);

  const statusProcessModel = useMemo(() => {
    const tab = chartTabs.statusProcess;
    const rows =
      tab === 'all'
        ? filtered
        : filtered.filter((p) => p.workplace === tab);
    return buildStatusProcessCross(rows);
  }, [filtered, chartTabs.statusProcess]);

  const setChartTab = (chart: ChartKey, value: WorkplaceTab) => {
    setChartTabs((prev) => ({ ...prev, [chart]: value }));
  };

  if (!loading && !dataset) {
    return (
      <>
        <PageHeader title="인원현황 대시보드" />
        <EmptyState
          title="반영된 인원 데이터가 없습니다"
          description="인원 데이터 파일을 반영하면 KPI와 교차표가 표시됩니다."
          actions={
            <Link href="/manage/import" className="btn btn-primary">
              데이터 업로드
            </Link>
          }
        />
      </>
    );
  }

  return (
    <div className="dashboard-page space-y-6">
      <PageHeader title="인원현황 대시보드" />

      <ResponsiveGrid preset="kpi">
        <KpiCard
          label="총 인원"
          tone="accent"
          value={aggregated.kpi.total}
          hint="근무중·휴직 기준"
        />
        <KpiCard
          label="근무중"
          tone="ok"
          value={aggregated.kpi.working}
          hint="전체 대비 비중"
          share={
            aggregated.kpi.total > 0
              ? aggregated.kpi.working / aggregated.kpi.total
              : 0
          }
        />
        <KpiCard
          label="휴직"
          tone="warn"
          value={aggregated.kpi.onLeave}
          hint="전체 대비 비중"
          share={
            aggregated.kpi.total > 0
              ? aggregated.kpi.onLeave / aggregated.kpi.total
              : 0
          }
        />
      </ResponsiveGrid>

      <Panel
        className={
          statusProcessView === 'chart' ? 'dashboard-process-panel' : ''
        }
        title="근무현황 × 공정"
        description={
          statusProcessView === 'table'
            ? '근무중·휴직과 공정별 교차 인원'
            : '왼쪽 분포 · 오른쪽 순위 요약'
        }
        actions={
          <div className="dashboard-panel-toolbar">
            <div
              className="dashboard-chart-tabs"
              role="tablist"
              aria-label="표시 형식"
            >
              <button
                type="button"
                role="tab"
                aria-selected={statusProcessView === 'table'}
                className="dashboard-chart-tab"
                data-active={statusProcessView === 'table' ? 'true' : 'false'}
                onClick={() => setStatusProcessView('table')}
              >
                표
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statusProcessView === 'chart'}
                className="dashboard-chart-tab"
                data-active={statusProcessView === 'chart' ? 'true' : 'false'}
                onClick={() => setStatusProcessView('chart')}
              >
                그래프
              </button>
            </div>
            <WorkplaceTabControl
              value={chartTabs.statusProcess}
              onChange={(v) => setChartTab('statusProcess', v)}
              ariaLabel="근무현황×공정 근무지"
            />
          </div>
        }
      >
        {statusProcessView === 'table' ? (
          statusProcessModel.rowLabels.length > 0 ? (
            <CrossTable
              variant="plain"
              rowLabels={statusProcessModel.rowLabels}
              colLabels={statusProcessModel.colLabels}
              cells={statusProcessModel.cells}
            />
          ) : (
            <p className="text-muted text-sm">
              표시할 근무현황·공정 데이터가 없습니다.
            </p>
          )
        ) : (
          <SplitRankChart
            data={pickAgg('statusProcess').processes.map((p) => ({
              id: p.key,
              label: p.label,
              count: p.count,
              ratio: p.ratio,
            }))}
          />
        )}
      </Panel>

      <Panel
        title="근무지별 인원"
        description="1공장·2공장 인원 비중"
      >
        <ShareBarChart
          showLead={false}
          title="근무지 비중"
          data={aggregated.workplaces.map((w) => ({
            id: w.key,
            label: w.label,
            count: w.count,
            ratio: w.ratio,
          }))}
        />
      </Panel>

      <div className="dashboard-analysis-grid">
        <Panel
          title="성별 현황"
          actions={
            <WorkplaceTabControl
              value={chartTabs.gender}
              onChange={(v) => setChartTab('gender', v)}
              ariaLabel="성별 현황 근무지"
            />
          }
        >
          <DonutChart
            showLead={false}
            data={pickAgg('gender').genders.map((g) => ({
              id: g.key,
              label: g.label,
              count: g.count,
              ratio: g.ratio,
            }))}
            height={240}
          />
        </Panel>

        <Panel
          title="작업자 나이별"
          description="연령대 구성비와 인원 요약"
          actions={
            <WorkplaceTabControl
              value={chartTabs.age}
              onChange={(v) => setChartTab('age', v)}
              ariaLabel="나이별 근무지"
            />
          }
        >
          <HorizontalBarChart
            showLead={false}
            data={pickAgg('age')
              .ageBands.filter((a) => a.count > 0)
              .map((a) => ({
                id: a.key,
                label: a.label,
                count: a.count,
                ratio: a.ratio,
              }))}
            height={240}
          />
        </Panel>

        <Panel
          className="dashboard-tenure-panel"
          title="근속 년수"
          description="구간별 인원 분포"
          actions={
            <WorkplaceTabControl
              value={chartTabs.tenure}
              onChange={(v) => setChartTab('tenure', v)}
              ariaLabel="근속 년수 근무지"
            />
          }
        >
          <VerticalBarChart
            fill
            showLead={false}
            summaryCompact
            summaryClassName="chart-summary-cols-5"
            data={pickAgg('tenure')
              .tenureBands.filter((t) => t.count > 0)
              .map((t) => ({
                id: t.key,
                label: t.label,
                shortLabel: TENURE_SHORT_LABELS[t.key] ?? t.label,
                count: t.count,
                ratio: t.ratio,
              }))}
          />
        </Panel>

        <Panel
          className="dashboard-process-age-panel"
          title="공정별 나이"
          description="공정 × 나이대 교차 분포"
          actions={
            <WorkplaceTabControl
              value={chartTabs.processAge}
              onChange={(v) => setChartTab('processAge', v)}
              ariaLabel="공정별 나이 근무지"
            />
          }
        >
          {processAgeModel.rowLabels.length > 0 ? (
            <CrossTable
              rowLabels={processAgeModel.rowLabels}
              colLabels={processAgeModel.colLabels}
              cells={processAgeModel.cells}
            />
          ) : (
            <p className="text-muted text-sm">
              표시할 공정·나이 데이터가 없습니다.
            </p>
          )}
        </Panel>
      </div>

      <section className="analysis-nav-section">
        <div className="analysis-nav-head">
          <h2 className="analysis-nav-title">상세 분석으로 이동</h2>
          <p className="analysis-nav-desc">
            직급·성별·나이·근속 분포를 이어서 확인합니다.
          </p>
        </div>
        <div className="analysis-nav-grid">
          <Link href="/analysis/positions" className="analysis-nav-card">
            <span className="analysis-nav-icon" aria-hidden>
              <Briefcase size={18} />
            </span>
            <span className="analysis-nav-copy">
              <span className="analysis-nav-label">직급 분석</span>
              <span className="analysis-nav-sub">직급별 인원 분포</span>
            </span>
            <ArrowRight size={16} className="analysis-nav-arrow" aria-hidden />
          </Link>
          <Link href="/analysis/gender" className="analysis-nav-card">
            <span className="analysis-nav-icon" aria-hidden>
              <VenusAndMars size={18} />
            </span>
            <span className="analysis-nav-copy">
              <span className="analysis-nav-label">성별 분석</span>
              <span className="analysis-nav-sub">남녀 구성비</span>
            </span>
            <ArrowRight size={16} className="analysis-nav-arrow" aria-hidden />
          </Link>
          <Link href="/analysis/age" className="analysis-nav-card">
            <span className="analysis-nav-icon" aria-hidden>
              <Calendar size={18} />
            </span>
            <span className="analysis-nav-copy">
              <span className="analysis-nav-label">나이 분석</span>
              <span className="analysis-nav-sub">연령대별 분포</span>
            </span>
            <ArrowRight size={16} className="analysis-nav-arrow" aria-hidden />
          </Link>
          <Link href="/analysis/tenure" className="analysis-nav-card">
            <span className="analysis-nav-icon" aria-hidden>
              <Clock size={18} />
            </span>
            <span className="analysis-nav-copy">
              <span className="analysis-nav-label">근속 분석</span>
              <span className="analysis-nav-sub">근속년수 구간</span>
            </span>
            <ArrowRight size={16} className="analysis-nav-arrow" aria-hidden />
          </Link>
          <Link href="/analysis/process-age" className="analysis-nav-card">
            <span className="analysis-nav-icon" aria-hidden>
              <Users size={18} />
            </span>
            <span className="analysis-nav-copy">
              <span className="analysis-nav-label">공정별 나이</span>
              <span className="analysis-nav-sub">공정 × 연령</span>
            </span>
            <ArrowRight size={16} className="analysis-nav-arrow" aria-hidden />
          </Link>
        </div>
      </section>

      <p className="page-footnote">
        월별 추이 차트는 향후 기준일 시계열 데이터가 확보되면 제공할 예정입니다.
      </p>
    </div>
  );
}
