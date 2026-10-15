import { isSupabaseDataSource } from '../dataSource';
import { createServiceClient } from '../supabase/server';
import { hashPassword, looksLikeBcryptHash, verifyPassword } from './password';
import {
  fetchAdminPasswordHashFromSupabase,
  upsertAdminPasswordHashToSupabase,
} from './supabaseAdmin';
import type { AppRole } from './session';

export interface AppUserRecord {
  id: string;
  username: string;
  role: AppRole;
  passwordHash: string;
  isActive: boolean;
}

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

async function fetchUserByUsername(
  username: string,
): Promise<AppUserRecord | null> {
  if (!isSupabaseDataSource()) return null;
  const client = createServiceClient();
  const { data, error } = await client
    .from('vina_app_users')
    .select('id, username, role, password_hash, is_active')
    .eq('username', normalizeUsername(username))
    .maybeSingle();
  if (error) {
    console.error('[vina-auth] fetch user failed:', error.message);
    return null;
  }
  if (!data?.password_hash || !looksLikeBcryptHash(data.password_hash)) {
    return null;
  }
  if (data.role !== 'user' && data.role !== 'admin') return null;
  return {
    id: data.id as string,
    username: String(data.username),
    role: data.role,
    passwordHash: data.password_hash as string,
    isActive: Boolean(data.is_active),
  };
}

async function upsertUser(input: {
  username: string;
  passwordHash: string;
  role: AppRole;
  updatedBy: string;
}): Promise<void> {
  const client = createServiceClient();
  const { error } = await client.from('vina_app_users').upsert(
    {
      username: normalizeUsername(input.username),
      password_hash: input.passwordHash,
      role: input.role,
      is_active: true,
      updated_at: new Date().toISOString(),
      updated_by: input.updatedBy,
    },
    { onConflict: 'username' },
  );
  if (error) {
    throw new Error(`앱 사용자 저장 실패: ${error.message}`);
  }
}

/**
 * 기존 관리자 해시·부트스트랩 환경변수로 계정이 없으면 1회 생성.
 * - admin: vina_admin_settings 또는 VINA_ADMIN_BOOTSTRAP_PASSWORD
 * - user: VINA_USER_BOOTSTRAP_PASSWORD (없으면 생성하지 않음)
 */
export async function ensureAppUsersBootstrapped(): Promise<void> {
  if (!isSupabaseDataSource()) return;

  const adminUsername = normalizeUsername(
    process.env.VINA_ADMIN_USERNAME?.trim() || 'admin',
  );
  const existingAdmin = await fetchUserByUsername(adminUsername);
  if (!existingAdmin) {
    let hash = await fetchAdminPasswordHashFromSupabase();
    if (!hash) {
      const bootstrap = process.env.VINA_ADMIN_BOOTSTRAP_PASSWORD?.trim();
      if (bootstrap && bootstrap.length >= 8) {
        hash = await hashPassword(bootstrap);
        await upsertAdminPasswordHashToSupabase(hash, 'bootstrap');
      }
    }
    if (hash) {
      await upsertUser({
        username: adminUsername,
        passwordHash: hash,
        role: 'admin',
        updatedBy: 'bootstrap',
      });
    }
  }

  const userUsername = normalizeUsername(
    process.env.VINA_USER_USERNAME?.trim() || 'user',
  );
  const existingUser = await fetchUserByUsername(userUsername);
  if (!existingUser) {
    const bootstrap = process.env.VINA_USER_BOOTSTRAP_PASSWORD?.trim();
    if (bootstrap && bootstrap.length >= 8) {
      const hash = await hashPassword(bootstrap);
      await upsertUser({
        username: userUsername,
        passwordHash: hash,
        role: 'user',
        updatedBy: 'bootstrap',
      });
    }
  }
}

export async function authenticateAppUser(
  username: string,
  password: string,
): Promise<{ username: string; role: AppRole } | null> {
  const normalized = normalizeUsername(username);

  // IndexedDB 모드: 기존 관리자 비밀번호만 지원 (아이디 admin)
  if (!isSupabaseDataSource()) {
    const { resolveAdminPasswordHash } = await import('./credentials');
    const hash = await resolveAdminPasswordHash();
    if (!hash) return null;
    const adminName = normalizeUsername(
      process.env.VINA_ADMIN_USERNAME?.trim() || 'admin',
    );
    if (normalized !== adminName) return null;
    const matched = await verifyPassword(password, hash);
    if (!matched) return null;
    return { username: adminName, role: 'admin' };
  }

  await ensureAppUsersBootstrapped();

  const user = await fetchUserByUsername(normalized);
  if (!user || !user.isActive) {
    return null;
  }

  const matched = await verifyPassword(password, user.passwordHash);
  if (!matched) return null;

  // 관리자 로그인 시 legacy settings 해시와 동기화 유지
  if (user.role === 'admin') {
    try {
      await upsertAdminPasswordHashToSupabase(user.passwordHash, user.username);
    } catch {
      // 동기화 실패해도 로그인은 허용
    }
  }

  return { username: user.username, role: user.role };
}
