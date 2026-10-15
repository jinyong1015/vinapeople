/**
 * 앱 계정·세션·역할 가드 스모크 (Next 서버 없이 모듈 단위)
 *
 * 사용:
 *   VINA_USER_BOOTSTRAP_PASSWORD=*** npm run user:init   # 최초 1회
 *   VINA_AUTH_TEST_ADMIN_PASSWORD=*** VINA_AUTH_TEST_USER_PASSWORD=*** npm run auth:roles
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import {
  authenticateAppUser,
  createSessionToken,
  ensureAppUsersBootstrapped,
  parseSessionToken,
} from '../src/lib/vina/auth/index.ts';

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

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(ok ? 'PASS' : 'FAIL', '-', name, '-', detail);
}

await ensureAppUsersBootstrapped();

const adminUser = (process.env.VINA_ADMIN_USERNAME?.trim() || 'admin').toLowerCase();
const userUser = (process.env.VINA_USER_USERNAME?.trim() || 'user').toLowerCase();
const adminPass = process.env.VINA_AUTH_TEST_ADMIN_PASSWORD?.trim();
const userPass = process.env.VINA_AUTH_TEST_USER_PASSWORD?.trim();

if (!adminPass || !userPass) {
  console.error(
    'VINA_AUTH_TEST_ADMIN_PASSWORD / VINA_AUTH_TEST_USER_PASSWORD 가 필요합니다.',
  );
  process.exit(1);
}

const adminAuth = await authenticateAppUser(adminUser, adminPass);
check('admin login', Boolean(adminAuth && adminAuth.role === 'admin'), String(adminAuth?.role));

const userAuth = await authenticateAppUser(userUser, userPass);
check('user login', Boolean(userAuth && userAuth.role === 'user'), String(userAuth?.role));

const bad = await authenticateAppUser(userUser, 'definitely-wrong-password!!!');
check('reject wrong password', bad === null, 'ok');

if (adminAuth) {
  const token = createSessionToken(adminAuth.role, adminAuth.username);
  const claims = parseSessionToken(token);
  check(
    'admin session role',
    claims?.role === 'admin' && claims.username === adminAuth.username,
    String(claims?.role),
  );
}

if (userAuth) {
  const token = createSessionToken(userAuth.role, userAuth.username);
  const claims = parseSessionToken(token);
  check(
    'user session role',
    claims?.role === 'user' && claims.username === userAuth.username,
    String(claims?.role),
  );
  check(
    'user is not admin',
    claims?.role !== 'admin',
    String(claims?.role),
  );
}

const fail = results.filter((r) => !r.ok).length;
console.log(`\n=== SUMMARY ${results.length - fail}/${results.length} ===`);
if (fail > 0) process.exitCode = 1;
