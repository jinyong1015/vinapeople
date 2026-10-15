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

const pass = process.env.VINA_AUTH_TEST_USER_PASSWORD?.trim();
if (!pass) {
  console.error('VINA_AUTH_TEST_USER_PASSWORD required');
  process.exit(1);
}

await ensureAppUsersBootstrapped();
const user = await authenticateAppUser('user', pass);
console.log(user?.role === 'user' ? 'PASS user login' : 'FAIL user login');
console.log(
  (await authenticateAppUser('user', 'wrong-password!!!')) === null
    ? 'PASS wrong rejected'
    : 'FAIL wrong rejected',
);
if (user) {
  const claims = parseSessionToken(createSessionToken(user.role, user.username));
  console.log(claims?.role === 'user' ? 'PASS session' : 'FAIL session');
}
console.log(
  (await authenticateAppUser('admin', 'wrong-password!!!')) === null
    ? 'PASS admin wrong rejected'
    : 'FAIL admin wrong rejected',
);
