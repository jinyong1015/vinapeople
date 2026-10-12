/**
 * 저장된 해시로 초기 비밀번호 검증 + 세션 토큰 수명 확인
 * 비밀번호 평문/해시는 출력하지 않는다.
 */
import {
  createAdminSessionToken,
  resolveAdminPasswordHash,
  verifyAdminSessionToken,
  verifyPassword,
} from '../src/lib/vina/auth/index.ts';

const plain = process.env.VINA_ADMIN_BOOTSTRAP_PASSWORD?.trim();
if (!plain) {
  console.error('VINA_ADMIN_BOOTSTRAP_PASSWORD required for this check (not printed).');
  process.exit(1);
}

const hash = await resolveAdminPasswordHash();
if (!hash) {
  console.error('FAIL - no admin hash resolved');
  process.exit(1);
}

const ok = await verifyPassword(plain, hash);
const bad = await verifyPassword(`${plain}-wrong`, hash);
console.log(ok ? 'PASS - initial password verifies' : 'FAIL - initial password verify');
console.log(bad ? 'FAIL - wrong password accepted' : 'PASS - wrong password rejected');

const token = createAdminSessionToken();
console.log(
  verifyAdminSessionToken(token)
    ? 'PASS - session token valid'
    : 'FAIL - session token invalid',
);
console.log(
  verifyAdminSessionToken('admin:1.deadbeef')
    ? 'FAIL - forged token accepted'
    : 'PASS - forged token rejected',
);
console.log(
  verifyAdminSessionToken(null)
    ? 'FAIL - empty token accepted'
    : 'PASS - empty token rejected',
);

if (!ok || bad) process.exitCode = 1;
