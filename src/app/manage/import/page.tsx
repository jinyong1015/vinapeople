'use client';

import { useAdmin } from '@/components/providers/AdminProvider';
import { useWorkforce } from '@/components/providers/WorkforceProvider';
import {
  buildPersonnelFromCandidates,
  isSupabaseDataSource,
  parsePersonnelWorkbook,
  validatePersonnelRows,
} from '@/lib/vina';
import { createVersionId } from '@/lib/vina/repository';
import type {
  ActiveDataset,
  ImportValidation,
  ParsePersonnelWorkbookResult,
} from '@/lib/vina/types';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  Lock,
  Megaphone,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';

type Step = 'idle' | 'parsed' | 'validated' | 'reviewed';

type ReviewTab = 'new' | 'changed' | 'errors' | 'missing';

interface PreviewChange {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

interface PreviewResponse {
  counts: {
    total: number;
    new: number;
    changed: number;
    unchanged: number;
    error: number;
    missing: number;
  };
  newRows: Array<{ excelRow: number; employeeNo: string; name: string }>;
  changedRows: Array<{
    excelRow: number;
    employeeNo: string;
    name: string;
    changes: PreviewChange[];
  }>;
  errorRows: Array<{
    excelRow: number;
    employeeNo: string;
    name: string;
    message: string;
  }>;
  missingRows: Array<{
    employeeNo: string;
    name: string;
    employmentStatus: string;
  }>;
  applyPayload: Record<string, unknown>;
  canApply: boolean;
  message?: string;
}

/** 반영 기준일 기본값은 오늘(로컬 달력). 파일 후보와 다르면 확인 체크 후 검증. */
function todayAsOfDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isAdmin, authLoading, openSettings } = useAdmin();
  const { dataset, applyImport, clearDataset, reload, dataSource } = useWorkforce();
  const supabaseMode = dataSource === 'supabase' || isSupabaseDataSource();

  const [step, setStep] = useState<Step>('idle');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsePersonnelWorkbookResult | null>(null);
  const [asOfDate, setAsOfDate] = useState('');
  const [dateAck, setDateAck] = useState(false);
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const [warningsAck, setWarningsAck] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [committedInfo, setCommittedInfo] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [reviewTab, setReviewTab] = useState<ReviewTab>('new');

  const reset = useCallback(() => {
    setStep('idle');
    setFileName('');
    setParsed(null);
    setAsOfDate('');
    setDateAck(false);
    setValidation(null);
    setWarningsAck(false);
    setPanelError(null);
    setPreview(null);
    setReviewTab('new');
  }, []);

  const resetSeed = useCallback(async () => {
    if (supabaseMode) {
      setPanelError(
        'Supabase 모드에서는 시드 초기화 대신 업로드 이력에서 복구하세요.',
      );
      return;
    }
    if (!dataset) {
      setPanelError('초기화할 활성 인원 데이터가 없습니다.');
      return;
    }
    const confirmed = window.confirm(
      `이 브라우저에 반영된 인원 데이터(${dataset.personnel.length.toLocaleString('ko-KR')}명, 기준일 ${dataset.asOfDate})를 삭제할까요?\n삭제 후 대시보드·분석·인원 관리는 데이터가 없는 상태가 됩니다.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setPanelError(null);
    setCommittedInfo(null);
    try {
      await clearDataset();
      reset();
      setCommittedInfo('시드 초기화 완료 · 활성 인원 데이터가 삭제되었습니다.');
    } catch (err) {
      setPanelError(
        err instanceof Error ? err.message : '시드 초기화에 실패했습니다.',
      );
    } finally {
      setBusy(false);
    }
  }, [clearDataset, dataset, reset, supabaseMode]);

  const onFile = async (file: File) => {
    setPanelError(null);
    setCommittedInfo(null);
    setBusy(true);
    try {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith('.xlsx')) {
        setPanelError('기준 양식은 .xlsx 파일만 지원합니다.');
        return;
      }
      const buffer = await file.arrayBuffer();
      const result = await parsePersonnelWorkbook(buffer, { fileName: file.name });
      setFileName(file.name);
      setParsed(result);
      setAsOfDate(todayAsOfDate());
      setDateAck(false);
      setValidation(null);
      setWarningsAck(false);
      setPreview(null);
      setStep('parsed');
      if (!result.schemaOk) {
        setPanelError(
          '파일 구조가 기준 양식과 다릅니다. 아래 구조 오류를 확인한 뒤 올바른 파일을 다시 선택하세요.',
        );
      }
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : '파일을 해석하지 못했습니다.');
      setParsed(null);
      setStep('idle');
    } finally {
      setBusy(false);
    }
  };

  const runValidate = () => {
    if (!parsed) return;
    if (!parsed.schemaOk) {
      setPanelError('구조가 맞지 않는 파일은 검증·반영할 수 없습니다.');
      return;
    }
    if (!asOfDate.trim()) {
      setPanelError('기준일을 입력한 뒤 검증을 실행하세요.');
      return;
    }
    if (parsed.dateSourcesConflict && !dateAck) {
      setPanelError(
        '파일명·T4·T5 기준일 후보가 서로 다릅니다. 확인 체크 후 검증하세요.',
      );
      return;
    }
    setPanelError(null);
    const result = validatePersonnelRows(parsed.rows, asOfDate.trim(), {
      sheetName: parsed.sheetName,
      tableName: parsed.tableName,
      excelCalcBaseDate: parsed.calcBaseDate,
    });
    setValidation(result);
    setWarningsAck(false);
    setPreview(null);
    setStep('validated');
  };

  const runPreview = async () => {
    if (!parsed || !validation || !validation.canApply) return;
    if (validation.warningRows > 0 && !warningsAck) {
      setPanelError('경고를 확인한 뒤 비교를 실행하세요.');
      return;
    }
    setBusy(true);
    setPanelError(null);
    try {
      const gate = await fetch('/api/admin/ping', { credentials: 'include' });
      if (!gate.ok) {
        setPanelError('관리자 세션이 없거나 만료되었습니다. 다시 로그인해 주세요.');
        openSettings('admin');
        return;
      }

      const res = await fetch('/api/admin/import/preview', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          asOfDate: validation.asOfDate,
          candidates: validation.candidates,
          validationIssues: validation.issues,
        }),
      });
      const body = (await res.json()) as PreviewResponse;
      if (!res.ok) {
        throw new Error(body.message || 'DB 비교에 실패했습니다.');
      }
      setPreview(body);
      setReviewTab(
        body.counts.error > 0
          ? 'errors'
          : body.counts.new > 0
            ? 'new'
            : body.counts.changed > 0
              ? 'changed'
              : 'missing',
      );
      setStep('reviewed');
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'DB 비교에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const canCommitIndexed = useMemo(() => {
    if (!parsed?.schemaOk) return false;
    if (!validation?.canApply) return false;
    if (validation.warningRows > 0 && !warningsAck) return false;
    if (parsed.dateSourcesConflict && !dateAck) return false;
    return true;
  }, [parsed, validation, warningsAck, dateAck]);

  const canCommitSupabase = useMemo(() => {
    if (!preview) return false;
    if (preview.counts.error > 0) return false;
    return preview.canApply;
  }, [preview]);

  const commitIndexed = async () => {
    if (!parsed || !validation || !canCommitIndexed) return;
    setBusy(true);
    setPanelError(null);
    try {
      const gate = await fetch('/api/admin/ping', { credentials: 'include' });
      if (!gate.ok) {
        setPanelError('관리자 세션이 없거나 만료되었습니다. 다시 로그인해 주세요.');
        openSettings('admin');
        return;
      }

      const now = new Date().toISOString();
      const personnel = buildPersonnelFromCandidates(
        validation.candidates,
        validation.asOfDate,
        now,
      );
      if (personnel.length === 0) {
        setPanelError('반영할 인원이 0명입니다. 반영을 차단합니다.');
        return;
      }
      const previousCount = dataset?.personnel.length ?? 0;
      const next: ActiveDataset = {
        versionId: createVersionId(),
        asOfDate: validation.asOfDate,
        appliedAt: now,
        fileName,
        personnel,
        meta: {
          sheetName: parsed.sheetName,
          tableName: parsed.tableName,
          headerRow: parsed.headerRow,
          dataStartRow: parsed.dataStartRow,
          dataEndRow: parsed.dataEndRow,
          documentDate: parsed.documentDate,
          calcBaseDate: parsed.calcBaseDate,
          fileNameDateHint: parsed.fileNameDateHint,
        },
        updatedAt: now,
      };
      await applyImport(next);
      setCommittedInfo(
        `반영 완료: ${personnel.length}명 (이전 활성 ${previousCount}명 → 교체). 기준일 ${validation.asOfDate}`,
      );
      reset();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : '반영에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const commitSupabase = async () => {
    if (!preview || !canCommitSupabase) return;
    setBusy(true);
    setPanelError(null);
    try {
      const gate = await fetch('/api/admin/ping', { credentials: 'include' });
      if (!gate.ok) {
        setPanelError('관리자 세션이 없거나 만료되었습니다. 다시 로그인해 주세요.');
        openSettings('admin');
        return;
      }

      if (!preview.applyPayload) {
        throw new Error('반영 페이로드가 없습니다. 비교를 다시 실행하세요.');
      }
      const res = await fetch('/api/admin/import/apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          asOfDate: validation?.asOfDate ?? asOfDate,
          counts: preview.counts,
          applyPayload: preview.applyPayload,
        }),
      });
      const body = (await res.json()) as { message?: string };
      if (!res.ok) {
        throw new Error(body.message || '반영에 실패했습니다.');
      }
      await reload();
      setCommittedInfo(
        `누적 반영 완료: 신규 ${preview.counts.new} · 변경 ${preview.counts.changed} · 동일 ${preview.counts.unchanged} (누락 ${preview.counts.missing}은 자동 퇴사하지 않음)`,
      );
      reset();
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : '반영에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const showFileStatus = Boolean(fileName || busy || parsed || dataset);

  if (authLoading) {
    return <p className="text-muted text-sm">권한 확인 중…</p>;
  }

  if (!isAdmin) {
    return (
      <div className="manage-page">
        <header className="manage-page-header">
          <div className="min-w-0">
            <p className="manage-page-kicker">DATA MANAGEMENT</p>
            <h1 className="manage-page-title">데이터 업로드</h1>
          </div>
        </header>
        <section className="manage-panel">
          <div className="manage-panel-head">
            <div>
              <h2 className="manage-panel-title">관리자 권한 필요</h2>
              <p className="manage-panel-sub">
                데이터 업로드는 관리자 계정으로 로그인한 경우에만 사용할 수
                있습니다. 관리자 계정으로 다시 로그인해 주세요.
              </p>
            </div>
          </div>
          <div className="manage-panel-body">
            <a
              href="/login"
              className="manage-action-btn manage-action-btn-primary manage-admin-login-btn"
            >
              <span className="manage-admin-login-btn-icon" aria-hidden>
                <Lock size={16} strokeWidth={2.25} />
              </span>
              로그인 화면으로
            </a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="manage-page">
      <header className="manage-page-header">
        <div className="min-w-0">
          <p className="manage-page-kicker">DATA MANAGEMENT</p>
          <h1 className="manage-page-title">데이터 업로드</h1>
        </div>
        <div className="manage-page-actions">
          {step !== 'idle' ? (
            <button
              type="button"
              className="manage-action-btn"
              onClick={reset}
              disabled={busy}
            >
              <RotateCcw size={15} aria-hidden />
              업로드 초기화
            </button>
          ) : null}
          <nav className="manage-header-nav" aria-label="바로가기">
            <span className="manage-header-nav-label">바로가기</span>
            {supabaseMode ? (
              <Link
                href="/manage/uploads"
                className="manage-header-nav-link"
                title="업로드 이력 페이지로 이동"
              >
                <span className="manage-header-nav-icon" aria-hidden>
                  <History size={15} strokeWidth={2.25} />
                </span>
                <span className="manage-header-nav-text">업로드 이력</span>
                <ChevronRight
                  className="manage-header-nav-chevron"
                  size={14}
                  strokeWidth={2.25}
                  aria-hidden
                />
              </Link>
            ) : null}
            <Link
              href="/"
              className="manage-header-nav-link"
              title="대시보드로 이동"
            >
              <span className="manage-header-nav-icon" aria-hidden>
                <LayoutDashboard size={15} strokeWidth={2.25} />
              </span>
              <span className="manage-header-nav-text">대시보드</span>
              <ChevronRight
                className="manage-header-nav-chevron"
                size={14}
                strokeWidth={2.25}
                aria-hidden
              />
            </Link>
          </nav>
          {!supabaseMode ? (
            <button
              type="button"
              className="manage-action-btn manage-action-btn-danger"
              onClick={() => void resetSeed()}
              disabled={busy || !dataset}
              title={
                dataset
                  ? '이 브라우저의 활성 인원 데이터를 삭제합니다'
                  : '삭제할 활성 데이터가 없습니다'
              }
            >
              <Trash2 size={15} aria-hidden />
              시드 초기화
            </button>
          ) : null}
        </div>
      </header>

      <div className="manage-notice" role="note">
        <Megaphone size={18} className="manage-notice-icon" aria-hidden />
        <div className="min-w-0">
          <p className="manage-notice-title">공지사항</p>
          <p className="manage-notice-body">
            {supabaseMode
              ? dataset
                ? `누적 데이터: 기준일 ${dataset.asOfDate} · ${dataset.personnel.length}명 · 업로드는 신규/변경만 반영합니다.`
                : 'Supabase에 활성 인원 데이터가 없습니다. Excel을 업로드해 누적 반영하세요.'
              : dataset
                ? `현재 활성 데이터: 기준일 ${dataset.asOfDate} · ${dataset.personnel.length}명 (최종 반영 전까지 유지)`
                : '현재 활성 인원 데이터 없음 · 이 브라우저에만 저장됩니다.'}
          </p>
        </div>
      </div>

      {committedInfo ? <p className="manage-ok-banner">{committedInfo}</p> : null}

      <section className="manage-panel">
        <div className="manage-panel-head">
          <div>
            <h2 className="manage-panel-title">Excel Upload</h2>
            <p className="manage-panel-sub">
              .xlsx · 기준 양식 인원현황5 · Table B6:T · 헤더 자동 확인
            </p>
          </div>
        </div>
        <div className="manage-panel-body">
          <div
            role="button"
            tabIndex={0}
            className={`manage-dropzone${dragging ? ' is-dragging' : ''}${busy ? ' is-busy' : ''}`}
            onClick={() => {
              if (!busy) inputRef.current?.click();
            }}
            onKeyDown={(e) => {
              if (busy) return;
              if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void onFile(file);
            }}
          >
            <div className="manage-dropzone-icon" aria-hidden>
              {busy ? (
                <Upload size={22} className="animate-pulse" />
              ) : (
                <Upload size={22} />
              )}
            </div>
            <p className="manage-dropzone-title">
              {busy
                ? '인원 Excel 분석 중…'
                : '인원 현황 Excel을 드래그하거나 클릭하여 업로드'}
            </p>
            <p className="manage-dropzone-hint">
              예: 2026.08.10 전체 인원 현황(수정).xlsx · Table 인원현황5
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
                e.target.value = '';
              }}
            />
          </div>

          {showFileStatus ? (
            <div className="manage-file-card">
              <FileSpreadsheet size={18} style={{ color: 'var(--accent)' }} />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-sm font-semibold"
                  style={{ color: 'var(--text)' }}
                >
                  {fileName || dataset?.fileName || '파일'}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {busy
                    ? '처리 중…'
                    : preview
                      ? preview.counts.error > 0
                        ? '비교 오류 · 반영 차단'
                        : '비교 완료 · 최종 반영 가능'
                      : validation
                        ? validation.canApply
                          ? validation.warningRows > 0
                            ? '경고 확인 후 다음 단계로'
                            : supabaseMode
                              ? '검증 완료 · DB 비교를 실행하세요'
                              : '검증 완료 · 최종 반영 가능'
                          : '오류가 있어 최종 반영할 수 없습니다'
                        : parsed
                          ? parsed.schemaOk
                            ? `추출 ${parsed.rows.length}명 · 기준일 확정 필요`
                            : '구조 오류 · 올바른 양식으로 다시 업로드'
                          : dataset
                            ? `활성 ${dataset.personnel.length}명 · 기준일 ${dataset.asOfDate}`
                            : '대기 중'}
                </p>
              </div>
              {!busy && (preview?.canApply || (!supabaseMode && validation?.canApply)) ? (
                <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
              ) : null}
              {!busy && (panelError || (validation && !validation.canApply) || (parsed && !parsed.schemaOk) || (preview && preview.counts.error > 0)) ? (
                <AlertTriangle size={18} style={{ color: 'var(--error)' }} />
              ) : null}
            </div>
          ) : null}

          {panelError ? <p className="manage-error-banner">{panelError}</p> : null}
        </div>
      </section>

      {parsed && !parsed.schemaOk && parsed.schemaIssues.length > 0 ? (
        <ul className="manage-error-banner list-disc space-y-1 pl-5" role="alert">
          {parsed.schemaIssues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}

      {parsed?.schemaOk ? (
        <section className="manage-panel">
          <div className="manage-panel-head">
            <div>
              <h2 className="manage-panel-title">기준일 확정</h2>
              <p className="manage-panel-sub">
                나이·근속은 확정한 기준일로 재계산합니다.
              </p>
            </div>
          </div>
          <div className="manage-panel-body">
            {parsed.dateSourcesConflict ? (
              <div className="manage-notice mb-3" role="note">
                <AlertTriangle size={18} className="manage-notice-icon" aria-hidden />
                <div className="min-w-0">
                  <p className="manage-notice-title">기준일 후보가 서로 다릅니다</p>
                  <label className="manage-ack-check">
                    <input
                      type="checkbox"
                      checked={dateAck}
                      onChange={(e) => setDateAck(e.target.checked)}
                    />
                    <span>위 차이를 확인했으며, 입력한 기준일로 검증을 진행합니다.</span>
                  </label>
                </div>
              </div>
            ) : null}
            <label className="flex max-w-xs flex-col gap-1 text-sm">
              <span className="text-muted font-semibold">반영 기준일 (YYYY-MM-DD)</span>
              <input
                type="date"
                className="query-filter-input h-10 rounded-[10px] border px-3"
                value={asOfDate}
                onChange={(e) => {
                  setAsOfDate(e.target.value);
                  setValidation(null);
                  setPreview(null);
                  setStep('parsed');
                }}
              />
            </label>
            <div className="manage-page-actions" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="manage-action-btn manage-action-btn-primary"
                onClick={runValidate}
                disabled={
                  busy ||
                  !asOfDate.trim() ||
                  (parsed.dateSourcesConflict && !dateAck)
                }
              >
                검증 실행
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {validation ? (
        <>
          <div className="manage-kpi-grid">
            {[
              {
                label: '정상',
                value: validation.normalRows,
                tone: 'ok' as const,
                hint: '경고·오류 없음',
              },
              {
                label: '경고',
                value: validation.warningRows,
                tone: 'warn' as const,
                hint: '확인 후 반영 가능',
              },
              {
                label: '오류',
                value: validation.errorRows,
                tone: 'danger' as const,
                hint: '있으면 반영 차단',
              },
              {
                label: '전체',
                value: validation.totalRows,
                tone: 'accent' as const,
                hint: supabaseMode
                  ? '누적 비교 대상'
                  : `활성 ${dataset?.personnel.length ?? 0}명 → 교체`,
              },
            ].map((item) => (
              <div key={item.label} className={`manage-kpi-card manage-kpi-card-${item.tone}`}>
                <p className="manage-kpi-label">{item.label}</p>
                <p className="manage-kpi-value num">
                  {item.value.toLocaleString('ko-KR')}건
                </p>
                <p className="manage-kpi-hint">{item.hint}</p>
              </div>
            ))}
          </div>

          <section className="manage-panel">
            <div className="manage-panel-head">
              <div>
                <h2 className="manage-panel-title">검증 이슈</h2>
                <p className="manage-panel-sub">
                  원본 행 · 사번 · 성명 · 필드 · 사유
                </p>
              </div>
            </div>
            <div className="manage-panel-body">
              {!validation.canApply ? (
                <p className="manage-error-banner mb-3">
                  오류가 하나라도 있으면 최종 반영할 수 없습니다. 파일을 수정한 뒤 다시
                  업로드하세요.
                </p>
              ) : null}
              {validation.warningRows > 0 ? (
                <label className="manage-ack-check mb-3">
                  <input
                    type="checkbox"
                    checked={warningsAck}
                    onChange={(e) => setWarningsAck(e.target.checked)}
                  />
                  <span>경고 {validation.warningRows}건을 확인했으며 반영을 진행합니다.</span>
                </label>
              ) : null}
              <div className="table-wrap table-wrap-list max-h-[420px] overflow-auto">
                <table className="data-table min-w-[880px] w-full text-sm">
                  <thead>
                    <tr>
                      <th>Excel 행</th>
                      <th>사번</th>
                      <th>성명</th>
                      <th>컬럼</th>
                      <th>구분</th>
                      <th>사유</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.issues.map((issue, idx) => (
                      <tr key={`${issue.excelRow}-${issue.field}-${idx}`}>
                        <td className="num">{issue.excelRow}</td>
                        <td className="num">{issue.employeeNo}</td>
                        <td>{issue.name}</td>
                        <td>{issue.field}</td>
                        <td>
                          <span
                            className="table-status"
                            data-tone={
                              issue.severity === 'error' ? 'warn' : 'neutral'
                            }
                          >
                            {issue.severity === 'error' ? '오류' : '경고'}
                          </span>
                        </td>
                        <td>{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validation.issues.length === 0 ? (
                  <p className="text-muted px-4 py-6 text-center text-sm">이슈 없음</p>
                ) : null}
              </div>
              <div className="manage-page-actions" style={{ marginTop: 14 }}>
                {supabaseMode ? (
                  <button
                    type="button"
                    className="manage-action-btn manage-action-btn-primary"
                    disabled={
                      !validation.canApply ||
                      busy ||
                      (validation.warningRows > 0 && !warningsAck)
                    }
                    onClick={() => void runPreview()}
                  >
                    {busy ? '비교 중…' : 'DB 비교 미리보기'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="manage-action-btn manage-action-btn-primary"
                    disabled={!canCommitIndexed || busy}
                    onClick={() => void commitIndexed()}
                  >
                    {busy ? '반영 중…' : '최종 반영 (현재 데이터 교체)'}
                  </button>
                )}
                <button
                  type="button"
                  className="manage-action-btn manage-action-btn-secondary"
                  onClick={reset}
                  disabled={busy}
                >
                  취소
                </button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {preview ? (
        <>
          <div className="manage-kpi-grid">
            {[
              { label: '전체', value: preview.counts.total, tone: 'accent' as const },
              { label: '신규', value: preview.counts.new, tone: 'ok' as const },
              { label: '변경', value: preview.counts.changed, tone: 'warn' as const },
              { label: '동일', value: preview.counts.unchanged, tone: 'ok' as const },
              { label: '오류', value: preview.counts.error, tone: 'danger' as const },
              { label: '누락', value: preview.counts.missing, tone: 'warn' as const },
            ].map((item) => (
              <div key={item.label} className={`manage-kpi-card manage-kpi-card-${item.tone}`}>
                <p className="manage-kpi-label">{item.label}</p>
                <p className="manage-kpi-value num">
                  {item.value.toLocaleString('ko-KR')}건
                </p>
              </div>
            ))}
          </div>

          <section className="manage-panel">
            <div className="manage-panel-head">
              <div>
                <h2 className="manage-panel-title">누적 반영 검토</h2>
                <p className="manage-panel-sub">
                  파일에 없는 사번은 누락으로만 표시하며 자동 퇴사하지 않습니다.
                </p>
              </div>
            </div>
            <div className="manage-panel-body">
              <div className="manage-page-actions mb-3" style={{ flexWrap: 'wrap' }}>
                {(
                  [
                    ['new', `신규 (${preview.counts.new})`],
                    ['changed', `변경 (${preview.counts.changed})`],
                    ['errors', `오류 (${preview.counts.error})`],
                    ['missing', `누락 (${preview.counts.missing})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`manage-action-btn${reviewTab === key ? ' manage-action-btn-primary' : ''}`}
                    onClick={() => setReviewTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="table-wrap table-wrap-list max-h-[420px] overflow-auto">
                {reviewTab === 'new' ? (
                  <table className="data-table min-w-[640px] w-full text-sm">
                    <thead>
                      <tr>
                        <th>Excel 행</th>
                        <th>사번</th>
                        <th>성명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.newRows.map((row) => (
                        <tr key={`n-${row.excelRow}-${row.employeeNo}`}>
                          <td className="num">{row.excelRow}</td>
                          <td className="num">{row.employeeNo}</td>
                          <td>{row.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}

                {reviewTab === 'changed' ? (
                  <table className="data-table min-w-[880px] w-full text-sm">
                    <thead>
                      <tr>
                        <th>사번</th>
                        <th>성명</th>
                        <th>항목</th>
                        <th>기존</th>
                        <th>신규</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.changedRows.flatMap((row) =>
                        row.changes.map((change, idx) => (
                          <tr key={`c-${row.employeeNo}-${change.field}-${idx}`}>
                            <td className="num">{row.employeeNo}</td>
                            <td>{row.name}</td>
                            <td>{change.label}</td>
                            <td>{change.oldValue || '-'}</td>
                            <td>{change.newValue || '-'}</td>
                          </tr>
                        )),
                      )}
                    </tbody>
                  </table>
                ) : null}

                {reviewTab === 'errors' ? (
                  <table className="data-table min-w-[720px] w-full text-sm">
                    <thead>
                      <tr>
                        <th>Excel 행</th>
                        <th>사번</th>
                        <th>성명</th>
                        <th>사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.errorRows.map((row, idx) => (
                        <tr key={`e-${row.excelRow}-${idx}`}>
                          <td className="num">{row.excelRow}</td>
                          <td className="num">{row.employeeNo || '-'}</td>
                          <td>{row.name || '-'}</td>
                          <td>{row.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}

                {reviewTab === 'missing' ? (
                  <table className="data-table min-w-[640px] w-full text-sm">
                    <thead>
                      <tr>
                        <th>사번</th>
                        <th>성명</th>
                        <th>근무현황</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.missingRows.map((row) => (
                        <tr key={`m-${row.employeeNo}`}>
                          <td className="num">{row.employeeNo}</td>
                          <td>{row.name}</td>
                          <td>{row.employmentStatus || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}

                {((reviewTab === 'new' && preview.newRows.length === 0) ||
                  (reviewTab === 'changed' && preview.changedRows.length === 0) ||
                  (reviewTab === 'errors' && preview.errorRows.length === 0) ||
                  (reviewTab === 'missing' && preview.missingRows.length === 0)) && (
                  <p className="text-muted px-4 py-6 text-center text-sm">해당 항목 없음</p>
                )}
              </div>

              <div className="manage-page-actions" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="manage-action-btn manage-action-btn-primary"
                  disabled={!canCommitSupabase || busy}
                  onClick={() => void commitSupabase()}
                >
                  {busy ? '반영 중…' : '최종 반영 (누적)'}
                </button>
                <button
                  type="button"
                  className="manage-action-btn manage-action-btn-secondary"
                  onClick={reset}
                  disabled={busy}
                >
                  취소
                </button>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {step === 'parsed' && parsed?.schemaOk && !validation ? (
        <p className="text-muted text-sm">기준일을 확정한 뒤 검증을 실행하세요.</p>
      ) : null}
    </div>
  );
}
