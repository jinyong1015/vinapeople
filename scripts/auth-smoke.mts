/**
 * 인증 보안 스모크 (서버 기동 없이 모듈 단위)
 * - 평문 미저장 / 해시 검증 / 부트스트랩 재실행 무변경 / 소스에 평문 초기비번 없음
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import {
  bootstrapAdminCredentials,
  getCredentialsFilePath,
  hashPassword,
  verifyPassword,
} from '../src/lib/vina/auth/index.ts';

const ROOT = process.cwd();
const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function check(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(ok ? 'PASS' : 'FAIL', '-', name, '-', detail);
}

const sample = process.env.VINA_ADMIN_BOOTSTRAP_PASSWORD?.trim();
if (!sample) {
  console.error('VINA_ADMIN_BOOTSTRAP_PASSWORD 가 필요합니다 (테스트용, 출력하지 않음).');
  process.exit(1);
}

const hash = await hashPassword(sample);
check('hash is bcrypt', hash.startsWith('$2'), `prefix=${hash.slice(0, 4)}`);
check('hash != plain', hash !== sample, 'ok');
check('verify correct', await verifyPassword(sample, hash), 'ok');
check('verify wrong', !(await verifyPassword('wrong-password-!!!', hash)), 'ok');

const first = await bootstrapAdminCredentials(sample);
const second = await bootstrapAdminCredentials(sample);
check('bootstrap creates once', first.created === true || existsSync(getCredentialsFilePath()), `created=${first.created}`);
check('bootstrap second run no reset', second.created === false, `created=${second.created}`);

const storedRaw = readFileSync(getCredentialsFilePath(), 'utf8');
check('store has no plain password', !storedRaw.includes(sample), 'ok');
check('store has bcrypt hash', storedRaw.includes('"passwordHash"'), 'ok');

const srcFiles = [
  'src/lib/vina/auth/password.ts',
  'src/lib/vina/auth/credentials.ts',
  'src/app/api/auth/login/route.ts',
  'src/components/providers/AdminProvider.tsx',
  'src/components/admin/SettingsModal.tsx',
];
let leaked = false;
for (const rel of srcFiles) {
  const text = readFileSync(path.join(ROOT, rel), 'utf8');
  if (text.includes(sample)) {
    leaked = true;
    check(`no plain in ${rel}`, false, 'found bootstrap password');
  }
}
if (!leaked) check('no plain in client/server source samples', true, 'ok');

const envExample = readFileSync(path.join(ROOT, '.env.example'), 'utf8');
check(
  '.env.example has no initial password',
  !envExample.includes(sample),
  'ok',
);

const fail = results.filter((r) => !r.ok).length;
console.log(`\n=== SUMMARY ${results.length - fail}/${results.length} ===`);
if (fail > 0) process.exitCode = 1;
