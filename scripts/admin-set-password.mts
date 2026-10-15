/**
 * 관리자 비밀번호를 Supabase vina_admin_settings 에 저장(덮어쓰기)한다.
 *
 * 사용:
 *   VINA_ADMIN_BOOTSTRAP_PASSWORD=*** npm run admin:set-password
 *
 * 평문/해시는 출력하지 않는다. .env.local 의 Supabase 키가 필요하다.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { hashPassword } from '../src/lib/vina/auth/password.ts';
import { upsertAdminPasswordHashToSupabase } from '../src/lib/vina/auth/supabaseAdmin.ts';

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const plain = process.env.VINA_ADMIN_BOOTSTRAP_PASSWORD?.trim();
if (!plain) {
  console.error(
    'VINA_ADMIN_BOOTSTRAP_PASSWORD 환경변수가 필요합니다. 평문을 스크립트에 넣지 마세요.',
  );
  process.exit(1);
}
if (plain.length < 8) {
  console.error('비밀번호는 8자 이상이어야 합니다.');
  process.exit(1);
}

if (process.env.NEXT_PUBLIC_VINA_DATA_SOURCE !== 'supabase') {
  console.error('NEXT_PUBLIC_VINA_DATA_SOURCE=supabase 가 필요합니다.');
  process.exit(1);
}

const passwordHash = await hashPassword(plain);
await upsertAdminPasswordHashToSupabase(passwordHash, 'admin-set-password');

// 앱 로그인 테이블(vina_app_users)과 동기화
const { createClient } = await import('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (url && serviceKey) {
  const username = (
    process.env.VINA_ADMIN_USERNAME?.trim() || 'admin'
  ).toLowerCase();
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.from('vina_app_users').upsert(
    {
      username,
      password_hash: passwordHash,
      role: 'admin',
      is_active: true,
      updated_at: new Date().toISOString(),
      updated_by: 'admin-set-password',
    },
    { onConflict: 'username' },
  );
  if (error) {
    console.error('vina_app_users 동기화 실패:', error.message);
    process.exit(1);
  }
}

console.log(
  '관리자 비밀번호를 Supabase(vina_admin_settings + vina_app_users)에 저장했습니다.',
);
console.log('보안을 위해 셸/환경의 VINA_ADMIN_BOOTSTRAP_PASSWORD 를 지우세요.');
