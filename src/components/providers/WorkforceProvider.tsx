'use client';

import {
  clearActiveDataset,
  clearAllPageViewState,
  isSupabaseDataSource,
  loadActiveDataset,
  saveActiveDataset,
  updatePersonnel,
  type ActiveDataset,
  type Personnel,
} from '@/lib/vina';
import { DatasetVersionConflictError } from '@/lib/vina/types';
import { useAdmin } from '@/components/providers/AdminProvider';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface WorkforceContextValue {
  dataset: ActiveDataset | null;
  personnel: Personnel[];
  loading: boolean;
  error: string | null;
  dataSource: 'supabase' | 'indexeddb';
  reload: () => Promise<void>;
  applyImport: (next: ActiveDataset) => Promise<void>;
  /** 활성 Excel 반영 데이터·화면 조회 상태를 이 브라우저에서 삭제 (IndexedDB 전용) */
  clearDataset: () => Promise<void>;
  updateEmployee: (id: string, patch: Partial<Personnel>) => Promise<Personnel>;
  /** API 응답으로 로컬 인원 한 명을 즉시 반영 (사진 등록/삭제 등) */
  syncEmployee: (employee: Personnel) => void;
}

const WorkforceContext = createContext<WorkforceContextValue | null>(null);

async function loadFromSupabaseApi(): Promise<ActiveDataset | null> {
  const res = await fetch('/api/employees', { credentials: 'include' });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || '인원 데이터를 불러오지 못했습니다.');
  }
  const body = (await res.json()) as { dataset: ActiveDataset | null };
  return body.dataset;
}

export function WorkforceProvider({ children }: { children: ReactNode }) {
  const { authenticated, authLoading } = useAdmin();
  const supabaseMode = isSupabaseDataSource();
  const [dataset, setDataset] = useState<ActiveDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!authenticated) {
      setDataset(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = supabaseMode
        ? await loadFromSupabaseApi()
        : await loadActiveDataset();
      setDataset(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '인원 데이터를 불러오지 못했습니다.';
      setError(message);
      setDataset(null);
    } finally {
      setLoading(false);
    }
  }, [authenticated, supabaseMode]);

  useEffect(() => {
    if (authLoading) return;
    void reload();
  }, [authLoading, reload]);

  const applyImport = useCallback(
    async (next: ActiveDataset) => {
      if (supabaseMode) {
        throw new Error(
          'Supabase 모드에서는 /api/admin/import/apply 로 반영하세요.',
        );
      }
      setError(null);
      try {
        const saved = await saveActiveDataset(next);
        clearAllPageViewState();
        setDataset(saved);
      } catch (err) {
        if (err instanceof DatasetVersionConflictError) {
          throw err;
        }
        const message =
          err instanceof Error ? err.message : '인원 데이터 저장에 실패했습니다.';
        setError(message);
        throw err;
      }
    },
    [supabaseMode],
  );

  const clearDataset = useCallback(async () => {
    if (supabaseMode) {
      throw new Error(
        'Supabase 모드에서는 브라우저 시드 초기화를 사용할 수 없습니다. 업로드 복구를 이용하세요.',
      );
    }
    setError(null);
    try {
      await clearActiveDataset();
      clearAllPageViewState();
      setDataset(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '인원 데이터 초기화에 실패했습니다.';
      setError(message);
      throw err;
    }
  }, [supabaseMode]);

  const syncEmployee = useCallback((employee: Personnel) => {
    setDataset((prev) => {
      if (!prev) return prev;
      let found = false;
      const personnel = prev.personnel.map((p) => {
        if (p.id !== employee.id) return p;
        found = true;
        return { ...p, ...employee };
      });
      if (!found) return prev;
      return {
        ...prev,
        personnel,
        updatedAt: employee.updatedAt || prev.updatedAt,
      };
    });
  }, []);

  const updateEmployee = useCallback(
    async (id: string, patch: Partial<Personnel>): Promise<Personnel> => {
      if (!dataset) {
        throw new Error('활성 인원 데이터가 없습니다.');
      }
      setError(null);
      try {
        if (supabaseMode) {
          const res = await fetch(`/api/employees/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
          const body = (await res.json().catch(() => null)) as {
            employee?: Personnel;
            message?: string;
          } | null;
          if (!res.ok) {
            throw new Error(body?.message || '인원 수정 저장에 실패했습니다.');
          }
          const updated = body?.employee;
          if (!updated) throw new Error('수정된 인원을 찾을 수 없습니다.');
          setDataset({
            ...dataset,
            personnel: dataset.personnel.map((p) =>
              p.id === id ? updated : p,
            ),
            updatedAt: updated.updatedAt,
          });
          return updated;
        }

        const next = await updatePersonnel(id, patch, dataset.versionId);
        setDataset(next);
        const updated = next.personnel.find((p) => p.id === id);
        if (!updated) {
          throw new Error('수정된 인원을 찾을 수 없습니다.');
        }
        return updated;
      } catch (err) {
        if (err instanceof DatasetVersionConflictError) {
          throw err;
        }
        const message =
          err instanceof Error ? err.message : '인원 수정 저장에 실패했습니다.';
        setError(message);
        throw err;
      }
    },
    [dataset, supabaseMode],
  );

  const personnel = dataset?.personnel ?? [];

  const value = useMemo(
    (): WorkforceContextValue => ({
      dataset,
      personnel,
      loading,
      error,
      dataSource: supabaseMode ? 'supabase' : 'indexeddb',
      reload,
      applyImport,
      clearDataset,
      updateEmployee,
      syncEmployee,
    }),
    [
      dataset,
      personnel,
      loading,
      error,
      supabaseMode,
      reload,
      applyImport,
      clearDataset,
      updateEmployee,
      syncEmployee,
    ],
  );

  return (
    <WorkforceContext.Provider value={value}>{children}</WorkforceContext.Provider>
  );
}

export function useWorkforce(): WorkforceContextValue {
  const ctx = useContext(WorkforceContext);
  if (!ctx) {
    throw new Error('useWorkforce must be used within WorkforceProvider');
  }
  return ctx;
}
