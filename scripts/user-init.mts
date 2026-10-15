/**
 * 조회 전용 사용자 계정을 Supabase vina_app_users 에 생성(없을 때만)한다.
 *
 * 사용:
 *   VINA_USER_BOOTSTRAP_PASSWORD=*** npm run user:init
 *
 * 이미 user 계정이 있으면 비밀번호를 바꾸지 않습니다.
 * 비밀번호 변경이 필요하면 VINA_USER_BOOTSTRAP_PASSWORD 와 함께
 *   npm run user:set-password
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '../src/lib/vina/auth/password.ts';

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

const plain = process.env.VINA_USER_BOOTSTRAP_PASSWORD?.trim();
if (!plain) {
  console.error(
    'VINA_USER_BOOTSTRAP_PASSWORD 환경변수가 필요합니다. 평문을 스크립트에 넣지 마세요.',
  );
  process.exit(1);
}
if (plain.length < 8) {
  console.error('비밀번호는 8자 이상이어야 합니다.');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.');
  process.exit(1);
}

const username = (
  process.env.VINA_USER_USERNAME?.trim() || 'user'
).toLowerCase();
const force =
  process.argv.includes('--force') ||
  process.env.VINA_USER_FORCE_RESET === '1';

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: existing, error: fetchError } = await client
  .from('vina_app_users')
  .select('id, username, role')
  .eq('username', username)
  .maybeSingle();

if (fetchError) {
  console.error('사용자 조회 실패:', fetchError.message);
  process.exit(1);
}

if (existing && !force) {
  console.log(
    `이미 '${username}' 계정이 있습니다. 비밀번호는 변경하지 않았습니다.`,
  );
  console.log('덮어쓰려면 --force 또는 VINA_USER_FORCE_RESET=1 을 사용하세요.');
  process.exit(0);
}

const passwordHash = await hashPassword(plain);
const { error } = await client.from('vina_app_users').upsert(
  {
    username,
    password_hash: passwordHash,
    role: 'user',
    is_active: true,
    updated_at: new Date().toISOString(),
    updated_by: force ? 'user-set-password' : 'user-init',
  },
  { onConflict: 'username' },
);

if (error) {
  console.error('사용자 저장 실패:', error.message);
  process.exit(1);
}

console.log(
  force
    ? `조회 전용 사용자 '${username}' 비밀번호를 갱신했습니다.`
    : `조회 전용 사용자 '${username}' 계정을 생성했습니다.`,
);
console.log('보안을 위해 셸/환경의 VINA_USER_BOOTSTRAP_PASSWORD 를 지우세요.');
