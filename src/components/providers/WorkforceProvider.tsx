'use client';

import {
  clearActiveDataset,
  clearAllPageViewState,
  loadActiveDataset,
  saveActiveDataset,
  updatePersonnel,
  type ActiveDataset,
  type Personnel,
} from '@/lib/vina';
import { DatasetVersionConflictError } from '@/lib/vina/types';
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
  reload: () => Promise<void>;
  applyImport: (next: ActiveDataset) => Promise<void>;
  /** 활성 Excel 반영 데이터·화면 조회 상태를 이 브라우저에서 삭제 */
  clearDataset: () => Promise<void>;
  updateEmployee: (id: string, patch: Partial<Personnel>) => Promise<Personnel>;
}

const WorkforceContext = createContext<WorkforceContextValue | null>(null);

export function WorkforceProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<ActiveDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadActiveDataset();
      setDataset(data);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '인원 데이터를 불러오지 못했습니다.';
      setError(message);
      setDataset(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const applyImport = useCallback(async (next: ActiveDataset) => {
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
  }, []);

  const clearDataset = useCallback(async () => {
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
  }, []);

  const updateEmployee = useCallback(
    async (id: string, patch: Partial<Personnel>): Promise<Personnel> => {
      if (!dataset) {
        throw new Error('활성 인원 데이터가 없습니다.');
      }
      setError(null);
      try {
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
    [dataset],
  );

  const personnel = dataset?.personnel ?? [];

  const value = useMemo(
    (): WorkforceContextValue => ({
      dataset,
      personnel,
      loading,
      error,
      reload,
      applyImport,
      clearDataset,
      updateEmployee,
    }),
    [
      dataset,
      personnel,
      loading,
      error,
      reload,
      applyImport,
      clearDataset,
      updateEmployee,
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
