import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { isSupabaseDataSource } from './dataSource';
import { DatasetVersionConflictError, type ActiveDataset, type Personnel } from './types';

/**
 * 데이터 저장소 어댑터.
 * - indexeddb: 이 모듈의 load/save/clear/update
 * - supabase: WorkforceProvider → `/api/employees` · import/apply · PATCH (이 모듈 쓰기 경로 사용 금지)
 */
export type WorkforceRepositoryMode = 'supabase' | 'indexeddb';

export function getWorkforceRepositoryMode(): WorkforceRepositoryMode {
  return isSupabaseDataSource() ? 'supabase' : 'indexeddb';
}

function assertIndexedDbMode(action: string): void {
  if (isSupabaseDataSource()) {
    throw new Error(
      `Supabase 모드에서는 IndexedDB ${action}을(를) 사용할 수 없습니다. API 경로를 사용하세요.`,
    );
  }
}

const DB_NAME = 'vina-workforce-db';
const DB_VERSION = 1;
const STORE_NAME = 'activeDataset';
const ACTIVE_KEY = 'current';

interface VinaWorkforceDb extends DBSchema {
  activeDataset: {
    key: string;
    value: ActiveDataset;
  };
}

let dbPromise: Promise<IDBPDatabase<VinaWorkforceDb>> | null = null;

function getDb(): Promise<IDBPDatabase<VinaWorkforceDb>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB를 사용할 수 없습니다.'));
  }
  if (!dbPromise) {
    dbPromise = openDB<VinaWorkforceDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

function normalizePersonnelRecord(person: Personnel): Personnel {
  return {
    ...person,
    department:
      typeof person.department === 'string' ? person.department : '',
  };
}

export async function loadActiveDataset(): Promise<ActiveDataset | null> {
  const db = await getDb();
  const data = (await db.get(STORE_NAME, ACTIVE_KEY)) ?? null;
  if (!data) return null;
  return {
    ...data,
    personnel: data.personnel.map(normalizePersonnelRecord),
  };
}

export async function saveActiveDataset(
  data: ActiveDataset,
  expectedVersion?: string,
): Promise<ActiveDataset> {
  assertIndexedDbMode('save');
  const db = await getDb();
  if (expectedVersion !== undefined) {
    const current = await db.get(STORE_NAME, ACTIVE_KEY);
    if (current && current.versionId !== expectedVersion) {
      throw new DatasetVersionConflictError(expectedVersion, current.versionId);
    }
  }
  await db.put(STORE_NAME, data, ACTIVE_KEY);
  return data;
}

/** 이 브라우저에 저장된 활성 인원 데이터를 삭제합니다. */
export async function clearActiveDataset(): Promise<void> {
  assertIndexedDbMode('clear');
  const db = await getDb();
  await db.delete(STORE_NAME, ACTIVE_KEY);
}

export async function updatePersonnel(
  id: string,
  patch: Partial<Personnel>,
  expectedVersion: string,
): Promise<ActiveDataset> {
  assertIndexedDbMode('update');
  const db = await getDb();
  const current = await db.get(STORE_NAME, ACTIVE_KEY);
  if (!current) {
    throw new Error('활성 인원 데이터가 없습니다.');
  }
  if (current.versionId !== expectedVersion) {
    throw new DatasetVersionConflictError(expectedVersion, current.versionId);
  }

  const index = current.personnel.findIndex((p) => p.id === id);
  if (index < 0) {
    throw new Error('해당 인원을 찾을 수 없습니다.');
  }

  const now = new Date().toISOString();
  const updatedPerson: Personnel = {
    ...current.personnel[index],
    ...patch,
    id: current.personnel[index].id,
    updatedAt: now,
  };

  const nextPersonnel = [...current.personnel];
  nextPersonnel[index] = updatedPerson;

  const next: ActiveDataset = {
    ...current,
    personnel: nextPersonnel,
    updatedAt: now,
  };

  await db.put(STORE_NAME, next, ACTIVE_KEY);
  return next;
}

export function createVersionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
