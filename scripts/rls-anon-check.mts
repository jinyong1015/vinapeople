/**
 * anon 키로 직접 PostgREST 조회가 차단되는지 확인
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const client = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tables = [
  'vina_employees',
  'vina_app_users',
  'vina_attendance',
  'vina_admin_settings',
] as const;

let fail = 0;
for (const table of tables) {
  const { data, error } = await client.from(table).select('*').limit(1);
  const blocked =
    Boolean(error) || data === null || (Array.isArray(data) && data.length === 0 && error);
  // 권한 없으면 PostgREST가 permission denied / RLS 오류를 반환해야 함
  const ok = Boolean(error);
  console.log(
    ok ? 'PASS' : 'FAIL',
    '-',
    table,
    '-',
    error?.message || `rows=${Array.isArray(data) ? data.length : '?'}`,
  );
  if (!ok) fail += 1;
}

console.log(`\n=== SUMMARY ${tables.length - fail}/${tables.length} (expect anon blocked) ===`);
if (fail > 0) process.exitCode = 1;
