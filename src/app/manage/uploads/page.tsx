'use client';

import { useAdmin } from '@/components/providers/AdminProvider';
import { useWorkforce } from '@/components/providers/WorkforceProvider';
import { isSupabaseDataSource } from '@/lib/vina';
import {
  ChevronRight,
  History,
  LayoutDashboard,
  RotateCcw,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface UploadRow {
  id: string;
  fileName: string;
  asOfDate: string;
  uploadedAt: string;
  uploadedBy: string | null;
  totalCount: number;
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  errorCount: number;
  missingCount: number;
  status: string;
}

export default function UploadsPage() {
  const { isAdmin, authLoading } = useAdmin();
  const { reload, dataSource } = useWorkforce();
  const supabaseMode = dataSource === 'supabase' || isSupabaseDataSource();

  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/uploads', { credentials: 'include' });
      const body = (await res.json()) as {
        uploads?: UploadRow[];
        message?: string;
      };
      if (!res.ok) throw new Error(body.message || '목록을 불러오지 못했습니다.');
      setUploads(body.uploads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '목록을 불러오지 못했습니다.');
      setUploads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin && supabaseMode) void load();
  }, [isAdmin, supabaseMode, load]);

  const rollback = async (upload: UploadRow) => {
    const confirmed = window.confirm(
      `"${upload.fileName}" (${upload.asOfDate}) 반영을 복구할까요?\n이후 수동·다른 업로드로 바뀐 필드는 건너뜁니다.`,
    );
    if (!confirmed) return;

    setBusyId(upload.id);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(
        `/api/admin/uploads/${encodeURIComponent(upload.id)}/rollback`,
        { method: 'POST', credentials: 'include' },
      );
      const body = (await res.json()) as {
        message?: string;
        result?: {
          revertedFields?: number;
          deletedEmployees?: number;
          skipped?: number;
        };
      };
      if (!res.ok) throw new Error(body.message || '복구에 실패했습니다.');
      const r = body.result;
      setInfo(
        `복구 완료 · 필드 ${r?.revertedFields ?? 0} · 삭제 ${r?.deletedEmployees ?? 0} · 건너뜀 ${r?.skipped ?? 0}`,
      );
      await load();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '복구에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading) {
    return <p className="text-muted text-sm">권한 확인 중…</p>;
  }

  if (!isAdmin) {
    return (
      <div className="manage-page">
        <header className="manage-page-header">
          <div className="min-w-0">
            <p className="manage-page-kicker">DATA MANAGEMENT</p>
            <h1 className="manage-page-title">업로드 이력</h1>
          </div>
        </header>
        <section className="manage-panel">
          <div className="manage-panel-head">
            <div>
              <h2 className="manage-panel-title">관리자 권한 필요</h2>
              <p className="manage-panel-sub">
                업로드 이력·롤백은 관리자만 사용할 수 있습니다.
              </p>
            </div>
          </div>
          <div className="manage-panel-body">
            <a href="/" className="manage-action-btn">
              대시보드로
            </a>
          </div>
        </section>
      </div>
    );
  }

  if (!supabaseMode) {
    return (
      <div className="manage-page">
        <header className="manage-page-header">
          <div className="min-w-0">
            <p className="manage-page-kicker">DATA MANAGEMENT</p>
            <h1 className="manage-page-title">업로드 이력</h1>
          </div>
        </header>
        <p className="manage-notice-body text-sm">
          Supabase 모드(`NEXT_PUBLIC_VINA_DATA_SOURCE=supabase`)에서만 사용할 수
          있습니다.
        </p>
        <Link href="/manage/import" className="manage-action-btn">
          데이터 업로드
        </Link>
      </div>
    );
  }

  return (
    <div className="manage-page">
      <header className="manage-page-header">
        <div className="min-w-0">
          <p className="manage-page-kicker">DATA MANAGEMENT</p>
          <h1 className="manage-page-title">업로드 이력</h1>
        </div>
        <div className="manage-page-actions">
          <nav className="manage-header-nav" aria-label="바로가기">
            <span className="manage-header-nav-label">바로가기</span>
            <Link
              href="/manage/import"
              className="manage-header-nav-link"
              title="데이터 업로드 페이지로 이동"
            >
              <span className="manage-header-nav-icon" aria-hidden>
                <Upload size={15} strokeWidth={2.25} />
              </span>
              <span className="manage-header-nav-text">데이터 업로드</span>
              <ChevronRight
                className="manage-header-nav-chevron"
                size={14}
                strokeWidth={2.25}
                aria-hidden
              />
            </Link>
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
          <button
            type="button"
            className="manage-action-btn"
            onClick={() => void load()}
            disabled={loading}
          >
            <RotateCcw size={15} aria-hidden />
            새로고침
          </button>
        </div>
      </header>

      {info ? <p className="manage-ok-banner">{info}</p> : null}
      {error ? <p className="manage-error-banner">{error}</p> : null}

      <section className="manage-panel">
        <div className="manage-panel-head">
          <div>
            <h2 className="manage-panel-title">
              <History size={18} className="inline" aria-hidden /> 업로드 목록
            </h2>
            <p className="manage-panel-sub">
              반영이 완료된 업로드만 표시됩니다. 복구 시 이후 변경된 필드는 보존됩니다.
            </p>
          </div>
        </div>
        <div className="manage-panel-body">
          {loading ? (
            <p className="text-muted text-sm">불러오는 중…</p>
          ) : (
            <div className="table-wrap table-wrap-list max-h-[640px] overflow-auto">
              <table className="data-table min-w-[960px] w-full text-sm">
                <thead>
                  <tr>
                    <th>파일</th>
                    <th>기준일</th>
                    <th>업로드</th>
                    <th>신규</th>
                    <th>변경</th>
                    <th>동일</th>
                    <th>오류</th>
                    <th>누락</th>
                    <th>상태</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((row) => (
                    <tr key={row.id}>
                      <td>{row.fileName}</td>
                      <td className="num">{row.asOfDate}</td>
                      <td className="num">
                        {new Date(row.uploadedAt).toLocaleString('ko-KR')}
                      </td>
                      <td className="num">{row.newCount}</td>
                      <td className="num">{row.changedCount}</td>
                      <td className="num">{row.unchangedCount}</td>
                      <td className="num">{row.errorCount}</td>
                      <td className="num">{row.missingCount}</td>
                      <td>
                        <span className="table-status" data-tone="ok">
                          반영됨
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="manage-action-btn manage-action-btn-danger"
                          disabled={busyId === row.id}
                          onClick={() => void rollback(row)}
                        >
                          {busyId === row.id ? '복구 중…' : '복구'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {uploads.length === 0 ? (
                <p className="text-muted px-4 py-6 text-center text-sm">
                  반영된 업로드 이력이 없습니다.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
