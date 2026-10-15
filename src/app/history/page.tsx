'use client';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { isSupabaseDataSource } from '@/lib/vina';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface HistoryRow {
  id: string;
  employeeId: string;
  employeeNo: string;
  name: string;
  fieldLabel: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
  changeSource: string;
  changedBy: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  upload: '업로드',
  manual: '수동',
  resign_confirm: '퇴사확인',
  rollback: '복구',
};

function displayValue(fieldName: string, value: string, side: 'old' | 'new') {
  if (fieldName === 'photo_path') {
    if (side === 'old') return value ? '등록됨' : '-';
    return value ? '등록됨' : '삭제됨';
  }
  if (fieldName === '_created') {
    return side === 'old' ? '-' : value || '1';
  }
  return value || '-';
}

export default function HistoryPage() {
  const supabaseMode = isSupabaseDataSource();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeNo, setEmployeeNo] = useState('');

  const load = useCallback(async (filterNo?: string) => {
    if (!supabaseMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100', offset: '0' });
      const no = (filterNo ?? '').trim();
      if (no) params.set('employeeNo', no);
      const res = await fetch(`/api/history?${params.toString()}`, {
        credentials: 'include',
      });
      const body = (await res.json()) as {
        history?: HistoryRow[];
        total?: number;
        message?: string;
      };
      if (!res.ok) throw new Error(body.message || '이력을 불러오지 못했습니다.');
      setRows(body.history ?? []);
      setTotal(body.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '이력을 불러오지 못했습니다.');
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [supabaseMode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!supabaseMode) {
    return (
      <div className="space-y-6">
        <PageHeader title="변경 이력" />
        <EmptyState
          title="Supabase 모드에서만 사용할 수 있습니다"
          description="NEXT_PUBLIC_VINA_DATA_SOURCE=supabase 로 설정하세요."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="변경 이력" />

      <Panel
        title="전체 변경 이력"
        description={
          loading
            ? '불러오는 중…'
            : `최근 ${rows.length.toLocaleString('ko-KR')}건 · 전체 ${total.toLocaleString('ko-KR')}건`
        }
      >
        <form
          className="mb-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(employeeNo);
          }}
        >
          <label className="flex min-w-[200px] flex-col gap-1 text-sm">
            <span className="text-muted font-semibold">사번 검색</span>
            <input
              type="text"
              className="query-filter-input h-10 rounded-[10px] border px-3"
              value={employeeNo}
              onChange={(e) => setEmployeeNo(e.target.value)}
              placeholder="예: NV056"
            />
          </label>
          <button type="submit" className="manage-action-btn manage-action-btn-primary">
            검색
          </button>
          <button
            type="button"
            className="manage-action-btn"
            onClick={() => {
              setEmployeeNo('');
              void load('');
            }}
          >
            초기화
          </button>
        </form>

        {error ? <p className="manage-error-banner mb-3">{error}</p> : null}

        {loading ? (
          <p className="text-muted text-sm">이력을 불러오는 중…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted text-sm">변경 이력이 없습니다.</p>
        ) : (
          <div className="table-wrap table-wrap-list max-h-[640px] overflow-auto">
            <table className="data-table min-w-[960px] w-full text-sm">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>사번</th>
                  <th>성명</th>
                  <th>항목</th>
                  <th>이전</th>
                  <th>이후</th>
                  <th>출처</th>
                  <th>수정자</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td className="num">
                      {new Date(item.changedAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="num">
                      {item.employeeId ? (
                        <Link
                          href={`/employees/${encodeURIComponent(item.employeeId)}?from=${encodeURIComponent('/history')}`}
                          className="table-link"
                        >
                          {item.employeeNo}
                        </Link>
                      ) : (
                        item.employeeNo
                      )}
                    </td>
                    <td>{item.name || '-'}</td>
                    <td>{item.fieldLabel}</td>
                    <td>
                      {displayValue(item.fieldName, item.oldValue, 'old')}
                    </td>
                    <td>
                      {displayValue(item.fieldName, item.newValue, 'new')}
                    </td>
                    <td>
                      {SOURCE_LABEL[item.changeSource] ?? item.changeSource}
                    </td>
                    <td>{item.changedBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
