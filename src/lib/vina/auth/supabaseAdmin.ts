import { createServiceClient, isSupabaseDataSource } from '../supabase/server';
import { looksLikeBcryptHash } from './password';

const SETTINGS_ID = 'default';

/** 프로세스 내 짧은 캐시 (로그인마다 DB 왕복 완화) */
let cachedHash: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

export function clearAdminPasswordHashCache(): void {
  cachedHash = null;
  cachedAt = 0;
}

export async function fetchAdminPasswordHashFromSupabase(): Promise<string | null> {
  if (!isSupabaseDataSource()) return null;

  const now = Date.now();
  if (cachedHash && now - cachedAt < CACHE_TTL_MS) {
    return cachedHash;
  }

  const client = createServiceClient();
  const { data, error } = await client
    .from('vina_admin_settings')
    .select('password_hash, algorithm')
    .eq('id', SETTINGS_ID)
    .maybeSingle();

  if (error) {
    console.error('[vina-auth] Supabase admin settings read failed:', error.message);
    return null;
  }
  if (!data?.password_hash || data.algorithm !== 'bcrypt') return null;
  if (!looksLikeBcryptHash(data.password_hash)) {
    console.error('[vina-auth] Stored admin hash is not a valid bcrypt hash.');
    return null;
  }

  cachedHash = data.password_hash;
  cachedAt = now;
  return cachedHash;
}

export async function upsertAdminPasswordHashToSupabase(
  passwordHash: string,
  updatedBy = 'admin-init',
): Promise<void> {
  if (!looksLikeBcryptHash(passwordHash)) {
    throw new Error('Invalid password hash format');
  }
  const client = createServiceClient();
  const { error } = await client.from('vina_admin_settings').upsert(
    {
      id: SETTINGS_ID,
      algorithm: 'bcrypt',
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy,
    },
    { onConflict: 'id' },
  );
  if (error) {
    throw new Error(`Supabase admin password upsert failed: ${error.message}`);
  }
  clearAdminPasswordHashCache();
}
