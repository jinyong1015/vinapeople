'use client';

import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import type { SortDirection } from '@/components/common/SortSearchBar';
import {
  AttendanceFilterCard,
  ATTENDANCE_SORT_OPTIONS,
  createDefaultAttendanceFilters,
  type AttendanceFilterState,
} from '@/components/filters/AttendanceFilterCard';
import { useAdmin } from '@/components/providers/AdminProvider';
import type { AttendancePreviewResult } from '@/lib/vina/attendance/types';
import { isSupabaseDataSource } from '@/lib/vina';
import {
  ChevronRight,
  FileSpreadsheet,
  History,
  ShieldAlert,
  ShieldX,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface AttendanceRow {
  id: string;
  attendanceDate: string;
  employeeNo: string;
  nameSnapshot: string;
  departmentSnapshot: string;
  shift: string;
  reason: string;
  remarks: string;
  photoPath?: string | null;
}

interface PreviewResponse extends AttendancePreviewResult {
  fileName: string;
  message?: string;
}

type ReviewTab = 'new' | 'changed' | 'errors' | 'review' | 'unmatched';

function countByMessage(
  rows: Array<{ message: string }>,
  match: (message: string) => boolean,
): number {
  return rows.reduce((n, row) => (match(row.message) ? n + 1 : n), 0);
}

function AttendancePageContent() {
  const { isAdmin, openSettings } = useAdmin();
  const supabaseMode = isSupabaseDataSource();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const initialEmployeeNo = searchParams.get('employeeNo')?.trim() ?? '';
  const [filters, setFilters] = useState<AttendanceFilterState>(() =>
    createDefaultAttendanceFilters(
      initialEmployeeNo ? { search: initialEmployeeNo } : undefined,
    ),
  );
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState('attendance_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [reviewTab, setReviewTab] = useState<ReviewTab>('new');
  const [commitInfo, setCommitInfo] = useState<string | null>(null);
  const reviewTableRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const openReviewTab = useCallback((tab: ReviewTab) => {
    setReviewTab(tab);
    requestAnimationFrame(() => {
      reviewTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const load = useCallback(async () => {
    if (!supabaseMode) {
      setLoading(false);
      setError('Supabase 모드에서만 근태 현황을 사용할 수 있습니다.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: ATTENDANCE_SORT_OPTIONS.some((o) => o.id === sortField)
          ? sortField
          : 'attendance_date',
        dir: sortDirection,
      });
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      for (const process of filters.processes) {
        params.append('department', process);
      }
      for (const shift of filters.shifts) {
        params.append('shift', shift);
      }
      if (filters.search.trim()) params.set('q', filters.search.trim());

      const res = await fetch(`/api/attendance?${params.toString()}`, {
        credentials: 'include',
      });
      const body = (await res.json()) as {
        rows?: AttendanceRow[];
        total?: number;
        message?: string;
      };
      if (!res.ok) throw new Error(body.message || '조회에 실패했습니다.');
      setRows(body.rows ?? []);
      setTotal(body.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '조회에 실패했습니다.');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, sortDirection, sortField, supabaseMode]);

  const updateFilters = useCallback((next: AttendanceFilterState) => {
    setFilters(next);
    setPage(1);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runPreview = async (file: File | null) => {
    if (!file || !isAdmin) return;
    setBusy(true);
    setCommitInfo(null);
    setError(null);
    setPendingFile(file);
    try {
      const gate = await fetch('/api/admin/ping', { credentials: 'include' });
      if (!gate.ok) {
        openSettings('admin');
        throw new Error('관리자 세션이 필요합니다.');
      }
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/attendance/preview', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const body = (await res.json()) as PreviewResponse;
      if (!res.ok) throw new Error(body.message || '미리보기에 실패했습니다.');
      setPreview(body);
      setReviewTab(
        body.counts.review > 0
          ? 'review'
          : body.counts.unmatched > 0
            ? 'unmatched'
            : body.counts.error > 0
              ? 'errors'
              : body.counts.changed > 0
                ? 'changed'
                : 'new',
      );
    } catch (err) {
      setPreview(null);
      setPendingFile(null);
      setError(err instanceof Error ? err.message : '미리보기에 실패했습니다.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const commit = async () => {
    if (!preview?.canApply || !pendingFile) {
      setError('반영할 파일이 없습니다. 엑셀을 다시 선택한 뒤 미리보기를 실행하세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', pendingFile);
      form.append('fileName', preview.fileName);
      const res = await fetch('/api/admin/attendance/apply', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const body = (await res.json()) as {
        message?: string;
        counts?: PreviewResponse['counts'];
        savedRowCount?: number;
      };
      if (!res.ok) throw new Error(body.message || '반영에 실패했습니다.');
      const counts = body.counts ?? preview.counts;
      setCommitInfo(
        `반영 완료(DB 저장): ${body.savedRowCount ?? preview.applyRows.length}건 · 신규 ${counts.new} · 변경 ${counts.changed} · 동일 ${counts.unchanged}`,
      );
      setPreview(null);
      setPendingFile(null);
      setFilters(createDefaultAttendanceFilters());
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : '반영에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const quality = useMemo(() => {
    if (!preview) return null;
    const { counts } = preview;
    const ok = counts.new + counts.changed + counts.unchanged;
    const warn = counts.review;
    const err = counts.error + counts.unmatched;
    const totalRows = counts.total;
    const score =
      totalRows > 0
        ? Math.round(((ok + warn) / totalRows) * 1000) / 10
        : 100;

    const invalidDate = countByMessage(preview.errorRows, (m) =>
      m.includes('날짜'),
    );
    const missingEmployeeNo = countByMessage(preview.errorRows, (m) =>
      m.includes('사번이 없습니다'),
    );
    const otherErrors = Math.max(
      0,
      counts.error - invalidDate - missingEmployeeNo,
    );

    const errorItems = [
      {
        label: '근태 날짜 없음·형식 오류',
        count: invalidDate,
        tab: 'errors' as ReviewTab,
      },
      {
        label: '사번 없음(집계 행 등)',
        count: missingEmployeeNo,
        tab: 'errors' as ReviewTab,
      },
      {
        label: '인원현황 사번 미매칭',
        count: counts.unmatched,
        tab: 'unmatched' as ReviewTab,
      },
      ...(otherErrors > 0
        ? [
            {
              label: '기타 오류',
              count: otherErrors,
              tab: 'errors' as ReviewTab,
            },
          ]
        : []),
    ];

    const resignedReview = (preview.reviewRows ?? []).filter(
      (r) => r.resignDate || /퇴사/.test(r.employmentStatus || ''),
    ).length;
    const activeNameMismatch = Math.max(0, counts.review - resignedReview);

    const warnItems = [
      {
        label: '사번 일치·이름 불일치',
        count: activeNameMismatch,
        tab: 'review' as ReviewTab,
      },
      {
        label: '퇴사·상태 확인 후 이름 불일치',
        count: resignedReview,
        tab: 'review' as ReviewTab,
      },
    ];

    return {
      ok,
      warn,
      err,
      score,
      totalRows,
      errorItems,
      warnItems,
    };
  }, [preview]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="근태 현황"
        description="사번 기준으로 인원정보와 연결된 누적 근태 기록을 조회합니다."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin ? (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => void runPreview(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  className="manage-action-btn manage-action-btn-primary"
                  disabled={busy || !supabaseMode}
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload size={15} aria-hidden />
                  {busy ? '처리 중…' : '엑셀 업로드'}
                </button>
                <Link
                  href="/attendance/uploads"
                  className="manage-header-nav-link"
                  title="근태 업로드 이력"
                >
                  <span className="manage-header-nav-icon" aria-hidden>
                    <History size={15} />
                  </span>
                  <span className="manage-header-nav-text">업로드 이력</span>
                  <ChevronRight size={14} aria-hidden />
                </Link>
              </>
            ) : null}
          </div>
        }
      />

      {commitInfo ? <p className="manage-ok-banner">{commitInfo}</p> : null}
      {error ? <p className="manage-error-banner">{error}</p> : null}

      {preview && quality ? (
        <Panel
          title="업로드 품질 검사"
          description={`${preview.fileName} · 사번·이름이 모두 일치한 행만 반영됩니다. 확인·미매칭은 DB에 저장하지 않으며 인원 이름은 변경하지 않습니다.`}
        >
          <div className="manage-kpi-grid mb-4">
            {[
              {
                label: '정상',
                value: `${quality.ok.toLocaleString('ko-KR')}건`,
                tone: 'ok' as const,
                hint: '사번·이름 일치 · 반영 대상',
              },
              {
                label: '경고',
                value: `${quality.warn.toLocaleString('ko-KR')}건`,
                tone: 'warn' as const,
                hint: '확인 필요 · 자동 반영 안 함',
              },
              {
                label: '오류',
                value: `${quality.err.toLocaleString('ko-KR')}건`,
                tone: 'danger' as const,
                hint: '날짜·사번 오류 · 미매칭',
              },
              {
                label: '품질 Score',
                value: `${quality.score.toLocaleString('ko-KR', {
                  maximumFractionDigits: 1,
                })}%`,
                tone: 'accent' as const,
                hint: `전체 ${quality.totalRows.toLocaleString('ko-KR')}행 기준`,
              },
            ].map((c) => (
              <div
                key={c.label}
                className={`manage-kpi-card manage-kpi-card-${c.tone}`}
              >
                <p className="manage-kpi-label">{c.label}</p>
                <p className="manage-kpi-value tabular-nums">{c.value}</p>
                <p className="manage-kpi-hint">{c.hint}</p>
              </div>
            ))}
          </div>

          <section className="manage-panel mb-4">
            <div className="manage-panel-head">
              <div>
                <h2 className="manage-panel-title">
                  데이터 품질 검사 결과 · Score {quality.score}%
                </h2>
                <p className="manage-panel-sub">
                  오류·미매칭은 제외되고, 경고(이름 불일치)는 확인 후 수동 조치가
                  필요합니다.
                </p>
              </div>
              <div className="manage-panel-links">
                <button
                  type="button"
                  className="manage-inline-link"
                  onClick={() =>
                    openReviewTab(
                      preview.counts.error > 0 ? 'errors' : 'unmatched',
                    )
                  }
                >
                  오류 DATA <ChevronRight size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  className="manage-inline-link"
                  onClick={() => openReviewTab('review')}
                >
                  확인 DATA <ChevronRight size={14} aria-hidden />
                </button>
              </div>
            </div>
            <div className="manage-panel-body">
              <div className="manage-quality-split">
                <div className="manage-quality-col manage-quality-col-error">
                  <div className="manage-quality-col-head">
                    <ShieldX size={18} aria-hidden />
                    <div>
                      <h3>오류 조건</h3>
                      <p>분석·반영에서 제외되는 행입니다.</p>
                    </div>
                  </div>
                  <div className="manage-quality-list">
                    {quality.errorItems.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className={`manage-quality-row${item.count > 0 ? ' has-count' : ''}`}
                        onClick={() => openReviewTab(item.tab)}
                      >
                        <span>{item.label}</span>
                        <span className="num">
                          {item.count.toLocaleString('ko-KR')}건
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="manage-quality-col manage-quality-col-warn">
                  <div className="manage-quality-col-head">
                    <ShieldAlert size={18} aria-hidden />
                    <div>
                      <h3>경고 조건</h3>
                      <p>확인이 필요하거나 내용 변경이 있는 행입니다.</p>
                    </div>
                  </div>
                  <div className="manage-quality-list">
                    {quality.warnItems.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className={`manage-quality-row manage-quality-row-warn${item.count > 0 ? ' has-count' : ''}`}
                        onClick={() => openReviewTab(item.tab)}
                      >
                        <span>{item.label}</span>
                        <span className="num">
                          {item.count.toLocaleString('ko-KR')}건
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div ref={reviewTableRef} className="mb-3 flex flex-wrap gap-2">
            {(
              [
                ['new', `신규 (${preview.counts.new})`, 'ok'],
                ['changed', `변경 (${preview.counts.changed})`, 'warn'],
                ['review', `확인 (${preview.counts.review})`, 'review'],
                ['unmatched', `미매칭 (${preview.counts.unmatched})`, 'miss'],
                ['errors', `오류 (${preview.counts.error})`, 'danger'],
              ] as const
            ).map(([id, label, tone]) => (
              <button
                key={id}
                type="button"
                className="attendance-review-tab"
                data-tone={tone}
                data-active={reviewTab === id ? 'true' : 'false'}
                onClick={() => setReviewTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="table-wrap table-wrap-list max-h-[360px] overflow-auto">
            <table className="data-table min-w-[720px] w-full text-sm">
              <thead>
                {reviewTab === 'changed' ? (
                  <tr>
                    <th>날짜</th>
                    <th>사번</th>
                    <th>이름</th>
                    <th>변경 항목</th>
                    <th>기존</th>
                    <th>신규</th>
                  </tr>
                ) : reviewTab === 'review' ? (
                  <tr>
                    <th>행</th>
                    <th>날짜</th>
                    <th>사번</th>
                    <th>근태 이름</th>
                    <th>인원 이름</th>
                    <th>재직</th>
                    <th>안내</th>
                  </tr>
                ) : reviewTab === 'unmatched' ? (
                  <tr>
                    <th>행</th>
                    <th>날짜</th>
                    <th>사번</th>
                    <th>근태 이름</th>
                    <th>안내</th>
                  </tr>
                ) : (
                  <tr>
                    <th>행</th>
                    <th>날짜</th>
                    <th>사번</th>
                    <th>이름</th>
                    <th>{reviewTab === 'errors' ? '메시지' : '근태사유'}</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {reviewTab === 'new' &&
                  preview.newRows.map((r) => (
                    <tr key={`n-${r.excelRow}-${r.employeeNo}-${r.noValue}`}>
                      <td className="num">{r.excelRow}</td>
                      <td className="num">{r.attendanceDate}</td>
                      <td>{r.employeeNo}</td>
                      <td>{r.name}</td>
                      <td>{r.reason}</td>
                    </tr>
                  ))}
                {reviewTab === 'changed' &&
                  preview.changedRows.flatMap((r) =>
                    r.changes.map((c) => (
                      <tr key={`c-${r.excelRow}-${c.field}`}>
                        <td className="num">{r.attendanceDate}</td>
                        <td>{r.employeeNo}</td>
                        <td>{r.name}</td>
                        <td>{c.label}</td>
                        <td>{c.oldValue || '-'}</td>
                        <td>{c.newValue || '-'}</td>
                      </tr>
                    )),
                  )}
                {reviewTab === 'review' &&
                  (preview.reviewRows ?? []).map((r) => (
                    <tr key={`rv-${r.excelRow}-${r.employeeNo}`}>
                      <td className="num">{r.excelRow}</td>
                      <td className="num">{r.attendanceDate}</td>
                      <td>{r.employeeNo}</td>
                      <td>{r.attendanceName || '-'}</td>
                      <td>{r.rosterName || '-'}</td>
                      <td>
                        {r.employmentStatus || '-'}
                        {r.resignDate ? ` · 퇴사 ${r.resignDate}` : ''}
                      </td>
                      <td>{r.message}</td>
                    </tr>
                  ))}
                {reviewTab === 'errors' &&
                  preview.errorRows.map((r) => (
                    <tr key={`e-${r.excelRow}`}>
                      <td className="num">{r.excelRow}</td>
                      <td className="num">-</td>
                      <td>{r.employeeNo || '-'}</td>
                      <td>{r.name || '-'}</td>
                      <td>{r.message}</td>
                    </tr>
                  ))}
                {reviewTab === 'unmatched' &&
                  preview.unmatchedRows.map((r) => (
                    <tr key={`u-${r.excelRow}-${r.employeeNo}`}>
                      <td className="num">{r.excelRow}</td>
                      <td className="num">{r.attendanceDate}</td>
                      <td>{r.employeeNo}</td>
                      <td>{r.attendanceName || '-'}</td>
                      <td>{r.message}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="manage-action-btn manage-action-btn-primary"
              disabled={busy || !preview.canApply}
              onClick={() => void commit()}
            >
              <FileSpreadsheet size={15} aria-hidden />
              {busy ? '반영 중…' : `최종 반영 (${preview.applyRows.length}건)`}
            </button>
            <button
              type="button"
              className="manage-action-btn"
              disabled={busy}
              onClick={() => setPreview(null)}
            >
              취소
            </button>
          </div>
        </Panel>
      ) : null}

      <AttendanceFilterCard
        value={filters}
        onChange={updateFilters}
        sortField={sortField}
        onSortFieldChange={(field) => {
          setSortField(field);
          setPage(1);
        }}
        sortDirection={sortDirection}
        onSortDirectionToggle={() => {
          setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
          setPage(1);
        }}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <Panel
        title="근태 목록"
        description={`조건 결과 ${total.toLocaleString('ko-KR')}건`}
        bodyClassName="ui-panel-body-flush"
      >
        <div className="table-wrap table-wrap-list overflow-hidden">
          <table className="data-table min-w-[960px] w-full">
            <thead>
              <tr>
                <th>근태 날짜</th>
                <th>사번</th>
                <th>사진</th>
                <th>이름</th>
                <th>부서</th>
                <th>주/야</th>
                <th>사유</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.attendanceDate}</td>
                  <td>
                    <Link
                      href={`/employees/${encodeURIComponent(row.employeeNo)}?from=${encodeURIComponent('/attendance')}`}
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
                  <td>{row.nameSnapshot || '-'}</td>
                  <td>{row.departmentSnapshot || '-'}</td>
                  <td>{row.shift || '-'}</td>
                  <td>{row.reason || '-'}</td>
                  <td>{row.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? (
            <p className="text-muted px-4 py-6 text-center text-sm">불러오는 중…</p>
          ) : rows.length === 0 ? (
            <p className="text-muted px-4 py-6 text-center text-sm">
              조건에 맞는 근태 기록이 없습니다.
            </p>
          ) : null}
        </div>
        <div className="pager pager-embedded">
          <span className="text-muted text-sm">
            {page} / {totalPages} 페이지
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="manage-action-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              이전
            </button>
            <button
              type="button"
              className="manage-action-btn"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<p className="text-muted text-sm">불러오는 중…</p>}>
      <AttendancePageContent />
    </Suspense>
  );
}
