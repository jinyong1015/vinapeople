'use client';

import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { useAdmin } from '@/components/providers/AdminProvider';
import { ChevronRight, History, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface UploadRow {
  id: string;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string | null;
  totalCount: number;
  newCount: number;
  changedCount: number;
  unchangedCount: number;
  errorCount: number;
  unmatchedCount: number;
  status: string;
}

export default function AttendanceUploadsPage() {
  const { isAdmin, authLoading } = useAdmin();
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/attendance/uploads', {
        credentials: 'include',
      });
      const body = (await res.json()) as {
        uploads?: UploadRow[];
        message?: string;
      };
      if (!res.ok) throw new Error(body.message || '이력 조회에 실패했습니다.');
      setUploads(body.uploads ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '이력 조회에 실패했습니다.');
      setUploads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) void load();
    if (!authLoading && !isAdmin) setLoading(false);
  }, [authLoading, isAdmin, load]);

  if (authLoading) {
    return <p className="text-muted text-sm">권한 확인 중…</p>;
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title="근태 업로드 이력" />
        <p className="text-muted text-sm">
          업로드 이력은 관리자만 확인할 수 있습니다. 조회는 근태 현황 메뉴를
          이용해 주세요.
        </p>
        <Link href="/attendance" className="manage-action-btn">
          근태 현황으로
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="근태 업로드 이력"
        description="반영이 완료된 근태 엑셀 업로드만 표시합니다."
        actions={
          <nav className="manage-header-nav" aria-label="바로가기">
            <span className="manage-header-nav-label">바로가기</span>
            <Link href="/attendance" className="manage-header-nav-link">
              <span className="manage-header-nav-icon" aria-hidden>
                <History size={15} />
              </span>
              <span className="manage-header-nav-text">근태 현황</span>
              <ChevronRight size={14} aria-hidden />
            </Link>
            <Link href="/" className="manage-header-nav-link">
              <span className="manage-header-nav-icon" aria-hidden>
                <LayoutDashboard size={15} />
              </span>
              <span className="manage-header-nav-text">대시보드</span>
              <ChevronRight size={14} aria-hidden />
            </Link>
          </nav>
        }
      />

      {error ? <p className="manage-error-banner">{error}</p> : null}

      <Panel title="업로드 목록" description="신규·변경·동일 건수는 실제 반영 결과입니다.">
        <div className="table-wrap table-wrap-list max-h-[640px] overflow-auto">
          <table className="data-table min-w-[960px] w-full text-sm">
            <thead>
              <tr>
                <th>파일</th>
                <th>업로드</th>
                <th>전체</th>
                <th>신규</th>
                <th>변경</th>
                <th>동일</th>
                <th>오류</th>
                <th>미매칭</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((row) => (
                <tr key={row.id}>
                  <td>{row.fileName}</td>
                  <td className="num">
                    {new Date(row.uploadedAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="num">{row.totalCount}</td>
                  <td className="num">{row.newCount}</td>
                  <td className="num">{row.changedCount}</td>
                  <td className="num">{row.unchangedCount}</td>
                  <td className="num">{row.errorCount}</td>
                  <td className="num">{row.unmatchedCount}</td>
                  <td>
                    <span className="table-status" data-tone="ok">
                      반영됨
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? (
            <p className="text-muted px-4 py-6 text-center text-sm">불러오는 중…</p>
          ) : uploads.length === 0 ? (
            <p className="text-muted px-4 py-6 text-center text-sm">
              반영된 근태 업로드 이력이 없습니다.
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
