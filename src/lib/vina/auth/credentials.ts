import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { isSupabaseDataSource } from '../dataSource';
import { hashPassword, looksLikeBcryptHash } from './password';
import {
  fetchAdminPasswordHashFromSupabase,
  upsertAdminPasswordHashToSupabase,
} from './supabaseAdmin';

export type StoredAdminCredentials = {
  algorithm: 'bcrypt';
  passwordHash: string;
  createdAt: string;
  /** 부트스트랩으로 생성된 경우에만 true */
  bootstrapped?: boolean;
};

const DATA_DIR = path.join(process.cwd(), '.data');
const CREDENTIALS_PATH = path.join(DATA_DIR, 'vina-admin.json');

export function getCredentialsFilePath(): string {
  return CREDENTIALS_PATH;
}

async function readStoredCredentials(): Promise<StoredAdminCredentials | null> {
  try {
    const raw = await readFile(CREDENTIALS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as StoredAdminCredentials;
    if (
      parsed?.algorithm === 'bcrypt' &&
      typeof parsed.passwordHash === 'string' &&
      looksLikeBcryptHash(parsed.passwordHash)
    ) {
      return parsed;
    }
    return null;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return null;
    return null;
  }
}

/**
 * 파일이 없을 때만 해시 저장 (wx). 이미 있으면 false.
 * 앱 재시작으로 비밀번호가 덮어씌워지지 않도록 한다.
 */
export async function writeCredentialsIfAbsent(
  passwordHash: string,
  bootstrapped = false,
): Promise<boolean> {
  if (!looksLikeBcryptHash(passwordHash)) {
    throw new Error('Invalid password hash format');
  }
  await mkdir(DATA_DIR, { recursive: true });
  const payload: StoredAdminCredentials = {
    algorithm: 'bcrypt',
    passwordHash,
    createdAt: new Date().toISOString(),
    bootstrapped,
  };
  try {
    await writeFile(CREDENTIALS_PATH, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') return false;
    throw err;
  }
}

/** Vercel 등 읽기 전용 FS에서 부트스트랩 해시 재계산을 줄이기 위한 프로세스 캐시 */
let bootstrapHashCache: string | null = null;

/**
 * 검증에 사용할 관리자 비밀번호 해시를 반환한다.
 * 우선순위:
 * 1) Supabase 모드 → vina_admin_settings (service_role)
 * 2) VINA_ADMIN_PASSWORD_HASH (IndexedDB/레거시)
 * 3) .data/vina-admin.json (로컬)
 * 4) VINA_ADMIN_BOOTSTRAP_PASSWORD → Supabase 또는 파일에 저장
 */
export async function resolveAdminPasswordHash(): Promise<string | null> {
  if (isSupabaseDataSource()) {
    try {
      const fromDb = await fetchAdminPasswordHashFromSupabase();
      if (fromDb) return fromDb;
    } catch (err) {
      console.error(
        '[vina-auth] Supabase admin hash resolve failed:',
        err instanceof Error ? err.message : err,
      );
    }

    const bootstrap = process.env.VINA_ADMIN_BOOTSTRAP_PASSWORD?.trim();
    if (!bootstrap) return null;

    if (bootstrapHashCache && looksLikeBcryptHash(bootstrapHashCache)) {
      return bootstrapHashCache;
    }

    const passwordHash = await hashPassword(bootstrap);
    try {
      await upsertAdminPasswordHashToSupabase(passwordHash, 'bootstrap');
    } catch (err) {
      console.warn(
        '[vina-auth] Could not persist admin hash to Supabase; using in-memory bootstrap hash.',
        err instanceof Error ? err.message : err,
      );
    }
    bootstrapHashCache = passwordHash;
    return passwordHash;
  }

  const fromEnv = process.env.VINA_ADMIN_PASSWORD_HASH?.trim();
  if (fromEnv) {
    if (!looksLikeBcryptHash(fromEnv)) {
      console.error(
        '[vina-auth] VINA_ADMIN_PASSWORD_HASH must be a bcrypt hash ($2…). Do not put the plain password here.',
      );
      return null;
    }
    return fromEnv;
  }

  const stored = await readStoredCredentials();
  if (stored) return stored.passwordHash;

  const bootstrap = process.env.VINA_ADMIN_BOOTSTRAP_PASSWORD?.trim();
  if (!bootstrap) return null;

  if (bootstrapHashCache && looksLikeBcryptHash(bootstrapHashCache)) {
    return bootstrapHashCache;
  }

  const passwordHash = await hashPassword(bootstrap);
  try {
    await writeCredentialsIfAbsent(passwordHash, true);
  } catch (err) {
    console.warn(
      '[vina-auth] Could not persist .data/vina-admin.json; using bootstrap hash in memory. Prefer VINA_ADMIN_PASSWORD_HASH on Vercel.',
      err instanceof Error ? err.message : err,
    );
  }
  bootstrapHashCache = passwordHash;
  return passwordHash;
}

/** 초기화 스크립트용: 부트스트랩 비밀번호로 자격 증명 파일을 1회 생성 */
export async function bootstrapAdminCredentials(
  bootstrapPassword: string,
): Promise<{ created: boolean; path: string }> {
  if (isSupabaseDataSource()) {
    const existing = await fetchAdminPasswordHashFromSupabase();
    if (existing) {
      return { created: false, path: 'supabase:vina_admin_settings' };
    }
    const passwordHash = await hashPassword(bootstrapPassword);
    await upsertAdminPasswordHashToSupabase(passwordHash, 'bootstrap');
    return { created: true, path: 'supabase:vina_admin_settings' };
  }

  const existing = await readStoredCredentials();
  if (existing) {
    return { created: false, path: CREDENTIALS_PATH };
  }
  const passwordHash = await hashPassword(bootstrapPassword);
  const created = await writeCredentialsIfAbsent(passwordHash, true);
  return { created, path: CREDENTIALS_PATH };
}
