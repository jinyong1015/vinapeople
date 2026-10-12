import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { hashPassword, looksLikeBcryptHash } from './password';

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

/**
 * 검증에 사용할 관리자 비밀번호 해시를 반환한다.
 * 우선순위:
 * 1) VINA_ADMIN_PASSWORD_HASH
 * 2) .data/vina-admin.json
 * 3) (최초 1회) VINA_ADMIN_BOOTSTRAP_PASSWORD → 해시 저장 후 사용
 */
export async function resolveAdminPasswordHash(): Promise<string | null> {
  const fromEnv = process.env.VINA_ADMIN_PASSWORD_HASH?.trim();
  if (fromEnv) {
    if (!looksLikeBcryptHash(fromEnv)) {
      console.error('[vina-auth] VINA_ADMIN_PASSWORD_HASH is not a valid bcrypt hash');
      return null;
    }
    return fromEnv;
  }

  const stored = await readStoredCredentials();
  if (stored) return stored.passwordHash;

  const bootstrap = process.env.VINA_ADMIN_BOOTSTRAP_PASSWORD?.trim();
  if (!bootstrap) return null;

  // 파일이 이미 있으면 부트스트랩으로 재설정하지 않음
  const existing = await readStoredCredentials();
  if (existing) return existing.passwordHash;

  const passwordHash = await hashPassword(bootstrap);
  const created = await writeCredentialsIfAbsent(passwordHash, true);
  if (!created) {
    const again = await readStoredCredentials();
    return again?.passwordHash ?? null;
  }
  return passwordHash;
}

/** 초기화 스크립트용: 부트스트랩 비밀번호로 자격 증명 파일을 1회 생성 */
export async function bootstrapAdminCredentials(
  bootstrapPassword: string,
): Promise<{ created: boolean; path: string }> {
  const existing = await readStoredCredentials();
  if (existing) {
    return { created: false, path: CREDENTIALS_PATH };
  }
  const passwordHash = await hashPassword(bootstrapPassword);
  const created = await writeCredentialsIfAbsent(passwordHash, true);
  return { created, path: CREDENTIALS_PATH };
}
